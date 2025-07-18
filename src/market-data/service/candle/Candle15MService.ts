import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter } from 'events';
import { DEFAULT_SYMBOLS } from 'src/common/constant/DefaultSymbols';
import { TelegramNotificationService } from 'src/common/notification/TelegramNotificationService';
import { ExternalCandleResponse } from 'src/market-data/dto/candle/ExternalCandleResponse';
import { BinanceCandle15MManager } from 'src/market-data/infra/candle/BinanceCandle15MManager';
import {
  Candle15MEntity,
  CandleData,
} from 'src/market-data/infra/candle/Candle15MEntity';
import { Candle15MRepository } from 'src/market-data/infra/candle/Candle15MRepository';

/**
 * 15분봉 캔들 서비스
 *
 * 바이낸스에서 15분봉 데이터를 실시간으로 수신하여 처리하는 서비스입니다.
 * 웹소켓을 통해 받은 데이터를 메모리와 데이터베이스에 저장하고,
 * 캔들이 완성되면 기술적 분석을 수행하여 텔레그램으로 알림을 발송합니다.
 *
 * 주요 기능:
 * - 실시간 15분봉 데이터 수신 및 저장
 * - 메모리 캐시를 통한 빠른 데이터 접근
 * - 캔들 완성 시 기술적 분석 수행 및 텔레그램 알림
 * - 다중 심볼 동시 처리
 * - 자동 재연결 및 에러 처리
 */
@Injectable()
export class Candle15MService implements OnModuleInit, OnModuleDestroy {
  private readonly manager: BinanceCandle15MManager;
  private readonly eventEmitter: EventEmitter;

  // 메모리 캐시: 최신 캔들 데이터 (심볼별)
  private readonly latestCandles = new Map<string, Candle15MEntity>();

  // 진행 중인 캔들 데이터 (아직 완성되지 않은 캔들)
  private readonly ongoingCandles = new Map<string, CandleData>();

  constructor(
    private readonly candle15MRepository: Candle15MRepository,
    private readonly telegramNotificationService: TelegramNotificationService, // 텔레그램 알림 서비스 주입
  ) {
    this.eventEmitter = new EventEmitter();
    this.manager = new BinanceCandle15MManager(this.handleKlineData.bind(this));

    // 분석 완료 이벤트 리스너 등록
    this.eventEmitter.on(
      'analysis.completed',
      this.handleAnalysisCompleted.bind(this),
    );
  }

