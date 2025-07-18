import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CandleData } from '../../infra/candle/Candle15MEntity';
import { Candle15MRepository } from '../../infra/candle/Candle15MRepository';

/**
 * 바이낸스 히스토리컬 데이터 수집 서비스
 *
 * 바이낸스 선물 API에서 과거 15분봉 데이터를 대량으로 수집하여
 * 데이터베이스에 저장하는 서비스입니다.
 *
 * 주요 기능:
 * - 4년치 히스토리컬 15분봉 데이터 수집
 * - Rate Limit 준수한 순차 처리
 * - 중단/재시작 지원 (마지막 저장 시점부터 재개)
 * - 배치 인서트로 성능 최적화
 * - 상세한 진행 상황 로깅
 * - 데이터 무결성 검증
 *
 * Rate Limit 정보:
 * - 바이낸스 선물 API: 2400 request weight per minute
 * - Klines API weight: 5 per request
 * - 안전한 간격: 200ms per request
 *
 * @example
 * ```typescript
 * // 전체 히스토리컬 데이터 수집
 * await historyService.collectHistoricalData('BTCUSDT');
 *
 * // 특정 기간 데이터 수집
 * await historyService.collectDataInRange(
 *   'BTCUSDT',
 *   new Date('2020-01-01'),
 *   new Date('2024-01-01')
 * );
 * ```
 */
@Injectable()
export class BinanceHistoryDataService {
  private readonly BASE_URL = 'https://fapi.binance.com';
  private readonly KLINES_ENDPOINT = '/fapi/v1/klines';

  /**
   * API 제한 및 최적화 설정
   */
  private readonly LIMITS = {
    MAX_CANDLES_PER_REQUEST: 1500, // 바이낸스 최대값
    REQUEST_DELAY_MS: 200, // Rate limit 방지용 지연시간
    BATCH_SIZE: 500, // DB 배치 인서트 크기
    MAX_RETRIES: 3, // 실패 시 재시도 횟수
  };

  /**
   * 15분봉 간격 (밀리초)
   */
  private readonly CANDLE_INTERVAL_MS = 15 * 60 * 1000; // 15분

  constructor(
    private readonly candleRepository: Candle15MRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 전체 히스토리컬 데이터 수집
   *
   * 4년 전부터 현재까지의 15분봉 데이터를 수집합니다.
   * 기존 데이터가 있다면 마지막 시점부터 재개합니다.
   *
   * @param symbol 수집할 심볼 (예: 'BTCUSDT')
   * @returns 수집 결과 통계
   */
  async collectHistoricalData(symbol: string): Promise<{
    success: boolean;
    totalCandles: number;
    newCandles: number;
    duplicateCandles: number;
    startTime: Date;
    endTime: Date;
    duration: number;
    errors: any[];
  }> {
    // 4년 전부터 시작 (더 확실한 과거 데이터)
    const fourYearsAgo = new Date();
    fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);

    const startTime = fourYearsAgo;
    const endTime = new Date();

    console.log(`🚀 [${symbol}] 4년치 히스토리컬 데이터 수집 시작`);
    console.log(
      `📅 수집 범위: ${startTime.toISOString()} ~ ${endTime.toISOString()}`,
    );

    return await this.collectDataInRange(symbol, startTime, endTime);
  }

