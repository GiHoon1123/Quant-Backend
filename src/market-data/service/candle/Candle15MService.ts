import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter } from 'events';
import { DEFAULT_SYMBOLS } from 'src/common/constant/DefaultSymbols';
import { CandleCompletedEvent } from 'src/common/dto/event/CandleCompletedEvent';
import { ExternalCandleResponse } from 'src/market-data/dto/candle/ExternalCandleResponse';
import { BinanceCandle15MManager } from 'src/market-data/infra/client/BinanceCandle15MManager';
import {
  Candle15MEntity,
  CandleData,
} from 'src/market-data/infra/persistence/entity/Candle15MEntity';
import { Candle15MRepository } from 'src/market-data/infra/persistence/repository/Candle15MRepository';
import {
  CandleSavedEvent,
  MARKET_DATA_EVENTS,
} from 'src/market-data/types/MarketDataEvents';

/**
 * 15분봉 캔들 데이터 수집 및 저장 서비스
 *
 * 🎯 **핵심 책임**: 데이터 수집과 저장에만 집중
 * - 바이낸스 웹소켓에서 실시간 15분봉 데이터 수신
 * - 데이터베이스에 캔들 데이터 저장 (UPSERT 패턴)
 * - 메모리 캐시를 통한 빠른 데이터 접근
 * - 캔들 저장 완료 시 이벤트 발송 (다른 도메인에서 활용)
 *
 * 🚫 **책임 범위 외**:
 * - 기술적 분석 (technical-analysis 도메인 담당)
 * - 알림 발송 (notification 도메인 담당)
 *
 * 📡 **발송 이벤트**:
 * - `candle.saved`: 캔들 데이터 저장 완료 시
 *
 * 🔄 **이벤트 기반 플로우**:
 * 웹소켓 데이터 수신 → DB 저장 → candle.saved 이벤트 발송
 */
@Injectable()
export class Candle15MService implements OnModuleInit, OnModuleDestroy {
  private readonly manager: BinanceCandle15MManager;
  private readonly eventEmitter: EventEmitter;

  // 메모리 캐시: 최신 캔들 데이터 (심볼별) - 빠른 조회용
  private readonly latestCandles = new Map<string, Candle15MEntity>();

  // 진행 중인 캔들 데이터 (아직 완성되지 않은 캔들) - 실시간 업데이트용
  private readonly ongoingCandles = new Map<string, CandleData>();

