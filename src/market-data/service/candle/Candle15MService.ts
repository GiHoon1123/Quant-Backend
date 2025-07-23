import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { BinanceWebSocketClient } from '../../../common/binance/BinanceWebSocketClient';
import { CandleCompletedEvent } from '../../../common/dto/event/CandleCompletedEvent';
import { HealthCheckEvent } from '../../../common/dto/event/HealthCheckEvent';
import marketDataConfig from '../../../config/MarketDataConfig';
import {
  Candle15MEntity,
  CandleData,
} from '../../infra/persistence/entity/Candle15MEntity';
import { Candle15MRepository } from '../../infra/persistence/repository/Candle15MRepository';
import {
  CandleSavedEvent,
  MARKET_DATA_EVENTS,
} from '../../types/MarketDataEvents';

/**
 * 통합된 15분봉 캔들 데이터 서비스
 *
 * 바이낸스 웹소켓에서 선물 15분봉 데이터를 실시간으로 수신하여
 * 메모리 캐시와 데이터베이스에 저장하는 통합 서비스입니다.
 *
 * 🔄 **기존 Realtime15MinAggregator + Candle15MService 통합**
 * - 실시간 데이터 수집 및 처리 (Realtime15MinAggregator)
 * - 동적 심볼 구독 관리 (기존 Candle15MService)
 * - 호환성 API 제공 (기존 Candle15MService)
 *
 * 주요 기능:
 * - 바이낸스 선물 15분봉 웹소켓 구독 및 관리
 * - 실시간 데이터 파싱 및 검증 (ExternalCandleResponse 지원)
 * - 메모리 캐시 관리 (빠른 조회용)
 * - 데이터베이스 영구 저장 (백테스팅용)
 * - 다양한 이벤트 발생 (캔들 완성, 특별 이벤트)
 * - 자동 복구 및 장애 대응
 * - 성능 모니터링 및 상태 추적
 * - 동적 심볼 구독/해제
 *
 * 설계 원칙:
 * - 메모리 우선: 실시간 조회는 메모리 캐시에서
 * - DB 백업: 영구 보존 및 복구를 위한 데이터베이스 저장
 * - 이벤트 드리븐: 캔들 완성 시 분석 시스템 자동 트리거
 * - 장애 대응: 웹소켓 재연결, DB 실패 시 메모리 유지
 * - 확장성: 새로운 심볼 쉽게 추가 가능
 * - 호환성: 기존 Candle15MService API 완벽 지원
 */
@Injectable()
export class Candle15MService implements OnModuleInit, OnModuleDestroy {
  /**
   * 모니터링 대상 심볼 목록
   *
   * 선물 거래에서 주로 사용되는 주요 암호화폐 심볼들입니다.
   * 시장 점유율과 거래량을 고려하여 선정된 대표 심볼들이며,
   * 설정 파일이나 환경 변수를 통해 동적 관리 가능합니다.
   */
  private readonly MONITORED_SYMBOLS: string[];

  /**
   * 메모리 캔들 캐시
   *
   * 실시간 조회 성능을 위해 최근 캔들 데이터를 메모리에 저장합니다.
   *
   * Key 형식: `${symbol}_${market}` (예: 'BTCUSDT_FUTURES')
   * Value: 시간 순으로 정렬된 캔들 데이터 배열
   *
   * 특징:
   * - 최근 MAX_MEMORY_CANDLES 개수만 유지 (메모리 최적화)
   * - 실시간 업데이트 (진행 중인 캔들 포함)
   * - 빠른 조회 (O(1) 접근, O(n) 슬라이싱)
   */
  private readonly memoryCandles = new Map<string, CandleData[]>();

  /**
   * 최신 캔들 엔티티 캐시 (Candle15MService 호환성)
   *
   * 각 심볼의 최신 완성된 캔들을 Candle15MEntity 형태로 저장합니다.
   * 기존 Candle15MService API와의 호환성을 위해 추가되었습니다.
   */
  private readonly latestCandles = new Map<string, Candle15MEntity>();

  /**
   * 심볼별 첫 번째 캔들 로그 여부
   */
  private readonly firstCandleLogged = new Map<string, boolean>();

  /**
   * 진행 중인 캔들 데이터 (Candle15MService 호환성)
   *
   * 아직 완성되지 않은 현재 진행 중인 캔들 데이터를 저장합니다.
   */
  private readonly ongoingCandles = new Map<string, CandleData>();

  /**
   * 웹소켓 연결 상태 추적 맵
   *
   * 각 심볼별 웹소켓 연결 상태를 추적하여 장애 상황을 모니터링합니다.
   *
   * Key: symbol (예: 'BTCUSDT')
   * Value: 연결 상태 (true: 연결됨, false: 끊어짐)
   */
  private readonly connectionStatus = new Map<string, boolean>();

  /**
   * 마지막 수신 시간 추적 맵
   *
   * 각 심볼별로 마지막으로 데이터를 수신한 시간을 추적합니다.
   * 데이터 스트림 중단 감지 및 재연결 판단에 사용됩니다.
   */
  private readonly lastReceivedTime = new Map<string, number>();

  /**
   * 서비스 실행 상태 플래그
   */
  private isRunning = false;

  /**
   * 재시작 시도 횟수 제한
   */
  private readonly MAX_RESTART_ATTEMPTS = 3;

  /**
   * 메모리 캐시 최대 크기 (심볼당)
   *
   * 각 심볼별로 메모리에 유지할 최대 캔들 개수입니다.
   * 기술적 분석에 필요한 데이터를 충분히 제공하면서도
   * 메모리 사용량을 적절히 제한합니다.
   *
   * 고려사항:
   * - 너무 크면 메모리 사용량 증가
   * - 너무 작으면 분석용 데이터 부족
   * - 일반적인 기술적 지표는 50-200개 캔들로 계산 가능
   */
  private readonly MAX_MEMORY_CANDLES: number;