  /**
   * 특정 기간 데이터 수집
   *
   * @param symbol 수집할 심볼
   * @param startTime 시작 시간
   * @param endTime 종료 시간
   * @returns 수집 결과 통계
   */
  async collectDataInRange(
    symbol: string,
    startTime: Date,
    endTime: Date,
  ): Promise<{
    success: boolean;
    totalCandles: number;
    newCandles: number;
    duplicateCandles: number;
    startTime: Date;
    endTime: Date;
    duration: number;
    errors: any[];
  }> {
    const collectionStartTime = Date.now();
    const errors: any[] = [];
    let totalCandles = 0;
    let newCandles = 0;
    let duplicateCandles = 0;

    try {
      // 1. 기존 데이터 확인 및 시작 지점 결정
      const lastCandle = await this.findLastStoredCandle(symbol);
      const firstCandle = await this.findFirstStoredCandle(symbol);
      let currentStartTime = startTime;

      console.log(`📊 [${symbol}] 기존 데이터 상태 확인:`);
      if (firstCandle) {
        console.log(
          `   • 첫 번째 캔들: ${new Date(firstCandle.openTime).toISOString()}`,
        );
      }
      if (lastCandle) {
        console.log(
          `   • 마지막 캔들: ${new Date(lastCandle.openTime).toISOString()}`,
        );
      }

      // 기존 데이터가 있을 때 처리 방식 개선
      if (firstCandle && lastCandle) {
        const firstCandleTime = new Date(firstCandle.openTime);
        const lastCandleTime = new Date(lastCandle.openTime);

        // 과거 데이터 부족 확인
        if (firstCandleTime > startTime) {
          console.log(
            `📅 [${symbol}] 과거 데이터 부족 감지, ${startTime.toISOString()}부터 ${firstCandleTime.toISOString()}까지 수집`,
          );
          currentStartTime = startTime;
        } else if (lastCandleTime < endTime) {
          // 최신 데이터 부족 확인
          const timeDiffToEnd = endTime.getTime() - lastCandleTime.getTime();
          if (timeDiffToEnd > this.CANDLE_INTERVAL_MS) {
            currentStartTime = new Date(
              lastCandleTime.getTime() + this.CANDLE_INTERVAL_MS,
            );
            console.log(
              `� [${symbol}] 최신 데이터 부족 감지, ${currentStartTime.toISOString()}부터 재개`,
            );
          } else {
            console.log(`✅ [${symbol}] 데이터가 이미 최신 상태입니다.`);
            return {
              success: true,
              totalCandles: 0,
              newCandles: 0,
              duplicateCandles: 0,
              startTime: currentStartTime,
              endTime,
              duration: Date.now() - collectionStartTime,
              errors: [],
            };
          }
        }
      } else {
        console.log(`📅 [${symbol}] 기존 데이터 없음, 전체 기간 수집 시작`);
      }

      // 2. 시간 유효성 검증
      const timeDifference = endTime.getTime() - currentStartTime.getTime();

      if (timeDifference <= 0) {
        console.log(
          `ℹ️ [${symbol}] 수집할 데이터가 없습니다. (시작: ${currentStartTime.toISOString()}, 종료: ${endTime.toISOString()})`,
        );

        const result = {
          success: true,
          totalCandles: 0,
          newCandles: 0,
          duplicateCandles: 0,
          startTime: currentStartTime,
          endTime,
          duration: Date.now() - collectionStartTime,
          errors: [],
        };

        console.log(`✅ [${symbol}] 데이터가 이미 최신 상태입니다.`);
        return result;
      }

      // 3. 예상 캔들 수 계산
      const expectedCandles = Math.floor(
        timeDifference / this.CANDLE_INTERVAL_MS,
      );
      console.log(
        `📈 [${symbol}] 예상 수집 캔들 수: ${expectedCandles.toLocaleString()}개`,
      );

      // 3. 배치 단위로 데이터 수집
      let currentTime = currentStartTime.getTime();
      const endTimeMs = endTime.getTime();
      let batchCount = 0;
      const pendingCandles: CandleData[] = [];

      while (currentTime < endTimeMs) {
        try {
          batchCount++;

          // 3-1. 바이낸스 API 호출
          const batchEndTime = Math.min(
            currentTime +
              this.LIMITS.MAX_CANDLES_PER_REQUEST * this.CANDLE_INTERVAL_MS,
            endTimeMs,
          );

          console.log(
            `📡 [${symbol}] 배치 ${batchCount} 요청: ${new Date(currentTime).toISOString()} ~ ${new Date(batchEndTime).toISOString()}`,
          );

          const candleData = await this.fetchCandlesFromBinance(
            symbol,
            currentTime,
            batchEndTime,
          );

          if (candleData.length === 0) {
            console.log(`⚠️ [${symbol}] 배치 ${batchCount}: 데이터 없음`);
            break;
          }

          // 3-2. 수집된 데이터 누적
          pendingCandles.push(...candleData);
          totalCandles += candleData.length;

          console.log(
            `✅ [${symbol}] 배치 ${batchCount} 완료: ${candleData.length}개 캔들 수집 (누적: ${totalCandles.toLocaleString()}개)`,
          );

          // 3-3. 배치 크기만큼 모이면 DB 저장
          if (pendingCandles.length >= this.LIMITS.BATCH_SIZE) {
            const saveResult = await this.saveCandlesBatch(
              symbol,
              pendingCandles.splice(0, this.LIMITS.BATCH_SIZE),
            );
            newCandles += saveResult.newCandles;
            duplicateCandles += saveResult.duplicateCandles;
          }

          // 3-4. 다음 배치 준비
          const lastCandle = candleData[candleData.length - 1];
          currentTime = lastCandle.openTime + this.CANDLE_INTERVAL_MS;

          // 3-5. Rate Limit 방지 지연
          await this.sleep(this.LIMITS.REQUEST_DELAY_MS);
        } catch (error) {
          console.error(
            `❌ [${symbol}] 배치 ${batchCount} 실패:`,
            error.message,
          );
          errors.push({
            batchCount,
            timestamp: new Date(currentTime),
            error: error.message,
          });

          // 재시도 로직
          let retryCount = 0;
          let retrySuccess = false;

          while (retryCount < this.LIMITS.MAX_RETRIES && !retrySuccess) {
            retryCount++;
            const retryDelay = 1000 * retryCount; // 1초, 2초, 3초 지연

            console.log(
              `🔄 [${symbol}] 배치 ${batchCount} 재시도 ${retryCount}/${this.LIMITS.MAX_RETRIES} (${retryDelay}ms 후)`,
            );
            await this.sleep(retryDelay);

            try {
              const batchEndTime = Math.min(
                currentTime +
                  this.LIMITS.MAX_CANDLES_PER_REQUEST * this.CANDLE_INTERVAL_MS,
                endTimeMs,
              );

              const retryData = await this.fetchCandlesFromBinance(
                symbol,
                currentTime,
                batchEndTime,
              );

              if (retryData.length > 0) {
                pendingCandles.push(...retryData);
                totalCandles += retryData.length;

                const lastCandle = retryData[retryData.length - 1];
                currentTime = lastCandle.openTime + this.CANDLE_INTERVAL_MS;
                retrySuccess = true;

                console.log(
                  `✅ [${symbol}] 배치 ${batchCount} 재시도 성공: ${retryData.length}개 캔들`,
                );
              }
            } catch (retryError) {
              console.error(
                `❌ [${symbol}] 재시도 ${retryCount} 실패:`,
                retryError.message,
              );
            }
          }

          if (!retrySuccess) {
            console.error(
              `💥 [${symbol}] 배치 ${batchCount} 최종 실패 - 다음 배치로 건너뜀`,
            );
            currentTime +=
              this.LIMITS.MAX_CANDLES_PER_REQUEST * this.CANDLE_INTERVAL_MS;
          }
        }
      }

      // 4. 남은 데이터 저장
      if (pendingCandles.length > 0) {
        console.log(
          `💾 [${symbol}] 남은 ${pendingCandles.length}개 캔들 저장 중...`,
        );
        const finalSaveResult = await this.saveCandlesBatch(
          symbol,
          pendingCandles,
        );
        newCandles += finalSaveResult.newCandles;
        duplicateCandles += finalSaveResult.duplicateCandles;
      }

      const duration = Date.now() - collectionStartTime;
      const result = {
        success: true,
        totalCandles,
        newCandles,
        duplicateCandles,
        startTime: currentStartTime,
        endTime,
        duration,
        errors,
      };

      // 5. 최종 결과 로깅
      console.log(`🎉 [${symbol}] 히스토리컬 데이터 수집 완료!`);
      console.log(`📊 수집 통계:`);
      console.log(`   • 총 수집: ${totalCandles.toLocaleString()}개 캔들`);
      console.log(`   • 신규 저장: ${newCandles.toLocaleString()}개`);
      console.log(`   • 중복 건너뜀: ${duplicateCandles.toLocaleString()}개`);
      console.log(`   • 소요 시간: ${Math.round(duration / 1000)}초`);
      console.log(
        `   • 처리 속도: ${Math.round(totalCandles / (duration / 1000))} 캔들/초`,
      );

      if (errors.length > 0) {
        console.log(`   • 오류 발생: ${errors.length}개 배치`);
      }

      return result;
    } catch (error) {
      console.error(
        `💥 [${symbol}] 히스토리컬 데이터 수집 치명적 오류:`,
        error,
      );

      const duration = Date.now() - collectionStartTime;
      return {
        success: false,
        totalCandles,
        newCandles,
        duplicateCandles,
        startTime,
        endTime,
        duration,
        errors: [...errors, { error: error.message, timestamp: new Date() }],
      };
    }
  }

