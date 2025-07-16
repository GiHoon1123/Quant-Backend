import { Injectable } from '@nestjs/common';
import { BinanceRestClient } from '../../common/binance/BinanceRestClient';
import { CandleData, TimeFrame } from '../types/TechnicalAnalysisTypes';

/**
 * 캔들 데이터 서비스
 *
 * 바이낸스 API로부터 다양한 시간봉의 캔들스틱 데이터를 수집하고 관리합니다.
 * 기술적 분석을 위한 모든 OHLCV 데이터의 진입점 역할을 합니다.
 *
 * 🔍 주요 기능:
 * - 실시간 캔들 데이터 수집 (1m, 15m, 1h, 1d)
 * - 히스토리컬 데이터 대량 조회
 * - 데이터 정규화 및 검증
 * - 메모리 캐싱으로 성능 최적화
 *
 * 📊 지원 시간봉:
 * - 1분봉: 최대 1000개 (약 16시간)
 * - 15분봉: 최대 1000개 (약 10일)
 * - 1시간봉: 최대 1000개 (약 41일)
 * - 1일봉: 최대 1000개 (약 2.7년)
 */
@Injectable()
export class CandleDataService {
  // 캔들 데이터 캐시 (메모리 기반)
  private candleCache = new Map<string, CandleData[]>();

  // 캐시 유효 시간 (밀리초) - 시간봉별로 다름
  private readonly CACHE_TTL = {
    [TimeFrame.ONE_MINUTE]: 60 * 1000, // 1분 캐시
    [TimeFrame.FIFTEEN_MINUTES]: 15 * 60 * 1000, // 15분 캐시
    [TimeFrame.ONE_HOUR]: 60 * 60 * 1000, // 1시간 캐시
    [TimeFrame.ONE_DAY]: 24 * 60 * 60 * 1000, // 24시간 캐시
  };

  constructor(private readonly binanceClient: BinanceRestClient) {}

  /**
   * 특정 심볼과 시간봉의 캔들 데이터 조회
   *
   * @param symbol 거래 심볼 (예: BTCUSDT, ETHUSDT)
   * @param timeframe 시간봉 (1m, 15m, 1h, 1d)
   * @param limit 조회할 캔들 개수 (기본: 100, 최대: 1000)
   * @returns 캔들 데이터 배열 (시간순 정렬)
   *
   * 💡 캐싱 로직:
   * - 시간봉별로 다른 캐시 TTL 적용
   * - 캐시 히트 시 API 호출 없이 즉시 반환
   * - 캐시 미스 시 바이낸스 API 호출 후 캐싱
   *
   * 🔍 사용 예시:
   * ```typescript
   * // 비트코인 1시간봉 최근 200개 조회
   * const candles = await candleDataService.getCandles('BTCUSDT', TimeFrame.ONE_HOUR, 200);
   * ```
   */
  async getCandles(
    symbol: string,
    timeframe: TimeFrame,
    limit: number = 100,
  ): Promise<CandleData[]> {
    const cacheKey = `${symbol}_${timeframe}_${limit}`;

    // 1. 캐시 확인
    const cached = this.getCachedCandles(cacheKey, timeframe);
    if (cached) {
      console.log(`📊 캔들 데이터 캐시 히트: ${symbol} ${timeframe}`);
      return cached;
    }

    try {
      // 2. 바이낸스 API 호출
      console.log(
        `🔄 바이낸스에서 캔들 데이터 조회: ${symbol} ${timeframe} (${limit}개)`,
      );

      const rawCandles = await this.binanceClient.getKlines(
        symbol,
        timeframe,
        Math.min(limit, 1000), // 바이낸스 API 최대 제한
      );

      // 3. 데이터 변환 및 검증
      const candles = this.transformRawCandles(rawCandles, symbol, timeframe);

      // 4. 데이터 검증
      this.validateCandleData(candles, symbol, timeframe);

      // 5. 캐시 저장
      this.setCachedCandles(cacheKey, candles, timeframe);

      console.log(
        `✅ 캔들 데이터 조회 완료: ${symbol} ${timeframe} (${candles.length}개)`,
      );
      return candles;
    } catch (error) {
      console.error(`❌ 캔들 데이터 조회 실패: ${symbol} ${timeframe}`, error);
      throw new Error(
        `캔들 데이터 조회에 실패했습니다: ${symbol} ${timeframe} - ${error.message}`,
      );
    }
  }

  /**
   * 여러 시간봉의 캔들 데이터를 한 번에 조회
   *
   * @param symbol 거래 심볼
   * @param timeframes 조회할 시간봉들
   * @param limit 각 시간봉별 조회할 캔들 개수
   * @returns 시간봉별 캔들 데이터 맵
   *
   * 🎯 다중 시간봉 분석용:
   * - 1시간봉에서 트렌드 확인
   * - 15분봉에서 진입 타이밍 포착
   * - 1분봉에서 정밀 진입
   *
   * 📊 사용 예시:
   * ```typescript
   * const multiCandles = await candleDataService.getMultiTimeframeCandles(
   *   'BTCUSDT',
   *   [TimeFrame.ONE_DAY, TimeFrame.ONE_HOUR, TimeFrame.FIFTEEN_MINUTES],
   *   200
   * );
   * ```
   */
  async getMultiTimeframeCandles(
    symbol: string,
    timeframes: TimeFrame[],
    limit: number = 100,
  ): Promise<Map<TimeFrame, CandleData[]>> {
    const result = new Map<TimeFrame, CandleData[]>();

    // 병렬로 모든 시간봉 데이터 조회
    const promises = timeframes.map(async (timeframe) => {
      const candles = await this.getCandles(symbol, timeframe, limit);
      return { timeframe, candles };
    });

    try {
      const results = await Promise.all(promises);

      results.forEach(({ timeframe, candles }) => {
        result.set(timeframe, candles);
      });

      console.log(
        `✅ 다중 시간봉 데이터 조회 완료: ${symbol} (${timeframes.length}개 시간봉)`,
      );
      return result;
    } catch (error) {
      console.error(`❌ 다중 시간봉 데이터 조회 실패: ${symbol}`, error);
      throw new Error(`다중 시간봉 데이터 조회 실패: ${error.message}`);
    }
  }

