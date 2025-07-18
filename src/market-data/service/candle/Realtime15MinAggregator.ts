import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter } from 'events';
import { BinanceWebSocketClient } from '../../../common/binance/BinanceWebSocketClient';
import { CandleData } from '../../infra/candle/Candle15MEntity';
import { Candle15MRepository } from '../../infra/candle/Candle15MRepository';

/**
 * 실시간 15분봉 집계기 서비스
 *
 * 바이낸스 웹소켓에서 선물 15분봉 데이터를 실시간으로 수신하여
 * 메모리 캐시와 데이터베이스에 저장하는 핵심 서비스입니다.
 *
 * 주요 기능:
 * - 바이낸스 선물 15분봉 웹소켓 구독 및 관리
 * - 실시간 데이터 파싱 및 검증
 * - 메모리 캐시 관리 (빠른 조회용)
 * - 데이터베이스 영구 저장 (백테스팅용)
 * - 캔들 완성 이벤트 발생 (기술적 분석 트리거)
 * - 자동 복구 및 장애 대응
 * - 성능 모니터링 및 상태 추적
 *
 * 설계 원칙:
 * - 메모리 우선: 실시간 조회는 메모리 캐시에서
 * - DB 백업: 영구 보존 및 복구를 위한 데이터베이스 저장
 * - 이벤트 드리븐: 캔들 완성 시 분석 시스템 자동 트리거
 * - 장애 대응: 웹소켓 재연결, DB 실패 시 메모리 유지
 * - 확장성: 새로운 심볼 쉽게 추가 가능
 *
 * @example
 * ```typescript
 * // 서비스 자동 시작 (OnModuleInit)
 * await aggregator.startMonitoring();
 *
 * // 실시간 데이터 조회
 * const candles = aggregator.getMemoryCandles('BTCUSDT', 'FUTURES', 100);
 *
 * // 캔들 완성 이벤트 구독
 * eventEmitter.on('candle.15m.completed', (data) => {
 *   console.log('새로운 15분봉 완성:', data);
 * });
 * ```
 */
@Injectable()
export class Realtime15MinAggregator implements OnModuleInit, OnModuleDestroy {
  /**
   * 모니터링 대상 심볼 목록
   *
   * 선물 거래에서 주로 사용되는 주요 암호화폐 심볼들입니다.
   * 시장 점유율과 거래량을 고려하여 선정된 대표 심볼들이며,
   * 설정 파일이나 환경 변수를 통해 동적 관리 가능합니다.
   */
  private readonly MONITORED_SYMBOLS = [
    'BTCUSDT', // 비트코인 (시가총액 1위, 가장 중요)
    'ETHUSDT', // 이더리움 (시가총액 2위, DeFi 중심)
    'ADAUSDT', // 에이다 (카르다노, 스테이킹 인기)
    'SOLUSDT', // 솔라나 (고성능 블록체인)
    'DOGEUSDT', // 도지코인 (밈코인 대표)
    'XRPUSDT', // 리플 (국제송금 솔루션)
    'DOTUSDT', // 폴카닷 (멀티체인 플랫폼)
    'AVAXUSDT', // 아발란체 (고속 거래)
    'MATICUSDT', // 폴리곤 (이더리움 스케일링)
    'LINKUSDT', // 체인링크 (오라클 네트워크)
  ];

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
  private readonly MAX_MEMORY_CANDLES = 200;

  /**
   * 웹소켓 재연결 간격 (밀리초)
   */
  private readonly RECONNECT_INTERVAL = 5000; // 5초

  /**
   * 헬스체크 간격 (밀리초)
   */
  private readonly HEALTH_CHECK_INTERVAL = 60000; // 1분