  /**
   * 모듈 초기화
   *
   * 애플리케이션 시작 시 기본 심볼들에 대한 15분봉 스트림을 구독합니다.
   */
  async onModuleInit(): Promise<void> {
    console.log('[Candle15MService] 15분봉 서비스 초기화 시작');

    try {
      // 기본 심볼들 구독
      DEFAULT_SYMBOLS.forEach((symbol) => {
        this.manager.subscribe(symbol);
        console.log(`[Candle15MService] 15분봉 구독 시작: ${symbol}`);
      });

      // 최신 캔들 데이터 로드 (메모리 캐시 초기화)
      await this.loadLatestCandles();

      console.log('[Candle15MService] 15분봉 서비스 초기화 완료');
    } catch (error) {
      console.error('[Candle15MService] 15분봉 서비스 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 모듈 종료
   *
   * 애플리케이션 종료 시 모든 웹소켓 연결을 정리합니다.
   */
  async onModuleDestroy(): Promise<void> {
    console.log('[Candle15MService] 15분봉 서비스 종료 시작');

    try {
      this.manager.unsubscribeAll();
      this.eventEmitter.removeAllListeners();

      console.log('[Candle15MService] 15분봉 서비스 종료 완료');
    } catch (error) {
      console.error('[Candle15MService] 15분봉 서비스 종료 중 오류:', error);
    }
  }

  /**
   * 웹소켓에서 수신한 Candle 데이터 처리
   *
   * @param externalCandleResponse 바이낸스에서 수신한 Candle 데이터
   */
  private async handleKlineData(
    externalCandleResponse: ExternalCandleResponse,
  ): Promise<void> {
    try {
      const symbol = externalCandleResponse.s;
      const klineData = externalCandleResponse.k;

      // Kline 데이터를 CandleData 형태로 변환
      const candleData: CandleData = {
        openTime: klineData.t,
        closeTime: klineData.T,
        open: parseFloat(klineData.o),
        high: parseFloat(klineData.h),
        low: parseFloat(klineData.l),
        close: parseFloat(klineData.c),
        volume: parseFloat(klineData.v),
        quoteVolume: parseFloat(klineData.q),
        trades: 0, // Kline 데이터에 포함되지 않음, 기본값 설정
        takerBuyBaseVolume: parseFloat(klineData.V),
        takerBuyQuoteVolume: parseFloat(klineData.Q),
      };

      // 진행중 로그는 30초마다만 출력 (로그 스팸 방지)
      const now = Date.now();
      const lastLogKey = `${symbol}_serviceLog`;
      const lastLogTime = (this as any)[lastLogKey] || 0;

      if (now - lastLogTime > 30000) {
        console.log(
          `[Candle15MService] 15분봉 데이터 수신: ${symbol} - ${new Date(candleData.openTime).toISOString()} (진행중)`,
        );
        (this as any)[lastLogKey] = now;
      }

      // 진행 중인 캔들 데이터 업데이트
      this.ongoingCandles.set(symbol, candleData);

      // 메모리 캐시 업데이트
      await this.updateMemoryCache(symbol, candleData);

      // 데이터베이스에 저장 (진행 중인 캔들도 저장하여 복구 가능하도록)
      await this.candle15MRepository.saveCandle(symbol, 'FUTURES', candleData);

      // 캔들 완성 여부 체크 (15분봉의 경우 kline 데이터에서 완성 여부를 확인할 수 있음)
      // 실제로는 15분 간격으로 새로운 캔들이 시작될 때 이전 캔들이 완성됨
      const isNewCandle = await this.checkIfNewCandle(symbol, candleData);

      if (isNewCandle) {
        // 이전 캔들이 완성되었으므로 기술적 분석 수행
        await this.performTechnicalAnalysis(symbol);
      }

      // 처리 완료 로그도 30초마다만 출력
      if (now - lastLogTime > 30000) {
        console.log(`[Candle15MService] 15분봉 데이터 처리 완료: ${symbol}`);
      }
    } catch (error) {
      console.error('[Candle15MService] Candle 데이터 처리 중 오류:', error);
    }
  }

  /**
   * 메모리 캐시 업데이트
   *
   * @param symbol 심볼
   * @param candleData 캔들 데이터
   */
  private async updateMemoryCache(
    symbol: string,
    candleData: CandleData,
  ): Promise<void> {
    const existing = this.latestCandles.get(symbol);

    if (!existing || existing.openTime.getTime() < candleData.openTime) {
      // 새로운 캔들이거나 더 최신 캔들인 경우
      // 기존 Repository의 저장된 데이터를 캐시에 저장
      const savedCandle = await this.candle15MRepository.saveCandle(
        symbol,
        'FUTURES',
        candleData,
      );
      this.latestCandles.set(symbol, savedCandle);
    } else if (existing.openTime.getTime() === candleData.openTime) {
      // 같은 시간의 캔들 업데이트
      const savedCandle = await this.candle15MRepository.saveCandle(
        symbol,
        'FUTURES',
        candleData,
      );
      this.latestCandles.set(symbol, savedCandle);
    }
  }

  /**
   * 최신 캔들 데이터 로드 (초기화 시)
   */
  private async loadLatestCandles(): Promise<void> {
    try {
      for (const symbol of DEFAULT_SYMBOLS) {
        const latestCandles = await this.candle15MRepository.findLatestCandles(
          symbol,
          'FUTURES',
          1,
        );
        if (latestCandles.length > 0) {
          // CandleData를 Candle15M 엔티티로 변환하여 캐시에 저장
          const savedCandle = await this.candle15MRepository.saveCandle(
            symbol,
            'FUTURES',
            latestCandles[0],
          );
          this.latestCandles.set(symbol, savedCandle);
          console.log(
            `[Candle15MService] ${symbol} 최신 캔들 로드: ${new Date(latestCandles[0].openTime).toISOString()}`,
          );
        }
      }
    } catch (error) {
      console.error('[Candle15MService] 최신 캔들 로드 실패:', error);
    }
  }

  /**
   * 특정 심볼 구독 추가
   *
   * @param symbol 구독할 심볼
   */
  async subscribeSymbol(symbol: string): Promise<void> {
    try {
      this.manager.subscribe(symbol);

      // 최신 캔들 데이터 로드
      const latestCandles = await this.candle15MRepository.findLatestCandles(
        symbol,
        'FUTURES',
        1,
      );
      if (latestCandles.length > 0) {
        const savedCandle = await this.candle15MRepository.saveCandle(
          symbol,
          'FUTURES',
          latestCandles[0],
        );
        this.latestCandles.set(symbol, savedCandle);
      }

      console.log(`[Candle15MService] 심볼 구독 추가: ${symbol}`);
    } catch (error) {
      console.error(`[Candle15MService] 심볼 구독 실패: ${symbol}`, error);
      throw error;
    }
  }

  /**
   * 특정 심볼 구독 해제
   *
   * @param symbol 구독 해제할 심볼
   */
  unsubscribeSymbol(symbol: string): void {
    this.manager.unsubscribe(symbol);
    this.latestCandles.delete(symbol);
    this.ongoingCandles.delete(symbol);

    console.log(`[Candle15MService] 심볼 구독 해제: ${symbol}`);
  }

  /**
   * 특정 심볼의 최신 캔들 데이터 조회 (메모리에서)
   *
   * @param symbol 조회할 심볼
   * @returns 최신 캔들 데이터 (없으면 null)
   */
  getLatestCandle(symbol: string): Candle15MEntity | null {
    return this.latestCandles.get(symbol) || null;
  }

  /**
   * 모든 심볼의 최신 캔들 데이터 조회 (메모리에서)
   *
   * @returns 심볼별 최신 캔들 데이터 맵
   */
  getAllLatestCandles(): Map<string, Candle15MEntity> {
    return new Map(this.latestCandles);
  }

  /**
   * 진행 중인 캔들 데이터 조회
   *
   * @param symbol 조회할 심볼
   * @returns 진행 중인 캔들 데이터 (없으면 null)
   */
  getOngoingCandle(symbol: string): CandleData | null {
    return this.ongoingCandles.get(symbol) || null;
  }

  /**
   * 이벤트 리스너 등록
   *
   * @param event 이벤트 이름
   * @param listener 이벤트 리스너
   */
  on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * 이벤트 리스너 제거
   *
   * @param event 이벤트 이름
   * @param listener 이벤트 리스너
   */
  off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  /**
   * 현재 구독 상태 조회
   *
   * @returns 구독 상태 정보
   */
  getSubscriptionStatus(): {
    subscribedSymbols: string[];
    connectionStatus: Map<string, boolean>;
    cacheSize: number;
    ongoingCandlesCount: number;
  } {
    const stats = this.manager.getStats();

    return {
      subscribedSymbols: stats.subscribedSymbols,
      connectionStatus: stats.connectionStatus,
      cacheSize: this.latestCandles.size,
      ongoingCandlesCount: this.ongoingCandles.size,
    };
  }

  /**
   * 캔들 완성 이벤트 수동 트리거 (테스트용)
   *
   * @param symbol 심볼
   */
  async triggerCandleComplete(symbol: string): Promise<void> {
    const ongoingCandle = this.ongoingCandles.get(symbol);
    if (ongoingCandle) {
      // 완성된 캔들로 저장
      await this.candle15MRepository.saveCandle(
        symbol,
        'FUTURES',
        ongoingCandle,
      );

      // 완성 이벤트 발생
      this.eventEmitter.emit('candle.completed', {
        symbol,
        candleData: ongoingCandle,
        isCompleted: true,
      });

      console.log(
        `[Candle15MService] 캔들 완성 이벤트 트리거: ${symbol} - ${new Date(ongoingCandle.openTime).toISOString()}`,
      );
    }
  }

  /**
   * 새로운 캔들 시작 여부 확인
   *
   * @param symbol 심볼
   * @param candleData 현재 캔들 데이터
   * @returns 새로운 캔들 시작 여부
   */
  private async checkIfNewCandle(
    symbol: string,
    candleData: CandleData,
  ): Promise<boolean> {
    const existingCandle = this.latestCandles.get(symbol);

    if (!existingCandle) {
      return false; // 첫 번째 캔들
    }

    // 시작 시간이 다르면 새로운 캔들
    return existingCandle.openTime.getTime() !== candleData.openTime;
  }

  /**
   * 기술적 분석 수행 및 텔레그램 알림
   *
   * @param symbol 분석할 심볼
   */
  private async performTechnicalAnalysis(symbol: string): Promise<void> {
    try {
      console.log(`[Candle15MService] ${symbol} 기술적 분석 시작`);

      // 최근 캔들 데이터 조회 (분석에 필요한 개수)
      const recentCandles = await this.candle15MRepository.findLatestCandles(
        symbol,
        'FUTURES',
        50,
      );

      if (recentCandles.length < 20) {
        console.log(
          `[Candle15MService] ${symbol} 분석용 데이터 부족 (${recentCandles.length}개)`,
        );
        return;
      }

      // 간단한 기술적 분석 수행
      const analysisResult = this.performSimpleAnalysis(recentCandles);

      // 시그널이 있을 때만 알림 발송
      if (analysisResult.signal !== 'HOLD') {
        this.eventEmitter.emit('analysis.completed', {
          symbol,
          result: analysisResult,
        });

        console.log(
          `[Candle15MService] ${symbol} 분석 완료 - 시그널: ${analysisResult.signal}`,
        );
      }
    } catch (error) {
      console.error(`[Candle15MService] ${symbol} 기술적 분석 실패:`, error);
    }
  }

  /**
   * 간단한 기술적 분석 수행
   *
   * @param candles 캔들 데이터 배열
   * @returns 분석 결과
   */
  private performSimpleAnalysis(candles: CandleData[]): {
    signal: 'BUY' | 'SELL' | 'HOLD';
    indicators: Record<string, any>;
    price: number;
    timestamp: Date;
  } {
    // 최신 캔들
    const latest = candles[candles.length - 1];

    // 단순 이동평균 계산 (5, 10, 20)
    const sma5 = this.calculateSMA(candles, 5);
    const sma10 = this.calculateSMA(candles, 10);
    const sma20 = this.calculateSMA(candles, 20);

    // 볼륨 평균
    const avgVolume =
      candles.slice(-10).reduce((sum, c) => sum + c.volume, 0) / 10;

    // 간단한 시그널 로직
    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

    // 상승 시그널: 단기 평균이 장기 평균보다 위에 있고, 볼륨이 평균보다 높음
    if (sma5 > sma10 && sma10 > sma20 && latest.volume > avgVolume * 1.5) {
      signal = 'BUY';
    }
    // 하락 시그널: 단기 평균이 장기 평균보다 아래에 있고, 볼륨이 평균보다 높음
    else if (sma5 < sma10 && sma10 < sma20 && latest.volume > avgVolume * 1.5) {
      signal = 'SELL';
    }

    return {
      signal,
      indicators: {
        SMA5: sma5,
        SMA10: sma10,
        SMA20: sma20,
        Volume: latest.volume,
        AvgVolume: avgVolume,
        VolumeRatio: latest.volume / avgVolume,
      },
      price: latest.close,
      timestamp: new Date(latest.closeTime),
    };
  }

  /**
   * 단순 이동평균 계산
   *
   * @param candles 캔들 데이터
   * @param period 기간
   * @returns 이동평균 값
   */
  private calculateSMA(candles: CandleData[], period: number): number {
    if (candles.length < period) return 0;

    const slice = candles.slice(-period);
    const sum = slice.reduce((acc, candle) => acc + candle.close, 0);
    return sum / period;
  }

  /**
   * 분석 완료 이벤트 핸들러
   *
   * @param data 분석 결과 데이터
   */
  private async handleAnalysisCompleted(data: {
    symbol: string;
    result: {
      signal: 'BUY' | 'SELL' | 'HOLD';
      indicators: Record<string, any>;
      price: number;
      timestamp: Date;
    };
  }): Promise<void> {
    try {
      // 새로운 템플릿을 사용한 기술적 분석 알림 발송
      await this.telegramNotificationService.sendAnalysisResult(
        data.symbol,
        data.result,
      );

      // 추가로 특별한 상황에 대한 상세 알림
      await this.sendDetailedTechnicalAlerts(data.symbol, data.result);

      console.log(
        `[Candle15MService] ${data.symbol} 분석 결과 텔레그램 알림 발송 완료`,
      );
    } catch (error) {
      console.error(
        `[Candle15MService] ${data.symbol} 텔레그램 알림 발송 실패:`,
        error,
      );
    }
  }

  /**
   * 상세 기술적 분석 알림 발송
   *
   * @param symbol 거래 심볼
   * @param result 분석 결과
   */
  private async sendDetailedTechnicalAlerts(
    symbol: string,
    result: {
      signal: 'BUY' | 'SELL' | 'HOLD';
      indicators: Record<string, any>;
      price: number;
      timestamp: Date;
    },
  ): Promise<void> {
    try {
      const { indicators, price, timestamp } = result;

      // 1. 이동평균선 관련 알림
      if (indicators.SMA5 && indicators.SMA10 && indicators.SMA20) {
        // SMA5가 SMA20을 상향 돌파한 경우
        if (
          indicators.SMA5 > indicators.SMA20 &&
          indicators.SMA5 / indicators.SMA20 > 1.02 // 2% 이상 차이
        ) {
          await this.telegramNotificationService.sendMABreakoutAlert(
            symbol,
            '15m',
            20,
            price,
            indicators.SMA20,
            'breakout_up',
            timestamp,
          );
        }
        // SMA5가 SMA20을 하향 이탈한 경우
        else if (
          indicators.SMA5 < indicators.SMA20 &&
          indicators.SMA5 / indicators.SMA20 < 0.98 // 2% 이상 차이
        ) {
          await this.telegramNotificationService.sendMABreakoutAlert(
            symbol,
            '15m',
            20,
            price,
            indicators.SMA20,
            'breakout_down',
            timestamp,
          );
        }
      }

      // 2. 거래량 급증 알림
      if (
        indicators.VolumeRatio &&
        indicators.VolumeRatio > 3 // 평균의 3배 이상
      ) {
        await this.telegramNotificationService.sendTextMessage(
          `🔥 <b>${symbol} 거래량 급증!</b>\n\n` +
            `📊 현재 거래량: ${indicators.Volume?.toFixed(2) || 'N/A'}\n` +
            `📈 평균 거래량: ${indicators.AvgVolume?.toFixed(2) || 'N/A'}\n` +
            `🚀 거래량 비율: <b>${indicators.VolumeRatio.toFixed(1)}배</b>\n` +
            `💡 의미: 강한 관심 증가 → 큰 움직임 예상\n` +
            `🕒 감지 시점: ${this.telegramNotificationService['formatTimeWithKST'](timestamp)}`,
        );
      }

      // 3. 강한 모멘텀 알림 (3개 이동평균이 모두 정렬된 경우)
      if (
        indicators.SMA5 &&
        indicators.SMA10 &&
        indicators.SMA20 &&
        result.signal !== 'HOLD'
      ) {
        const isStrongUptrend =
          indicators.SMA5 > indicators.SMA10 &&
          indicators.SMA10 > indicators.SMA20 &&
          indicators.VolumeRatio > 1.5;

        const isStrongDowntrend =
          indicators.SMA5 < indicators.SMA10 &&
          indicators.SMA10 < indicators.SMA20 &&
          indicators.VolumeRatio > 1.5;

        if (isStrongUptrend) {
          await this.telegramNotificationService.sendTextMessage(
            `🚀 <b>${symbol} 강한 상승 모멘텀!</b>\n\n` +
              `📈 이동평균 정배열: SMA5 > SMA10 > SMA20\n` +
              `📊 거래량 증가: ${indicators.VolumeRatio.toFixed(1)}배\n` +
              `💡 의미: 강력한 상승 추세 → 지속 상승 기대\n` +
              `🎯 전략: 추세 추종 매수 고려\n` +
              `🕒 ${this.telegramNotificationService['formatTimeWithKST'](timestamp)}`,
          );
        } else if (isStrongDowntrend) {
          await this.telegramNotificationService.sendTextMessage(
            `📉 <b>${symbol} 강한 하락 모멘텀!</b>\n\n` +
              `📉 이동평균 역배열: SMA5 < SMA10 < SMA20\n` +
              `📊 거래량 증가: ${indicators.VolumeRatio.toFixed(1)}배\n` +
              `💡 의미: 강력한 하락 추세 → 지속 하락 우려\n` +
              `🎯 전략: 손절 또는 공매도 고려\n` +
              `🕒 ${this.telegramNotificationService['formatTimeWithKST'](timestamp)}`,
          );
        }
      }
    } catch (error) {
      console.error(
        `[Candle15MService] ${symbol} 상세 기술적 분석 알림 실패:`,
        error,
      );
    }
  }
}