  /**
   * 특정 심볼의 최신 캔들 데이터만 조회 (1개)
   *
   * @param symbol 거래 심볼
   * @param timeframe 시간봉
   * @returns 최신 캔들 데이터
   *
   * 🔄 실시간 모니터링용:
   * - 현재 진행중인 캔들의 실시간 상태 확인
   * - 빠른 신호 감지용
   */
  async getLatestCandle(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<CandleData> {
    const candles = await this.getCandles(symbol, timeframe, 1);

    if (!candles || candles.length === 0) {
      throw new Error(
        `최신 캔들 데이터를 찾을 수 없습니다: ${symbol} ${timeframe}`,
      );
    }

    return candles[candles.length - 1]; // 가장 최신 캔들
  }

  /**
   * 캐시된 캔들 데이터 조회 (private)
   */
  private getCachedCandles(
    cacheKey: string,
    timeframe: TimeFrame,
  ): CandleData[] | null {
    const cached = this.candleCache.get(cacheKey);
    if (!cached) return null;

    // TTL 확인
    const now = Date.now();
    const lastCandle = cached[cached.length - 1];
    const age = now - lastCandle.closeTime;

    if (age > this.CACHE_TTL[timeframe]) {
      // 캐시 만료
      this.candleCache.delete(cacheKey);
      return null;
    }

    return cached;
  }

  /**
   * 캔들 데이터 캐시 저장 (private)
   */
  private setCachedCandles(
    cacheKey: string,
    candles: CandleData[],
    timeframe: TimeFrame,
  ): void {
    this.candleCache.set(cacheKey, candles);

    // 메모리 사용량 제한 (최대 100개 캐시 엔트리)
    if (this.candleCache.size > 100) {
      const firstKey = this.candleCache.keys().next().value;
      this.candleCache.delete(firstKey);
    }
  }

  /**
   * 바이낸스 원시 데이터를 CandleData로 변환 (private)
   */
  private transformRawCandles(
    rawCandles: any[],
    symbol: string,
    timeframe: string,
  ): CandleData[] {
    return rawCandles.map((raw) => ({
      openTime: parseInt(raw[0]),
      open: parseFloat(raw[1]),
      high: parseFloat(raw[2]),
      low: parseFloat(raw[3]),
      close: parseFloat(raw[4]),
      volume: parseFloat(raw[5]),
      closeTime: parseInt(raw[6]),
      quoteVolume: parseFloat(raw[7]),
      trades: parseInt(raw[8]),
      takerBuyBaseVolume: parseFloat(raw[9]),
      takerBuyQuoteVolume: parseFloat(raw[10]),
    }));
  }

  /**
   * 캔들 데이터 유효성 검증 (private)
   */
  private validateCandleData(
    candles: CandleData[],
    symbol: string,
    timeframe: string,
  ): void {
    if (!candles || candles.length === 0) {
      throw new Error(`캔들 데이터가 비어있습니다: ${symbol} ${timeframe}`);
    }

    // 기본적인 OHLC 데이터 무결성 검증
    for (const candle of candles) {
      if (candle.high < candle.low) {
        throw new Error(
          `잘못된 캔들 데이터: 고가가 저가보다 낮음 (${symbol} ${timeframe})`,
        );
      }

      if (candle.high < candle.open || candle.high < candle.close) {
        throw new Error(
          `잘못된 캔들 데이터: 고가가 시가/종가보다 낮음 (${symbol} ${timeframe})`,
        );
      }

      if (candle.low > candle.open || candle.low > candle.close) {
        throw new Error(
          `잘못된 캔들 데이터: 저가가 시가/종가보다 높음 (${symbol} ${timeframe})`,
        );
      }

      if (candle.volume < 0 || candle.quoteVolume < 0) {
        throw new Error(
          `잘못된 캔들 데이터: 거래량이 음수 (${symbol} ${timeframe})`,
        );
      }
    }

    console.log(
      `✅ 캔들 데이터 검증 완료: ${symbol} ${timeframe} (${candles.length}개)`,
    );
  }

  /**
   * 캐시 상태 조회 (디버깅용)
   */
  getCacheStatus(): { entries: number; keys: string[] } {
    return {
      entries: this.candleCache.size,
      keys: Array.from(this.candleCache.keys()),
    };
  }

  /**
   * 캐시 초기화
   */
  clearCache(): void {
    this.candleCache.clear();
    console.log('📊 캔들 데이터 캐시가 초기화되었습니다.');
  }
}