  constructor(private readonly candle15MRepository: Candle15MRepository) {
    this.eventEmitter = new EventEmitter();
    this.manager = new BinanceCandle15MManager(this.handleKlineData.bind(this));

    console.log('� [Candle15MService] 캔들 데이터 수집 서비스 초기화');
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

      // 🔍 새로운 캔들 여부 확인 (메모리 캐시 업데이트 전에 검사)
      const isNewCandle = await this.checkIfNewCandle(symbol, candleData);

      // 진행 중인 캔들 데이터 업데이트
      this.ongoingCandles.set(symbol, candleData);

      // 📊 데이터베이스에 저장 (UPSERT 패턴으로 중복 방지)
      const savedCandle = await this.candle15MRepository.saveCandle(
        symbol,
        'FUTURES',
        candleData,
      );

      // 메모리 캐시 업데이트 (새로운 캔들 검사 후)
      await this.updateMemoryCache(symbol, candleData);

      // 📡 캔들 저장 완료 이벤트 발송 (새로운 캔들일 때만 기술적 분석/알림 트리거)
      if (isNewCandle) {
        await this.emitCandleSavedEvent(
          symbol,
          candleData,
          savedCandle,
          isNewCandle,
        );
      } else {
        // 진행 중인 캔들 업데이트는 30초마다만 로그 출력
        if (now - lastLogTime > 30000) {
          console.log(
            `📈 [Candle15MService] 진행 중인 캔들 업데이트: ${symbol} - 이벤트 발송 없음`,
          );
        }
      }

      // 처리 완료 로그 (30초마다만 출력하여 스팸 방지)
      if (now - lastLogTime > 30000) {
        console.log(`📊 [Candle15MService] 15분봉 데이터 처리 완료: ${symbol}`);
      }
    } catch (error) {
      console.error('❌ [Candle15MService] 캔들 데이터 처리 중 오류:', error);
    }
  }

  /**
   * 📡 캔들 저장 완료 이벤트 발송
   *
   * ⚠️ **중요**: 새로운 캔들이 시작될 때만 이벤트를 발송합니다.
   * 진행 중인 캔들의 업데이트는 이벤트를 발송하지 않습니다.
   *
   * 다른 도메인(technical-analysis, notification 등)에서
   * 이 이벤트를 수신하여 후속 작업을 수행합니다.
   *
   * @param symbol 거래 심볼
   * @param candleData 캔들 데이터
   * @param savedCandle 저장된 캔들 엔티티
   * @param isNewCandle 새로운 캔들 여부
   */
  private async emitCandleSavedEvent(
    symbol: string,
    candleData: CandleData,
    savedCandle: Candle15MEntity,
    isNewCandle: boolean,
  ): Promise<void> {
    try {
      // 새로운 캔들이 아니면 이벤트 발송하지 않음
      if (!isNewCandle) {
        return;
      }

      const event: CandleSavedEvent = {
        symbol,
        market: 'FUTURES' as const,
        timeframe: '15m',
        candleData,
        isNewCandle,
        savedAt: new Date(),
        candleId: savedCandle.id,
      };

      // 이벤트 발송 (technical-analysis 도메인에서 수신)
      this.eventEmitter.emit(MARKET_DATA_EVENTS.CANDLE_SAVED, event);

      console.log(
        `📡 [CandleSaved Event] 새 캔들 저장 이벤트 발송: ${symbol} (ID: ${savedCandle.id}) - ${new Date(candleData.openTime).toISOString()}`,
      );
    } catch (error) {
      console.error(
        `❌ [CandleSaved Event] 이벤트 발송 실패: ${symbol}`,
        error,
      );
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
      // 새로운 캔들이거나 더 최신 캔들인 경우 - 이미 저장된 데이터를 캐시에서 조회
      const candleEntity = await this.candle15MRepository.findByOpenTime(
        symbol,
        'FUTURES',
        candleData.openTime,
      );
      if (candleEntity) {
        this.latestCandles.set(symbol, candleEntity);
      }
    } else if (existing.openTime.getTime() === candleData.openTime) {
      // 같은 시간의 캔들 업데이트 - 이미 저장된 데이터를 캐시에서 조회
      const candleEntity = await this.candle15MRepository.findByOpenTime(
        symbol,
        'FUTURES',
        candleData.openTime,
      );
      if (candleEntity) {
        this.latestCandles.set(symbol, candleEntity);
      }
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

      // 완성 이벤트 발생 (공통 DTO 적용)
      const candleCompletedEvent: CandleCompletedEvent = {
        eventId: `${symbol}-${ongoingCandle.openTime}`,
        service: 'Candle15MService',
        symbol,
        market: 'FUTURES',
        timeframe: '15m',
        candle: ongoingCandle,
        timestamp: new Date(),
      };
      this.eventEmitter.emit('candle.completed', candleCompletedEvent);

      console.log(
        `[Candle15MService] 캔들 완성 이벤트 트리거: ${symbol} - ${new Date(ongoingCandle.openTime).toISOString()}`,
      );
    }
  }

  /**
   * 🔍 새로운 캔들 시작 여부 확인
   *
   * ⚠️ **핵심 로직**: 15분 간격으로 새로운 캔들이 시작되는 순간을 감지합니다.
   *
   * 📝 **동작 원리**:
   * 1. 메모리 캐시에 저장된 이전 캔들의 openTime과 현재 캔들의 openTime을 비교
   * 2. openTime이 다르면 새로운 15분봉이 시작된 것으로 판단
   * 3. 첫 번째 캔들(캐시에 없음)도 새로운 캔들로 처리
   *
   * 🎯 **목적**: 새로운 캔들일 때만 기술적 분석과 알림을 트리거하여
   *           진행 중인 캔들의 지속적인 업데이트로 인한 불필요한 처리 방지
   *
   * @param symbol 거래 심볼
   * @param candleData 현재 캔들 데이터
   * @returns 새로운 캔들 시작 여부
   */
  private async checkIfNewCandle(
    symbol: string,
    candleData: CandleData,
  ): Promise<boolean> {
    const existingCandle = this.latestCandles.get(symbol);

    // 첫 번째 캔들이거나 메모리 캐시에 없는 경우
    if (!existingCandle) {
      console.log(
        `🆕 [NewCandle] 첫 번째 캔들 감지: ${symbol} - ${new Date(candleData.openTime).toISOString()}`,
      );
      return true;
    }

    // 시작 시간이 다르면 새로운 캔들 (15분 간격으로 openTime이 변경됨)
    const isNew = existingCandle.openTime.getTime() !== candleData.openTime;

    if (isNew) {
      console.log(`🆕 [NewCandle] 새로운 15분봉 감지: ${symbol}`);
      console.log(`   ├─ 이전 캔들: ${existingCandle.openTime.toISOString()}`);
      console.log(
        `   └─ 새 캔들:   ${new Date(candleData.openTime).toISOString()}`,
      );
      console.log(`   🔥 기술적 분석 및 알림 트리거 예정!`);
    }

    return isNew;
  }

  /**
   * 기술적 분석 수행 및 텔레그램 알림
   *
   * @param symbol 분석할 심볼
   */
  /**
   * 📤 이벤트 발송기 노출 (다른 도메인에서 이벤트 수신용)
   *
   * Technical-analysis 도메인에서 candle.saved 이벤트를
   * 수신할 수 있도록 EventEmitter를 노출합니다.
   */
  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }

  /**
   * 📊 서비스 상태 조회
   *
   * 현재 구독 중인 심볼들과 연결 상태를 반환합니다.
   */
  getServiceStatus(): {
    subscribedSymbols: string[];
    connectionStatus: Map<string, boolean>;
    cacheSize: number;
    ongoingCandlesCount: number;
  } {
    return {
      subscribedSymbols: this.manager.getSubscribed(),
      connectionStatus: this.manager.getConnectionStatus(),
      cacheSize: this.latestCandles.size,
      ongoingCandlesCount: this.ongoingCandles.size,
    };
  }

  /**
   * 🧪 테스트용 캔들 데이터 처리
   *
   * 테스트 환경에서 가짜 캔들 데이터를 처리하여 이벤트 체인을 시작합니다.
   * 실제 웹소켓 데이터와 동일한 플로우로 처리됩니다.
   *
   * @param symbol 거래 심볼
   * @param candleData 테스트용 캔들 데이터
   * @returns 처리 결과
   */
  async processTestCandle(
    symbol: string,
    candleData: CandleData,
  ): Promise<{
    success: boolean;
    savedCandle?: Candle15MEntity;
    eventEmitted?: boolean;
    error?: string;
  }> {
    try {
      console.log(`🧪 [Candle15MService] 테스트 캔들 처리 시작: ${symbol}`);

      // 🔍 새로운 캔들 여부 확인 (메모리 캐시 업데이트 전에 검사)
      const isNewCandle = await this.checkIfNewCandle(symbol, candleData);

      // 진행 중인 캔들 데이터 업데이트
      this.ongoingCandles.set(symbol, candleData);

      // 📊 데이터베이스에 저장
      const savedCandle = await this.candle15MRepository.saveCandle(
        symbol,
        'FUTURES',
        candleData,
      );

      // 메모리 캐시 업데이트 (새로운 캔들 검사 후)
      await this.updateMemoryCache(symbol, candleData);

      // 📡 캔들 저장 완료 이벤트 발송 (새로운 캔들일 때만 기술적 분석/알림 트리거)
      if (isNewCandle) {
        await this.emitCandleSavedEvent(
          symbol,
          candleData,
          savedCandle,
          isNewCandle,
        );
      }

      console.log(`✅ [Candle15MService] 테스트 캔들 처리 완료: ${symbol}`);

      return {
        success: true,
        savedCandle,
        eventEmitted: true,
      };
    } catch (error) {
      console.error(
        `❌ [Candle15MService] 테스트 캔들 처리 실패: ${symbol}`,
        error,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