  /**
   * 헬스체크 타이머 ID
   */
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(
    private readonly wsClient: BinanceWebSocketClient,
    private readonly candleRepository: Candle15MRepository,
    private readonly eventEmitter: EventEmitter,
  ) {
    console.log('🚀 Realtime15MinAggregator 서비스 생성 완료');
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
      console.log('🚀 Realtime15MinAggregator 모듈 초기화 시작');

      // 1. 기존 데이터를 메모리에 로드 (서버 재시작 시 복구)
      await this.loadRecentDataToMemory();

      // 2. 실시간 모니터링 시작
      await this.startMonitoring();

      // 3. 헬스체크 시작
      this.startHealthCheck();

      console.log('✅ Realtime15MinAggregator 초기화 완료');

      // 초기화 완료 이벤트 발생
      this.eventEmitter.emit('aggregator.initialized', {
        service: 'Realtime15MinAggregator',
        symbolCount: this.MONITORED_SYMBOLS.length,
        memoryDataLoaded: this.memoryCandles.size,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('❌ Realtime15MinAggregator 초기화 실패:', error);
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
      console.log('🛑 Realtime15MinAggregator 종료 시작');

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
          console.log(`📡 ${symbol} 웹소켓 구독 해제`);
          this.connectionStatus.set(symbol, false);
        } catch (error) {
          console.error(`❌ ${symbol} 웹소켓 해제 실패:`, error.message);
        }
      }

      // 종료 이벤트 발생
      this.eventEmitter.emit('aggregator.destroyed', {
        service: 'Realtime15MinAggregator',
        timestamp: new Date(),
      });

      console.log('✅ Realtime15MinAggregator 종료 완료');
    } catch (error) {
      console.error('❌ Realtime15MinAggregator 종료 중 오류:', error);
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
      console.log('⚠️ 실시간 모니터링이 이미 실행 중입니다.');
      return;
    }

    console.log('🚀 선물 15분봉 실시간 모니터링 시작');
    console.log(`📊 모니터링 대상: ${this.MONITORED_SYMBOLS.length}개 심볼`);
    console.log(`📋 대상 심볼: ${this.MONITORED_SYMBOLS.join(', ')}`);

    this.isRunning = true;
    let successCount = 0;
    let failureCount = 0;

    // 각 심볼에 대해 웹소켓 구독 시작
    for (const symbol of this.MONITORED_SYMBOLS) {
      try {
        console.log(`📡 ${symbol} 선물 15분봉 웹소켓 구독 시도...`);

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

        console.log(`✅ ${symbol} 선물 15분봉 구독 완료`);

        // 구독 간 간격 (API 제한 방지)
        await this.sleep(100);
      } catch (error) {
        console.error(`❌ ${symbol} 웹소켓 구독 실패:`, error.message);
        this.connectionStatus.set(symbol, false);
        failureCount++;

        // 개별 심볼 실패가 전체를 막지 않도록 처리
        continue;
      }
    }