  /**
   * 웹소켓 재연결 간격 (밀리초)
   */
  private readonly RECONNECT_INTERVAL: number;

  /**
   * 헬스체크 간격 (밀리초)
   */
  private readonly HEALTH_CHECK_INTERVAL: number;

  /**
   * 헬스체크 타이머 ID
   */
  private healthCheckTimer?: NodeJS.Timeout;

  private readonly logger = new Logger(Candle15MService.name);

  constructor(
    private readonly wsClient: BinanceWebSocketClient,
    private readonly candleRepository: Candle15MRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    this.logger.log('🚀 Candle15MService 서비스 생성 완료');
    // 환경설정 적용
    this.MONITORED_SYMBOLS = this.configService.get<string[]>(
      'marketData.monitoredSymbols',
      marketDataConfig.monitoredSymbols,
    );
    this.MAX_MEMORY_CANDLES = this.configService.get<number>(
      'marketData.maxMemoryCandles',
      marketDataConfig.maxMemoryCandles,
    );
    this.RECONNECT_INTERVAL = this.configService.get<number>(
      'marketData.reconnectInterval',
      marketDataConfig.reconnectInterval,
    );
    this.HEALTH_CHECK_INTERVAL = this.configService.get<number>(
      'marketData.healthCheckInterval',
      marketDataConfig.healthCheckInterval,
    );
  }

  /**
   * 모듈 초기화 시 자동 실행
   *
   * NestJS 애플리케이션 시작 시 자동으로 호출되어
   * 실시간 모니터링을 시작합니다.
   *
   * 초기화 과정:
   * 1. 기존 데이터 로드 (서버 재시작 시 메모리 복구)
   * 2. 웹소켓 연결 및 구독 시작
   * 3. 헬스체크 타이머 시작
   * 4. 상태 모니터링 시작
   */
  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('🚀 Candle15MService 모듈 초기화 시작');

      // 1. 기존 데이터를 메모리에 로드 (서버 재시작 시 복구)
      await this.loadRecentDataToMemory();

      // 2. 실시간 모니터링 시작
      await this.startMonitoring();

      // 3. 헬스체크 시작
      this.startHealthCheck();

      this.logger.log('✅ Candle15MService 초기화 완료');