  /**
   * 바이낸스 API에서 캔들 데이터 조회
   *
   * @param symbol 심볼
   * @param startTime 시작 시간 (Unix timestamp)
   * @param endTime 종료 시간 (Unix timestamp)
   * @returns 캔들 데이터 배열
   */
  private async fetchCandlesFromBinance(
    symbol: string,
    startTime: number,
    endTime: number,
  ): Promise<CandleData[]> {
    const url = `${this.BASE_URL}${this.KLINES_ENDPOINT}`;
    const params = {
      symbol: symbol,
      interval: '15m',
      startTime: startTime,
      endTime: endTime,
      limit: this.LIMITS.MAX_CANDLES_PER_REQUEST,
    };

    try {
      const response = await axios.get(url, {
        params,
        timeout: 10000, // 10초 타임아웃
      });

      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid response format from Binance API');
      }

      // 바이낸스 응답을 CandleData 형식으로 변환
      return response.data.map((item: any[]) => ({
        openTime: parseInt(item[0]),
        closeTime: parseInt(item[6]),
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5]),
        quoteVolume: parseFloat(item[7]),
        trades: parseInt(item[8]),
        takerBuyBaseVolume: parseFloat(item[9]),
        takerBuyQuoteVolume: parseFloat(item[10]),
      }));
    } catch (error) {
      if (error.response?.status === 429) {
        throw new Error(
          `Rate limit exceeded. Status: ${error.response.status}`,
        );
      } else if (error.response?.status >= 400) {
        throw new Error(
          `Binance API error. Status: ${error.response.status}, Message: ${error.response.data?.msg || 'Unknown'}`,
        );
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout');
      } else {
        throw new Error(`Network error: ${error.message}`);
      }
    }
  }

  /**
   * 캔들 데이터 배치 저장
   *
   * @param symbol 심볼
   * @param candles 저장할 캔들 데이터 배열
   * @returns 저장 결과 통계
   */
  private async saveCandlesBatch(
    symbol: string,
    candles: CandleData[],
  ): Promise<{ newCandles: number; duplicateCandles: number }> {
    let newCandles = 0;
    let duplicateCandles = 0;

    try {
      console.log(`💾 [${symbol}] ${candles.length}개 캔들 DB 저장 시작...`);

      for (const candle of candles) {
        try {
          // 중복 체크: 같은 시간의 캔들이 이미 있는지 확인
          const existing = await this.candleRepository.findByOpenTime(
            symbol,
            'FUTURES',
            candle.openTime,
          );

          if (existing) {
            duplicateCandles++;
            continue; // 이미 존재하면 건너뛰기
          }

          // 새 캔들 저장
          await this.candleRepository.saveCandle(symbol, 'FUTURES', candle);
          newCandles++;
        } catch (saveError) {
          console.error(
            `❌ [${symbol}] 개별 캔들 저장 실패 (${new Date(candle.openTime).toISOString()}):`,
            saveError.message,
          );
        }
      }

      console.log(
        `✅ [${symbol}] 배치 저장 완료: 신규 ${newCandles}개, 중복 ${duplicateCandles}개`,
      );
    } catch (error) {
      console.error(`❌ [${symbol}] 배치 저장 실패:`, error.message);
      throw error;
    }

    return { newCandles, duplicateCandles };
  }

  /**
   * 마지막 저장된 캔들 조회
   *
   * @param symbol 심볼
   * @returns 마지막 캔들 또는 null
   */
  private async findLastStoredCandle(
    symbol: string,
  ): Promise<CandleData | null> {
    try {
      const latestCandles = await this.candleRepository.findLatestCandles(
        symbol,
        'FUTURES',
        1,
      );

      return latestCandles.length > 0 ? latestCandles[0] : null;
    } catch (error) {
      console.error(`❌ [${symbol}] 마지막 캔들 조회 실패:`, error.message);
      return null;
    }
  }

  /**
   * 첫 번째 저장된 캔들 조회
   *
   * @param symbol 심볼
   * @returns 첫 번째 캔들 또는 null
   */
  private async findFirstStoredCandle(
    symbol: string,
  ): Promise<CandleData | null> {
    try {
      const earliestCandles = await this.candleRepository.findEarliestCandles(
        symbol,
        'FUTURES',
        1,
      );

      return earliestCandles.length > 0 ? earliestCandles[0] : null;
    } catch (error) {
      console.error(`❌ [${symbol}] 첫 번째 캔들 조회 실패:`, error.message);
      return null;
    }
  }

  /**
   * 특정 심볼의 데이터 통계 조회
   *
   * @param symbol 심볼
   * @returns 데이터 통계
   */
  async getDataStatistics(symbol: string): Promise<{
    totalCandles: number;
    firstCandle?: Date;
    lastCandle?: Date;
    dataGaps: { start: Date; end: Date; missingCandles: number }[];
  }> {
    try {
      // 전체 캔들 수
      const totalCandles = await this.candleRepository.countCandles(
        symbol,
        'FUTURES',
      );

      if (totalCandles === 0) {
        return {
          totalCandles: 0,
          dataGaps: [],
        };
      }

      // 첫 번째와 마지막 캔들
      const [firstCandles, lastCandles] = await Promise.all([
        this.candleRepository.findEarliestCandles(symbol, 'FUTURES', 1),
        this.candleRepository.findLatestCandles(symbol, 'FUTURES', 1),
      ]);

      const firstCandle = firstCandles[0]?.openTime;
      const lastCandle = lastCandles[0]?.openTime;

      // TODO: 데이터 갭 분석 구현 (복잡한 쿼리 필요)
      const dataGaps: { start: Date; end: Date; missingCandles: number }[] = [];

      return {
        totalCandles,
        firstCandle: firstCandle ? new Date(firstCandle) : undefined,
        lastCandle: lastCandle ? new Date(lastCandle) : undefined,
        dataGaps,
      };
    } catch (error) {
      console.error(`❌ [${symbol}] 데이터 통계 조회 실패:`, error.message);
      throw error;
    }
  }

  /**
   * Sleep 유틸리티 함수
   *
   * @param ms 대기 시간 (밀리초)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