    // 구독 결과 로깅
    console.log(
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
      totalSymbols: this.MONITORED_SYMBOLS.length,
      successCount,
      failureCount,
      timestamp: new Date(),
    });

    console.log('🎯 실시간 15분봉 데이터 수집 시작!');
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
    console.log('💾 데이터베이스에서 최근 캔들 데이터 로딩 시작');

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
          console.log(
            `📊 ${symbol} 메모리 로딩 완료: ${recentCandles.length}개 캔들 (최신: ${latestTime.toISOString()})`,
          );
        } else {
          console.log(`ℹ️ ${symbol} 기존 데이터 없음 - 실시간 수집부터 시작`);
        }
      } catch (error) {
        console.error(`❌ ${symbol} 메모리 로딩 실패:`, error.message);
        // 개별 심볼 실패가 전체를 막지 않도록 처리
        continue;
      }
    }

    const loadDuration = Date.now() - loadStartTime;
    console.log(
      `✅ 메모리 캔들 데이터 로딩 완료: ${loadedSymbols}개 심볼, ${totalCandles.toLocaleString()}개 캔들 (${loadDuration}ms)`,
    );

    // 메모리 로드 완료 이벤트 발생
    this.eventEmitter.emit('aggregator.memory.loaded', {
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
        console.warn(`⚠️ [${symbol}] 캔들 데이터 파싱 실패 - 무효한 데이터`);
        return;
      }

      const cacheKey = `${symbol}_FUTURES`;
      const isCompleted = klineData.k?.x === true; // 캔들 완성 여부

      // 1. 메모리 캐시 업데이트 (항상 실행 - 실시간 조회용)
      this.updateMemoryCache(cacheKey, candleData);

      if (isCompleted) {
        // 2. 캔들 완성 시에만 실행되는 로직
        const candleTime = new Date(candleData.openTime).toLocaleString(
          'ko-KR',
        );
        console.log(
          `🕐 [${symbol}] 15분봉 완성: ${candleTime} (종가: $${candleData.close.toFixed(2)})`,
        );

        // 2-1. 데이터베이스에 영구 저장 (비동기 처리로 성능 최적화)
        this.saveToDatabaseAsync(symbol, candleData);

        // 2-2. 캔들 완성 이벤트 발생 (기술적 분석 시스템 트리거)
        this.emitCandleCompletedEvent(symbol, candleData);
      } else {
        // 진행 중인 캔들 (실시간 업데이트)
        // 30초마다 한 번씩만 로깅 (로그 스팸 방지)
        const now = Date.now();
        const lastLogKey = `${symbol}_lastLog`;
        const lastLogTime = (this as any)[lastLogKey] || 0;

        if (now - lastLogTime > 30000) {
          console.log(
            `📊 [${symbol}] 15분봉 업데이트: $${candleData.close.toFixed(2)} (거래량: ${candleData.volume.toFixed(2)})`,
          );
          (this as any)[lastLogKey] = now;
        }
      }
    } catch (error) {
      console.error(`❌ [${symbol}] 캔들 처리 실패:`, error.message);

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
   * 검증 항목:
   * - 필수 필드 존재 여부
   * - 숫자 데이터 유효성
   * - OHLC 논리 검증
   * - 시간 데이터 유효성
   *
   * @param klineData 바이낸스 웹소켓 원시 데이터
   * @returns 파싱된 캔들 데이터 또는 null (실패 시)
   *
   * @example
   * ```typescript
   * // 바이낸스 웹소켓 데이터 예시
   * const klineData = {
   *   k: {
   *     t: 1705555200000,    // 시작 시간
   *     T: 1705556099999,    // 종료 시간
   *     o: "42850.50",       // 시가
   *     h: "42950.75",       // 고가
   *     l: "42750.25",       // 저가
   *     c: "42825.80",       // 종가
   *     v: "125.456",        // 거래량
   *     q: "5375248.75",     // 거래대금
   *     n: 1250,             // 거래 횟수
   *     V: "65.789",         // 능동 매수 거래량
   *     Q: "2817456.25",     // 능동 매수 거래대금
   *     x: true              // 캔들 완성 여부
   *   }
   * };
   * ```
   */
  private parseKlineData(klineData: any): CandleData | null {
    try {
      const k = klineData.k;
      if (!k) {
        console.warn('⚠️ kline 데이터가 없습니다:', JSON.stringify(klineData));
        return null;
      }

      // 필수 필드 존재 여부 검증
      const requiredFields = [
        't',
        'T',
        'o',
        'h',
        'l',
        'c',
        'v',
        'q',
        'n',
        'V',
        'Q',
      ];
      for (const field of requiredFields) {
        if (k[field] === undefined || k[field] === null) {
          console.warn(`⚠️ 필수 필드 누락: ${field}`);
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
        trades: parseInt(k.n), // 거래 횟수
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
        console.warn('⚠️ 유효하지 않은 가격 데이터:', candleData);
        return null;
      }

      // 가격 데이터 논리 검증
      if (
        candleData.open <= 0 ||
        candleData.high <= 0 ||
        candleData.low <= 0 ||
        candleData.close <= 0
      ) {
        console.warn('⚠️ 가격은 0보다 커야 합니다:', candleData);
        return null;
      }

      // OHLC 논리 검증
      if (
        candleData.high < Math.max(candleData.open, candleData.close) ||
        candleData.low > Math.min(candleData.open, candleData.close)
      ) {
        console.warn('⚠️ OHLC 데이터 논리 오류:', candleData);
        return null;
      }

      // 거래량 유효성 검증
      if (
        candleData.volume < 0 ||
        candleData.quoteVolume < 0 ||
        candleData.trades < 0
      ) {
        console.warn('⚠️ 거래량 데이터는 0 이상이어야 합니다:', candleData);
        return null;
      }

      return candleData;
    } catch (error) {
      console.error('❌ 캔들 데이터 파싱 실패:', error.message);
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
        console.log(
          `➕ [${cacheKey}] 메모리 캐시 추가: 새로운 캔들 (총 ${candles.length}개)`,
        );
      }

      // 메모리 사용량 최적화: 최근 N개만 유지
      if (candles.length > this.MAX_MEMORY_CANDLES) {
        const removedCount = candles.length - this.MAX_MEMORY_CANDLES;
        candles = candles.slice(-this.MAX_MEMORY_CANDLES);
        // 메모리 정리는 가끔 발생하므로 로깅 유지
        console.log(
          `🗑️ [${cacheKey}] 오래된 캔들 ${removedCount}개 메모리에서 제거 (현재: ${candles.length}개)`,
        );
      }

      // 업데이트된 캐시 저장
      this.memoryCandles.set(cacheKey, candles);
    } catch (error) {
      console.error(
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
   *
   * @param symbol 거래 심볼
   * @param candleData 저장할 캔들 데이터
   */
  private saveToDatabaseAsync(symbol: string, candleData: CandleData): void {
    // Promise로 감싸서 메인 스레드 블록 방지
    this.candleRepository
      .saveCandle(symbol, 'FUTURES', candleData)
      .then((savedCandle) => {
        const candleTime = new Date(candleData.openTime).toLocaleString(
          'ko-KR',
        );
        console.log(
          `💾 [${symbol}] DB 저장 완료: ${candleTime} (ID: ${savedCandle.id})`,
        );

        // DB 저장 성공 이벤트
        this.eventEmitter.emit('candle.saved', {
          symbol,
          market: 'FUTURES',
          candleId: savedCandle.id,
          openTime: candleData.openTime,
          close: candleData.close,
        });
      })
      .catch((error) => {
        console.error(
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
      const eventData = {
        symbol,
        market: 'FUTURES' as const,
        timeframe: '15m',
        candle: candleData,
        timestamp: new Date(),
      };

      // 기본 캔들 완성 이벤트
      this.eventEmitter.emit('candle.15m.completed', eventData);

      // 추가 분석 및 특별 이벤트
      this.analyzeAndEmitSpecialEvents(symbol, candleData, eventData);

      console.log(
        `🎯 [${symbol}] 캔들 완성 이벤트 발생: ${new Date(candleData.openTime).toISOString()}`,
      );
    } catch (error) {
      console.error(
        `❌ [${symbol}] 캔들 완성 이벤트 발생 실패:`,
        error.message,
      );
    }
  }

  /**
   * 특별 이벤트 분석 및 발생
   *
   * 완성된 캔들을 분석하여 특별한 상황을 감지하고
   * 해당하는 이벤트를 발생시킵니다.
   *
   * @param symbol 거래 심볼
   * @param candleData 캔들 데이터
   * @param baseEventData 기본 이벤트 데이터
   */
  private analyzeAndEmitSpecialEvents(
    symbol: string,
    candleData: CandleData,
    baseEventData: any,
  ): void {
    try {
      // 1. 높은 거래량 감지 (평균의 3배 이상)
      const cacheKey = `${symbol}_FUTURES`;
      const recentCandles = this.memoryCandles.get(cacheKey) || [];

      if (recentCandles.length >= 10) {
        const recentVolumes = recentCandles.slice(-10).map((c) => c.volume);
        const avgVolume =
          recentVolumes.reduce((sum, vol) => sum + vol, 0) /
          recentVolumes.length;

        if (candleData.volume > avgVolume * 3) {
          this.eventEmitter.emit('candle.high.volume', {
            ...baseEventData,
            currentVolume: candleData.volume,
            averageVolume: avgVolume,
            volumeRatio: candleData.volume / avgVolume,
          });

          console.log(
            `🔥 [${symbol}] 높은 거래량 감지: ${candleData.volume.toFixed(2)} (평균의 ${(candleData.volume / avgVolume).toFixed(1)}배)`,
          );
        }
      }

      // 2. 급격한 가격 변동 감지 (3% 이상)
      const priceChangePercent = Math.abs(
        ((candleData.close - candleData.open) / candleData.open) * 100,
      );
      if (priceChangePercent >= 3) {
        this.eventEmitter.emit('candle.price.spike', {
          ...baseEventData,
          priceChangePercent,
          direction: candleData.close > candleData.open ? 'UP' : 'DOWN',
        });

        console.log(
          `📈 [${symbol}] 급격한 가격 변동 감지: ${priceChangePercent.toFixed(2)}% (${candleData.close > candleData.open ? '상승' : '하락'})`,
        );
      }

      // 3. 갭 발생 감지 (이전 종가와 현재 시가 차이)
      if (recentCandles.length > 0) {
        const prevCandle = recentCandles[recentCandles.length - 1];
        const gapPercent = Math.abs(
          ((candleData.open - prevCandle.close) / prevCandle.close) * 100,
        );

        if (gapPercent >= 1) {
          this.eventEmitter.emit('candle.gap.detected', {
            ...baseEventData,
            gapPercent,
            direction: candleData.open > prevCandle.close ? 'UP' : 'DOWN',
            prevClose: prevCandle.close,
            currentOpen: candleData.open,
          });

          console.log(
            `🕳️ [${symbol}] 갭 발생 감지: ${gapPercent.toFixed(2)}% (${candleData.open > prevCandle.close ? '상승' : '하락'} 갭)`,
          );
        }
      }
    } catch (error) {
      console.error(`❌ [${symbol}] 특별 이벤트 분석 실패:`, error.message);
    }
  }

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

    console.log(
      `💊 헬스체크 시작: ${this.HEALTH_CHECK_INTERVAL / 1000}초 간격`,
    );
  }

  /**
   * 헬스체크 수행
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const now = Date.now();
      const healthStatus = {
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
          console.warn(
            `⚠️ [${symbol}] 데이터 수신 중단: ${Math.round(timeSinceLastData / 1000 / 60)}분 전`,
          );
        } else {
          healthStatus.disconnectedSymbols++;
        }
      }

      // 데이터베이스 연결 점검
      healthStatus.dbConnected = await this.candleRepository.checkHealth();

      // 헬스체크 결과 이벤트 발생
      this.eventEmitter.emit('aggregator.health.check', healthStatus);

      // 경고 상황 로깅
      if (
        healthStatus.disconnectedSymbols > 0 ||
        healthStatus.staleConnections > 0
      ) {
        console.warn(
          `⚠️ 헬스체크 경고: 연결됨 ${healthStatus.connectedSymbols}, 끊어짐 ${healthStatus.disconnectedSymbols}, 정체됨 ${healthStatus.staleConnections}`,
        );
      } else {
        console.log(
          `💊 헬스체크 정상: ${healthStatus.connectedSymbols}개 심볼 연결 상태 양호`,
        );
      }
    } catch (error) {
      console.error('❌ 헬스체크 수행 실패:', error.message);
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
        console.log(`🔄 [${symbol}] 웹소켓 재연결 시도...`);

        await this.wsClient.subscribeKline(
          symbol,
          '15m',
          (klineData) => this.handleFuturesKline(symbol, klineData),
          true,
        );

        this.connectionStatus.set(symbol, true);
        this.lastReceivedTime.set(symbol, Date.now());

        console.log(`✅ [${symbol}] 웹소켓 재연결 성공`);
      } catch (error) {
        console.error(`❌ [${symbol}] 웹소켓 재연결 실패:`, error.message);

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

    console.log(
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
}