      // 초기화 완료 이벤트 발생
      this.eventEmitter.emit('aggregator.initialized', {
        eventId: uuidv4(),
        service: 'Candle15MService',
        symbolCount: this.MONITORED_SYMBOLS.length,
        memoryDataLoaded: this.memoryCandles.size,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('❌ Candle15MService 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 모듈 종료 시 정리 작업
   *
   * 애플리케이션 종료 시 웹소켓 연결을 정리하고
   * 리소스를 해제합니다.
   */
  async onModuleDestroy(): Promise<void> {
    try {
      this.logger.log('🛑 Candle15MService 종료 시작');

      this.isRunning = false;

      // 헬스체크 타이머 정리
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = undefined;
      }

      // 웹소켓 연결 정리
      for (const symbol of this.MONITORED_SYMBOLS) {
        try {
          // TODO: 실제 웹소켓 구독 해제 로직 필요
          this.logger.log(`📡 ${symbol} 웹소켓 구독 해제`);
          this.connectionStatus.set(symbol, false);
        } catch (error) {
          this.logger.error(`❌ ${symbol} 웹소켓 해제 실패:`, error.message);
        }
      }

      // 종료 이벤트 발생
      this.eventEmitter.emit('aggregator.destroyed', {
        eventId: uuidv4(),
        service: 'Candle15MService',
        timestamp: new Date(),
      });

      this.logger.log('✅ Candle15MService 종료 완료');
    } catch (error) {
      this.logger.error('❌ Candle15MService 종료 중 오류:', error);
    }
  }

  /**
   * 실시간 모니터링 시작
   *
   * 모든 대상 심볼의 선물 15분봉 웹소켓을 구독하여
   * 실시간 데이터 수집을 시작합니다.
   *
   * 구독 과정:
   * 1. 각 심볼별로 웹소켓 구독 시도
   * 2. 연결 상태 추적 시작
   * 3. 실패한 심볼은 재시도 스케줄링
   * 4. 성공 통계 로깅
   *
   * @throws Error 모든 웹소켓 구독에 실패한 경우
   */
  async startMonitoring(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('⚠️ 실시간 모니터링이 이미 실행 중입니다.');
      return;
    }

    this.logger.log('🚀 선물 15분봉 실시간 모니터링 시작');
    this.logger.log(
      `📊 모니터링 대상: ${this.MONITORED_SYMBOLS.length}개 심볼`,
    );
    this.logger.log(`📋 대상 심볼: ${this.MONITORED_SYMBOLS.join(', ')}`);

    this.isRunning = true;
    let successCount = 0;
    let failureCount = 0;

    // 각 심볼에 대해 웹소켓 구독 시작
    for (const symbol of this.MONITORED_SYMBOLS) {
      try {
        this.logger.log(`📡 ${symbol} 선물 15분봉 웹소켓 구독 시도...`);

        // 바이낸스 선물 15분봉 웹소켓 구독
        await this.wsClient.subscribeKline(
          symbol,
          '15m',
          (klineData) => this.handleFuturesKline(symbol, klineData),
          true, // 선물 시장 (futures = true)
        );

        // 연결 상태 및 수신 시간 업데이트
        this.connectionStatus.set(symbol, true);
        this.lastReceivedTime.set(symbol, Date.now());
        successCount++;

        this.logger.log(`✅ ${symbol} 선물 15분봉 구독 완료`);

        // 구독 간 간격 (API 제한 방지)
        await this.sleep(100);
      } catch (error) {
        this.logger.error(`❌ ${symbol} 웹소켓 구독 실패:`, error.message);
        this.connectionStatus.set(symbol, false);
        failureCount++;

        // 개별 심볼 실패가 전체를 막지 않도록 처리
        continue;
      }
    }

    // 구독 결과 로깅
    this.logger.log(
      `📊 웹소켓 구독 완료: 성공 ${successCount}개, 실패 ${failureCount}개`,
    );

    if (successCount === 0) {
      this.isRunning = false;
      throw new Error(
        '모든 웹소켓 구독에 실패했습니다. 네트워크 연결을 확인해주세요.',
      );
    }

    // 모니터링 시작 이벤트 발생
    this.eventEmitter.emit('aggregator.monitoring.started', {
      eventId: uuidv4(),
      service: 'Candle15MService',
      totalSymbols: this.MONITORED_SYMBOLS.length,
      successCount,
      failureCount,
      timestamp: new Date(),
    });

    this.logger.log('🎯 실시간 15분봉 데이터 수집 시작!');
  }

  /**
   * 서버 재시작 시 최근 데이터를 메모리에 로드
   *
   * 데이터베이스에서 각 심볼의 최근 캔들 데이터를 조회하여
   * 메모리 캐시를 초기화합니다. 이를 통해 서버 재시작 후에도
   * 즉시 기술적 분석이 가능한 상태를 만듭니다.
   *
   * 로드 과정:
   * 1. 각 심볼별로 최근 캔들 데이터 조회
   * 2. 메모리 캐시에 저장
   * 3. 로드 통계 로깅
   * 4. 실패한 심볼은 새로운 데이터 수집으로 대체
   */
  private async loadRecentDataToMemory(): Promise<void> {
    const loadStartTime = Date.now();
    this.logger.log('💾 데이터베이스에서 최근 캔들 데이터 로딩 시작');

    let loadedSymbols = 0;
    let totalCandles = 0;

    for (const symbol of this.MONITORED_SYMBOLS) {
      try {
        // DB에서 최근 캔들 데이터 조회 (선물 시장만)
        const recentCandles = await this.candleRepository.findLatestCandles(
          symbol,
          'FUTURES',
          this.MAX_MEMORY_CANDLES,
        );

        if (recentCandles.length > 0) {
          const cacheKey = `${symbol}_FUTURES`;
          this.memoryCandles.set(cacheKey, recentCandles);
          loadedSymbols++;
          totalCandles += recentCandles.length;

          const latestTime = new Date(
            recentCandles[recentCandles.length - 1].openTime,
          );
          this.logger.log(
            `📊 ${symbol} 메모리 로딩 완료: ${recentCandles.length}개 캔들 (최신: ${latestTime.toISOString()})`,
          );
        } else {
          this.logger.log(
            `ℹ️ ${symbol} 기존 데이터 없음 - 실시간 수집부터 시작`,
          );
        }
      } catch (error) {
        this.logger.error(`❌ ${symbol} 메모리 로딩 실패:`, error.message);
        // 개별 심볼 실패가 전체를 막지 않도록 처리
        continue;
      }
    }

    const loadDuration = Date.now() - loadStartTime;
    this.logger.log(
      `✅ 메모리 캔들 데이터 로딩 완료: ${loadedSymbols}개 심볼, ${totalCandles.toLocaleString()}개 캔들 (${loadDuration}ms)`,
    );

    // 메모리 로드 완료 이벤트 발생
    this.eventEmitter.emit('aggregator.memory.loaded', {
      eventId: uuidv4(),
      service: 'Candle15MService',
      loadedSymbols,
      totalCandles,
      duration: loadDuration,
      timestamp: new Date(),
    });
  }

  /**
   * 선물 15분봉 데이터 처리 핸들러
   *
   * 바이낸스 웹소켓에서 수신한 선물 15분봉 데이터를 처리합니다.
   * 이 메서드는 웹소켓 콜백으로 호출되며, 실시간 데이터 처리의 핵심입니다.
   *
   * 처리 과정:
   * 1. 웹소켓 데이터 파싱 및 검증
   * 2. 메모리 캐시 업데이트 (실시간 조회용)
   * 3. 캔들 완성 시 DB 저장 및 이벤트 발생
   * 4. 연결 상태 및 수신 시간 업데이트
   * 5. 에러 처리 및 재연결 로직
   *
   * @param symbol 거래 심볼
   * @param klineData 바이낸스 웹소켓 원시 데이터
   */
  private async handleFuturesKline(
    symbol: string,
    klineData: any,
  ): Promise<void> {
    try {
      // 수신 시간 업데이트 (헬스체크용)
      this.lastReceivedTime.set(symbol, Date.now());
      this.connectionStatus.set(symbol, true);

      // 웹소켓 데이터 파싱 및 검증
      const candleData = this.parseKlineData(klineData);
      if (!candleData) {
        this.logger.warn(
          `⚠️ [${symbol}] 캔들 데이터 파싱 실패 - 무효한 데이터`,
        );
        return;
      }

      const cacheKey = `${symbol}_FUTURES`;
      const isCompleted = klineData.k?.x === true; // 캔들 완성 여부

      // 1. 메모리 캐시 업데이트 (항상 실행 - 실시간 조회용)
      this.updateMemoryCache(cacheKey, candleData);

      // 2. 새로운 캔들 여부 확인 (Candle15MService 호환)
      const isNewCandle = await this.checkIfNewCandle(symbol, candleData);

      // 3. 최신 캔들 엔티티 캐시 업데이트 (Candle15MService 호환)
      await this.updateLatestCandleCache(symbol, candleData);

      if (isCompleted) {
        // 4. 캔들 완성 시에만 실행되는 로직
        const candleTime = new Date(candleData.openTime).toLocaleString(
          'ko-KR',
        );
        this.logger.log(
          `🕐 [${symbol}] 15분봉 완성: ${candleTime} (종가: $${candleData.close.toFixed(2)})`,
        );

        // 4-1. 데이터베이스에 영구 저장 (비동기 처리로 성능 최적화)
        // 이 메서드에서 candle.saved 이벤트가 발생하여 기술적 분석이 트리거됩니다
        this.saveToDatabaseAsync(symbol, candleData, isNewCandle);

        // 4-2. 캔들 완성 이벤트 발생 (추가 분석용, 기술적 분석 트리거는 하지 않음)
        // 중복 알림 방지를 위해 candle.saved 이벤트만 기술적 분석을 트리거하도록 수정
        this.emitCandleCompletedEvent(symbol, candleData);
      } else {
        // 진행 중인 캔들 (실시간 업데이트)
        // 30초마다 한 번씩만 로깅 (로그 스팸 방지)
        const now = Date.now();
        const lastLogKey = `${symbol}_lastLog`;
        const lastLogTime = (this as any)[lastLogKey] || 0;

        if (now - lastLogTime > 30000) {
          this.logger.log(
            `📊 [${symbol}] 15분봉 업데이트: $${candleData.close.toFixed(2)} (거래량: ${candleData.volume.toFixed(2)})`,
          );
          (this as any)[lastLogKey] = now;
        }
      }
    } catch (error) {
      this.logger.error(`❌ [${symbol}] 캔들 처리 실패:`, error.message);

      // 연결 상태 업데이트 (에러 발생 시)
      this.connectionStatus.set(symbol, false);

      // 심각한 에러가 지속되면 재연결 시도
      this.scheduleReconnect(symbol);
    }
  }

  /**
   * 바이낸스 웹소켓 원시 데이터를 캔들 데이터로 파싱
   *
   * 바이낸스 API의 kline 데이터 형식을 우리 시스템의
   * CandleData 형식으로 변환하고 유효성을 검증합니다.
   *
   * ExternalCandleResponse DTO를 활용하여 구조화된 데이터 처리를 지원합니다.
   *
   * @param klineData 바이낸스 웹소켓 원시 데이터 또는 ExternalCandleResponse
   * @returns 파싱된 캔들 데이터 또는 null (실패 시)
   */
  private parseKlineData(klineData: any): CandleData | null {
    try {
      // ExternalCandleResponse 형태로 변환 (기존 Candle15MService 호환성)
      let k: any;

      if (klineData.k) {
        // 이미 ExternalCandleResponse 형태인 경우
        k = klineData.k;
      } else if (klineData.t && klineData.o) {
        // 바이낸스 원시 kline 데이터인 경우
        k = klineData;
      } else {
        this.logger.warn(
          '⚠️ 알 수 없는 데이터 형식:',
          JSON.stringify(klineData),
        );
        return null;
      }

      // 필수 필드 존재 여부 검증
      const requiredFields = ['t', 'T', 'o', 'h', 'l', 'c', 'v', 'q', 'V', 'Q'];
      for (const field of requiredFields) {
        if (k[field] === undefined || k[field] === null) {
          this.logger.warn(`⚠️ 필수 필드 누락: ${field}`);
          return null;
        }
      }

      // CandleData 형식으로 변환
      const candleData: CandleData = {
        openTime: parseInt(k.t), // 캔들 시작 시간 (Unix timestamp)
        closeTime: parseInt(k.T), // 캔들 종료 시간 (Unix timestamp)
        open: parseFloat(k.o), // 시가
        high: parseFloat(k.h), // 고가
        low: parseFloat(k.l), // 저가
        close: parseFloat(k.c), // 종가
        volume: parseFloat(k.v), // 거래량
        quoteVolume: parseFloat(k.q), // 거래대금
        trades: parseInt(k.n) || 0, // 거래 횟수 (기본값 0)
        takerBuyBaseVolume: parseFloat(k.V), // 능동 매수 거래량
        takerBuyQuoteVolume: parseFloat(k.Q), // 능동 매수 거래대금
      };

      // 숫자 데이터 유효성 검증
      if (
        isNaN(candleData.open) ||
        isNaN(candleData.high) ||
        isNaN(candleData.low) ||
        isNaN(candleData.close)
      ) {
        this.logger.warn('⚠️ 유효하지 않은 가격 데이터:', candleData);
        return null;
      }

      // 가격 데이터 논리 검증
      if (
        candleData.open <= 0 ||
        candleData.high <= 0 ||
        candleData.low <= 0 ||
        candleData.close <= 0
      ) {
        this.logger.warn('⚠️ 가격은 0보다 커야 합니다:', candleData);
        return null;
      }

      // OHLC 논리 검증
      if (
        candleData.high < Math.max(candleData.open, candleData.close) ||
        candleData.low > Math.min(candleData.open, candleData.close)
      ) {
        this.logger.warn('⚠️ OHLC 데이터 논리 오류:', candleData);
        return null;
      }

      // 거래량 유효성 검증
      if (
        candleData.volume < 0 ||
        candleData.quoteVolume < 0 ||
        candleData.trades < 0
      ) {
        this.logger.warn('⚠️ 거래량 데이터는 0 이상이어야 합니다:', candleData);
        return null;
      }

      return candleData;
    } catch (error) {
      this.logger.error('❌ 캔들 데이터 파싱 실패:', error.message);
      return null;
    }
  }

  /**
   * 메모리 캐시 업데이트
   *
   * 새로운 캔들 데이터를 메모리 캐시에 추가하거나 업데이트합니다.
   * 진행 중인 캔들은 기존 데이터를 업데이트하고,
   * 새로운 캔들은 배열에 추가됩니다.
   *
   * 메모리 관리:
   * - 최근 MAX_MEMORY_CANDLES 개수만 유지
   * - 오래된 데이터 자동 삭제
   * - 실시간 업데이트 지원
   *
   * @param cacheKey 캐시 키 (예: 'BTCUSDT_FUTURES')
   * @param newCandle 새로운 캔들 데이터
   */
  private updateMemoryCache(cacheKey: string, newCandle: CandleData): void {
    try {
      // 기존 캐시 조회 또는 새 배열 생성
      let candles = this.memoryCandles.get(cacheKey) || [];

      // 마지막 캔들과 시간 비교
      const lastCandle = candles[candles.length - 1];

      if (lastCandle && lastCandle.openTime === newCandle.openTime) {
        // 같은 시간의 캔들이면 업데이트 (진행 중인 캔들)
        candles[candles.length - 1] = { ...newCandle };
        // console.log(`🔄 [${cacheKey}] 메모리 캐시 업데이트: 진행 중인 캔들`);
      } else {
        // 새로운 시간의 캔들이면 추가
        candles.push({ ...newCandle });
        // 새로운 캔들 추가는 중요한 이벤트이므로 로깅 유지
        this.logger.log(
          `➕ [${cacheKey}] 메모리 캐시 추가: 새로운 캔들 (총 ${candles.length}개)`,
        );
      }

      // 메모리 사용량 최적화: 최근 N개만 유지
      if (candles.length > this.MAX_MEMORY_CANDLES) {
        const removedCount = candles.length - this.MAX_MEMORY_CANDLES;
        candles = candles.slice(-this.MAX_MEMORY_CANDLES);
        // 메모리 정리는 가끔 발생하므로 로깅 유지
        this.logger.log(
          `🗑️ [${cacheKey}] 오래된 캔들 ${removedCount}개 메모리에서 제거 (현재: ${candles.length}개)`,
        );
      }

      // 업데이트된 캐시 저장
      this.memoryCandles.set(cacheKey, candles);
    } catch (error) {
      this.logger.error(
        `❌ [${cacheKey}] 메모리 캐시 업데이트 실패:`,
        error.message,
      );
    }
  }

  /**
   * 데이터베이스에 비동기 저장
   *
   * 완성된 캔들을 데이터베이스에 비동기로 저장합니다.
   * 메인 스레드를 블록하지 않도록 Promise를 사용하여 처리합니다.
   *
   * 특징:
   * - 메인 프로세스 블록하지 않음
   * - DB 실패 시 메모리 캐시 유지
   * - 자세한 에러 로깅
   * - 성공/실패 통계 수집
   * - Candle15MService 호환 이벤트 발송
   *
   * @param symbol 거래 심볼
   * @param candleData 저장할 캔들 데이터
   * @param isNewCandle 새로운 캔들 여부 (Candle15MService 호환)
   */
  private saveToDatabaseAsync(
    symbol: string,
    candleData: CandleData,
    isNewCandle?: boolean,
  ): void {
    // Promise로 감싸서 메인 스레드 블록 방지
    this.candleRepository
      .saveCandle(symbol, 'FUTURES', candleData)
      .then(async (savedCandle) => {
        const candleTime = new Date(candleData.openTime).toLocaleString(
          'ko-KR',
        );
        this.logger.log(
          `💾 [${symbol}] DB 저장 완료: ${candleTime} (ID: ${savedCandle.id})`,
        );

        // Candle15MService 호환 이벤트 발송 (중복 방지)
        if (isNewCandle) {
          await this.emitCandleSavedEvent(
            symbol,
            candleData,
            savedCandle,
            isNewCandle,
          );
        }
        // 기존 candle.saved 이벤트는 emitCandleSavedEvent에서만 발행
      })
      .catch((error) => {
        this.logger.error(
          `❌ [${symbol}] DB 저장 실패 (메모리 캐시는 유지됨):`,
          error.message,
        );

        // DB 저장 실패 이벤트
        this.eventEmitter.emit('candle.save.failed', {
          symbol,
          market: 'FUTURES',
          error: error.message,
          openTime: candleData.openTime,
        });
      });
  }

  /**
   * 캔들 완성 이벤트 발생
   *
   * 15분봉이 완성되었을 때 이벤트를 발생시켜
   * 기술적 분석 시스템이나 알림 시스템을 트리거합니다.
   *
   * 발생하는 이벤트:
   * - candle.15m.completed: 일반적인 캔들 완성
   * - candle.high.volume: 높은 거래량 감지
   * - candle.price.spike: 급격한 가격 변동 감지
   *
   * @param symbol 거래 심볼
   * @param candleData 완성된 캔들 데이터
   */
  private emitCandleCompletedEvent(
    symbol: string,
    candleData: CandleData,
  ): void {
    try {
      const eventId = uuidv4();
      const eventData: CandleCompletedEvent = {
        eventId,
        service: 'Candle15MService',
        symbol,
        market: 'FUTURES',
        timeframe: '15m',
        candle: candleData,
        timestamp: new Date(),
      };

      // 기본 캔들 완성 이벤트
      this.eventEmitter.emit('candle.15m.completed', eventData);

      this.logger.log(
        `🎯 [${symbol}] 캔들 완성 이벤트 발생: ${new Date(candleData.openTime).toISOString()} (eventId: ${eventId})`,
      );
    } catch (error) {
      this.logger.error(
        `❌ [${symbol}] 캔들 완성 이벤트 발생 실패:`,
        error.message,
      );
    }
  }

  // ...existing code...

  /**
   * 헬스체크 시작
   *
   * 주기적으로 시스템 상태를 점검하고 문제를 감지합니다.
   * 점검 항목:
   * - 웹소켓 연결 상태
   * - 데이터 수신 상태
   * - 메모리 사용량
   * - 데이터베이스 연결
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);

    this.logger.log(
      `💊 헬스체크 시작: ${this.HEALTH_CHECK_INTERVAL / 1000}초 간격`,
    );
  }

  /**
   * 헬스체크 수행
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const now = Date.now();
      const healthStatus: HealthCheckEvent = {
        timestamp: new Date(),
        connectedSymbols: 0,
        disconnectedSymbols: 0,
        staleConnections: 0,
        memoryUsage: this.getMemoryUsage(),
        dbConnected: false,
      };

      // 연결 상태 점검
      for (const symbol of this.MONITORED_SYMBOLS) {
        const isConnected = this.connectionStatus.get(symbol) || false;
        const lastReceived = this.lastReceivedTime.get(symbol) || 0;
        const timeSinceLastData = now - lastReceived;

        if (isConnected && timeSinceLastData < 5 * 60 * 1000) {
          // 5분 이내
          healthStatus.connectedSymbols++;
        } else if (timeSinceLastData > 10 * 60 * 1000) {
          // 10분 이상
          healthStatus.staleConnections++;
          this.logger.warn(
            `⚠️ [${symbol}] 데이터 수신 중단: ${Math.round(timeSinceLastData / 1000 / 60)}분 전`,
          );
        } else {
          healthStatus.disconnectedSymbols++;
        }
      }

      // 데이터베이스 연결 점검
      healthStatus.dbConnected = await this.candleRepository.checkHealth();

      // 헬스체크 결과 이벤트 발생
      this.eventEmitter.emit('aggregator.health.check', {
        eventId: uuidv4(),
        service: 'Candle15MService',
        ...healthStatus,
        timestamp: new Date(),
      } as HealthCheckEvent);

      // 경고 상황 로깅
      if (
        healthStatus.disconnectedSymbols > 0 ||
        healthStatus.staleConnections > 0
      ) {
        this.logger.warn(
          `⚠️ 헬스체크 경고: 연결됨 ${healthStatus.connectedSymbols}, 끊어짐 ${healthStatus.disconnectedSymbols}, 정체됨 ${healthStatus.staleConnections}`,
        );
      } else {
        this.logger.log(
          `💊 헬스체크 정상: ${healthStatus.connectedSymbols}개 심볼 연결 상태 양호`,
        );
      }
    } catch (error) {
      this.logger.error('❌ 헬스체크 수행 실패:', error.message);
    }
  }

  /**
   * 메모리 사용량 조회
   */
  private getMemoryUsage(): { totalCandles: number; memoryMB: number } {
    let totalCandles = 0;
    for (const candles of this.memoryCandles.values()) {
      totalCandles += candles.length;
    }

    // 대략적인 메모리 사용량 추정 (캔들당 약 200바이트)
    const estimatedMemoryMB = (totalCandles * 200) / 1024 / 1024;

    return {
      totalCandles,
      memoryMB: Number(estimatedMemoryMB.toFixed(2)),
    };
  }

  /**
   * 재연결 스케줄링
   *
   * 특정 심볼의 연결 문제 발생 시 재연결을 스케줄링합니다.
   *
   * @param symbol 재연결할 심볼
   */
  private scheduleReconnect(symbol: string): void {
    setTimeout(async () => {
      if (!this.isRunning) return;

      try {
        this.logger.log(`🔄 [${symbol}] 웹소켓 재연결 시도...`);

        await this.wsClient.subscribeKline(
          symbol,
          '15m',
          (klineData) => this.handleFuturesKline(symbol, klineData),
          true,
        );

        this.connectionStatus.set(symbol, true);
        this.lastReceivedTime.set(symbol, Date.now());

        this.logger.log(`✅ [${symbol}] 웹소켓 재연결 성공`);
      } catch (error) {
        this.logger.error(`❌ [${symbol}] 웹소켓 재연결 실패:`, error.message);

        // 재시도 제한 체크 후 다시 스케줄링
        this.scheduleReconnect(symbol);
      }
    }, this.RECONNECT_INTERVAL);
  }

  /**
   * 메모리에서 캔들 데이터 조회 (외부 API)
   *
   * 다른 서비스에서 실시간 캔들 데이터를 조회할 수 있는 공개 메서드입니다.
   * 메모리 캐시에서 즉시 데이터를 반환하므로 매우 빠릅니다.
   *
   * @param symbol 거래 심볼
   * @param market 시장 구분
   * @param limit 조회할 캔들 개수 (기본값: 100)
   * @returns 메모리에 캐시된 캔들 데이터 배열
   *
   * @example
   * ```typescript
   * // 기술적 분석 서비스에서 사용
   * const candles = aggregator.getMemoryCandles('BTCUSDT', 'FUTURES', 50);
   * const rsi = technicalAnalysis.calculateRSI(candles);
   * ```
   */
  getMemoryCandles(
    symbol: string,
    market: 'FUTURES' | 'SPOT',
    limit: number = 100,
  ): CandleData[] {
    const cacheKey = `${symbol}_${market}`;
    const candles = this.memoryCandles.get(cacheKey) || [];

    // 요청된 개수만큼 최근 데이터 반환
    const result = candles.slice(-limit);

    this.logger.log(
      `🔍 [${symbol}_${market}] 메모리 캔들 조회: ${result.length}개 (요청: ${limit}개)`,
    );
    return result;
  }

  /**
   * 현재 연결 상태 조회 (외부 API)
   *
   * 각 심볼의 웹소켓 연결 상태를 조회할 수 있는 공개 메서드입니다.
   *
   * @returns 심볼별 연결 상태 맵
   */
  getConnectionStatus(): Map<string, boolean> {
    return new Map(this.connectionStatus);
  }

  /**
   * 서비스 실행 상태 조회 (외부 API)
   *
   * @returns 현재 서비스 실행 상태
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 모니터링 대상 심볼 목록 조회 (외부 API)
   *
   * @returns 현재 모니터링 중인 심볼 목록
   */
  getMonitoredSymbols(): string[] {
    return [...this.MONITORED_SYMBOLS];
  }

  /**
   * Sleep 유틸리티 함수
   *
   * @param ms 대기 시간 (밀리초)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================================
  // 🔗 Candle15MService 호환 API
  // ============================================================================

  /**
   * 특정 심볼 구독 추가 (Candle15MService 호환 API)
   *
   * @param symbol 구독할 심볼
   */
  async subscribeSymbol(symbol: string): Promise<void> {
    if (this.MONITORED_SYMBOLS.includes(symbol)) {
      this.logger.warn(`⚠️ 이미 모니터링 중인 심볼: ${symbol}`);
      return;
    }

    try {
      this.logger.log(`📡 ${symbol} 심볼 구독 추가 시도...`);

      // 바이낸스 선물 15분봉 웹소켓 구독
      await this.wsClient.subscribeKline(
        symbol,
        '15m',
        (klineData) => this.handleFuturesKline(symbol, klineData),
        true, // 선물 시장
      );

      // 모니터링 목록에 추가
      (this.MONITORED_SYMBOLS as string[]).push(symbol);
      this.connectionStatus.set(symbol, true);
      this.lastReceivedTime.set(symbol, Date.now());

      // 기존 데이터를 메모리에 로드
      await this.loadSymbolDataToMemory(symbol);

      this.logger.log(`✅ ${symbol} 심볼 구독 추가 완료`);
    } catch (error) {
      this.logger.error(`❌ ${symbol} 심볼 구독 실패:`, error.message);
      throw error;
    }
  }

  /**
   * 특정 심볼 구독 해제 (Candle15MService 호환 API)
   *
   * @param symbol 구독 해제할 심볼
   */
  unsubscribeSymbol(symbol: string): void {
    try {
      // TODO: 웹소켓 구독 해제 로직 구현 필요
      this.logger.log(`📡 ${symbol} 웹소켓 구독 해제`);

      // 모니터링 목록에서 제거
      const index = this.MONITORED_SYMBOLS.indexOf(symbol);
      if (index > -1) {
        (this.MONITORED_SYMBOLS as string[]).splice(index, 1);
      }

      // 메모리 캐시 정리
      const cacheKey = `${symbol}_FUTURES`;
      this.memoryCandles.delete(cacheKey);
      this.latestCandles.delete(symbol);
      this.ongoingCandles.delete(symbol);

      // 연결 상태 정리
      this.connectionStatus.delete(symbol);
      this.lastReceivedTime.delete(symbol);

      this.logger.log(`✅ ${symbol} 심볼 구독 해제 완료`);
    } catch (error) {
      this.logger.error(`❌ ${symbol} 심볼 구독 해제 실패:`, error.message);
    }
  }

  /**
   * 특정 심볼의 최신 캔들 데이터 조회 (Candle15MService 호환 API)
   *
   * @param symbol 조회할 심볼
   * @returns 최신 캔들 데이터 (없으면 null)
   */
  getLatestCandle(symbol: string): Candle15MEntity | null {
    return this.latestCandles.get(symbol) || null;
  }

  /**
   * 모든 심볼의 최신 캔들 데이터 조회 (Candle15MService 호환 API)
   *
   * @returns 심볼별 최신 캔들 데이터 맵
   */
  getAllLatestCandles(): Map<string, Candle15MEntity> {
    return new Map(this.latestCandles);
  }

  /**
   * 진행 중인 캔들 데이터 조회 (Candle15MService 호환 API)
   *
   * @param symbol 조회할 심볼
   * @returns 진행 중인 캔들 데이터 (없으면 null)
   */
  getOngoingCandle(symbol: string): CandleData | null {
    return this.ongoingCandles.get(symbol) || null;
  }

  /**
   * 구독 상태 조회 (Candle15MService 호환 API)
   *
   * @returns 구독 상태 정보
   */
  getSubscriptionStatus(): {
    subscribedSymbols: string[];
    connectionStatus: Map<string, boolean>;
    cacheSize: number;
    ongoingCandlesCount: number;
  } {
    return {
      subscribedSymbols: [...this.MONITORED_SYMBOLS],
      connectionStatus: new Map(this.connectionStatus),
      cacheSize: this.latestCandles.size,
      ongoingCandlesCount: this.ongoingCandles.size,
    };
  }

  /**
   * 서비스 상태 조회 (Candle15MService 호환 API)
   *
   * @returns 서비스 상태 정보
   */
  getServiceStatus(): {
    subscribedSymbols: string[];
    connectionStatus: Map<string, boolean>;
    cacheSize: number;
    ongoingCandlesCount: number;
  } {
    return this.getSubscriptionStatus();
  }

  /**
   * 이벤트 리스너 등록 (Candle15MService 호환 API)
   *
   * @param event 이벤트 이름
   * @param listener 이벤트 리스너
   */
  on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * 이벤트 리스너 제거 (Candle15MService 호환 API)
   *
   * @param event 이벤트 이름
   * @param listener 이벤트 리스너
   */
  off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  /**
   * 이벤트 발송기 노출 (Candle15MService 호환 API)
   *
   * @returns EventEmitter2 인스턴스
   */
  getEventEmitter(): any {
    return this.eventEmitter;
  }

  /**
   * 특정 심볼의 데이터를 메모리에 로드 (내부 헬퍼)
   *
   * @param symbol 로드할 심볼
   */
  private async loadSymbolDataToMemory(symbol: string): Promise<void> {
    try {
      // DB에서 최근 캔들 데이터 조회
      const recentCandles = await this.candleRepository.findLatestCandles(
        symbol,
        'FUTURES',
        this.MAX_MEMORY_CANDLES,
      );

      if (recentCandles.length > 0) {
        const cacheKey = `${symbol}_FUTURES`;
        this.memoryCandles.set(cacheKey, recentCandles);

        // 최신 캔들을 엔티티 형태로 저장
        const latestCandleData = recentCandles[recentCandles.length - 1];
        const latestEntity = await this.candleRepository.findByOpenTime(
          symbol,
          'FUTURES',
          latestCandleData.openTime,
        );
        if (latestEntity) {
          this.latestCandles.set(symbol, latestEntity);
        }

        this.logger.log(
          `📊 ${symbol} 메모리 로딩 완료: ${recentCandles.length}개 캔들`,
        );
      } else {
        this.logger.log(`ℹ️ ${symbol} 기존 데이터 없음 - 실시간 수집부터 시작`);
      }
    } catch (error) {
      this.logger.error(`❌ ${symbol} 메모리 로딩 실패:`, error.message);
    }
  }

  /**
   * 새로운 캔들 여부 확인 (Candle15MService 호환)
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
      if (!this.firstCandleLogged.get(symbol)) {
        this.logger.log(
          `🆕 [NewCandle] 첫 번째 캔들 감지: ${symbol} - ${new Date(candleData.openTime).toISOString()}`,
        );
        this.firstCandleLogged.set(symbol, true);
      }
      return true;
    }

    // 시작 시간이 다르면 새로운 캔들
    const isNew = existingCandle.openTime.getTime() !== candleData.openTime;

    if (isNew) {
      this.logger.log(`🆕 [NewCandle] 새로운 15분봉 감지: ${symbol}`);
      this.logger.log(
        `   ├─ 이전 캔들: ${existingCandle.openTime.toISOString()}`,
      );
      this.logger.log(
        `   └─ 새 캔들:   ${new Date(candleData.openTime).toISOString()}`,
      );
    }

    return isNew;
  }

  /**
   * 캔들 저장 완료 이벤트 발송 (Candle15MService 호환)
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
      if (!isNewCandle) return;

      const event: CandleSavedEvent = {
        symbol,
        market: 'FUTURES' as const,
        timeframe: '15m',
        candleData,
        isNewCandle,
        savedAt: new Date(),
        candleId: savedCandle.id,
      };

      // 기존 candle.saved 이벤트 발송 (호환성)
      this.eventEmitter.emit(MARKET_DATA_EVENTS.CANDLE_SAVED, event);

      this.logger.log(
        `📡 [CandleSaved Event] 새 캔들 저장 이벤트 발송: ${symbol} (ID: ${savedCandle.id})`,
      );
    } catch (error) {
      this.logger.error(
        `❌ [CandleSaved Event] 이벤트 발송 실패: ${symbol}`,
        error,
      );
    }
  }

  /**
   * 최신 캔들 엔티티 캐시 업데이트 (Candle15MService 호환)
   *
   * @param symbol 심볼
   * @param candleData 캔들 데이터
   */
  private async updateLatestCandleCache(
    symbol: string,
    candleData: CandleData,
  ): Promise<void> {
    try {
      const existing = this.latestCandles.get(symbol);

      if (!existing || existing.openTime.getTime() <= candleData.openTime) {
        // 새로운 캔들이거나 더 최신 캔들인 경우
        const candleEntity = await this.candleRepository.findByOpenTime(
          symbol,
          'FUTURES',
          candleData.openTime,
        );
        if (candleEntity) {
          this.latestCandles.set(symbol, candleEntity);
        }
      }

      // 진행 중인 캔들 업데이트
      this.ongoingCandles.set(symbol, candleData);
    } catch (error) {
      this.logger.error(
        `❌ ${symbol} 최신 캔들 캐시 업데이트 실패:`,
        error.message,
      );
    }
  }

  /**
   * 캔들 완성 이벤트를 수동으로 트리거
   */
  async triggerCandleComplete(symbol: string): Promise<void> {
    try {
      // 메모리에서 최신 캔들 가져오기
      const cacheKey = `${symbol}_FUTURES_15m`;
      const memoryCandles = this.memoryCandles.get(cacheKey) || [];

      if (memoryCandles.length === 0) {
        this.logger.warn(
          `⚠️ ${symbol}에 대한 메모리 캔들이 없어 수동 트리거를 건너뜁니다`,
        );
        return;
      }

      const latestCandle = memoryCandles[memoryCandles.length - 1];

      // CandleCompletedEvent 생성
      const event: CandleCompletedEvent = {
        eventId: uuidv4(),
        symbol: symbol,
        service: 'Candle15MService',
        timestamp: new Date(),
        market: 'FUTURES',
        timeframe: '15m',
        candle: latestCandle,
      };

      // 이벤트 발송
      this.eventEmitter.emit('candle.completed', event);
      this.logger.log(`🔔 ${symbol} 캔들 완성 이벤트 수동 트리거됨`);
    } catch (error) {
      this.logger.error(
        `❌ ${symbol} 캔들 완성 이벤트 트리거 실패:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * 테스트용 캔들 데이터 처리
   */
  async processTestCandle(
    symbol: string,
    candleData: CandleData,
  ): Promise<any> {
    try {
      this.logger.log(`🧪 테스트 캔들 처리 시작: ${symbol}`);

      // 데이터베이스에 저장 (repository의 saveCandle 메서드 사용)
      const savedEntity = await this.candleRepository.saveCandle(
        symbol,
        'FUTURES',
        candleData,
      );

      // 메모리 캐시에도 추가
      const cacheKey = `${symbol}_FUTURES_15m`;
      let candles = this.memoryCandles.get(cacheKey) || [];
      candles.push(candleData);

      // 메모리 크기 제한
      if (candles.length > this.MAX_MEMORY_CANDLES) {
        candles = candles.slice(-this.MAX_MEMORY_CANDLES);
      }

      this.memoryCandles.set(cacheKey, candles);

      // 이벤트 발송
      const savedEvent: CandleSavedEvent = {
        symbol,
        market: 'FUTURES',
        timeframe: '15m',
        candleData,
        isNewCandle: true,
        savedAt: new Date(),
        candleId: savedEntity.id,
      };

      this.eventEmitter.emit(MARKET_DATA_EVENTS.CANDLE_SAVED, savedEvent);

      this.logger.log(`✅ 테스트 캔들 처리 완료: ${symbol}`);
      return savedEntity;
    } catch (error) {
      this.logger.error(`❌ 테스트 캔들 처리 실패 ${symbol}:`, error.message);
      throw error;
    }
  }
}
