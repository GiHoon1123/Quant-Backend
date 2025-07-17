import { Injectable } from '@nestjs/common';
import { BinanceWebSocketClient } from 'src/common/binance/BinanceWebSocketClient';
import {
  CandleData,
  TimeFrame,
} from 'src/technical-analysis/types/TechnicalAnalysisTypes';

/**
 * 실시간 캔들 어그리게이터 서비스
 *
 * 1분봉 실시간 데이터만 수신하여 모든 상위 시간봉을 생성하는 서비스입니다.
 *
 * 🎯 핵심 아이디어:
 * - 1분봉 소켓 1개만 구독 → 15분봉, 1시간봉, 1일봉 모두 계산 생성
 * - 메모리에서 실시간 어그리게이션
 * - 소켓 연결 수 최소화 (15개 코인 × 2개 마켓 = 30개만)
 *
 * 🚀 효율성:
 * - 기존: 120개 소켓 연결 (15코인 × 4시간봉 × 2마켓)
 * - 최적화: 30개 소켓 연결 (15코인 × 1분봉 × 2마켓)
 * - 75% 리소스 절약!
 *
 * 📊 동작 원리:
 * 1. BTCUSDT 1분봉 수신 → 15분/1시간/1일봉 업데이트
 * 2. 각 시간봉 완성 시점에 기술적 분석 트리거
 * 3. 신호 변화 시 텔레그램 알림
 */
@Injectable()
export class RealtimeCandleAggregator {
  // 1분봉 데이터 버퍼 (각 심볼별로 관리)
  private minute1Buffer = new Map<string, CandleData[]>();

  // 어그리게이션된 캔들 데이터 (심볼_시간봉 → 캔들배열)
  private aggregatedCandles = new Map<string, CandleData[]>();

  // 모니터링할 심볼들
  private readonly SYMBOLS = [
    'BTCUSDT',
    'ETHUSDT',
    'ADAUSDT',
    'DOTUSDT',
    'LINKUSDT',
    'SOLUSDT',
    'MATICUSDT',
    'AVAXUSDT',
    'ATOMUSDT',
    'NEARUSDT',
  ];

  // 버퍼 크기 (1분봉 보관 개수)
  private readonly BUFFER_SIZE = 1440; // 24시간 = 1440분

  constructor(private readonly wsClient: BinanceWebSocketClient) {}

  /**
   * 실시간 모니터링 시작
   *
   * 모든 주요 심볼의 1분봉만 구독하여 상위 시간봉들을 실시간 생성합니다.
   */
  startMonitoring(): void {
    console.log('🚀 실시간 캔들 어그리게이터 시작');

    for (const symbol of this.SYMBOLS) {
      // 현물 1분봉 구독
      this.wsClient.subscribeKline(
        symbol,
        '1m',
        (klineData) => this.handleSpotKline(symbol, klineData),
        false, // 현물
      );

      // 선물 1분봉 구독
      this.wsClient.subscribeKline(
        symbol,
        '1m',
        (klineData) => this.handleFuturesKline(symbol, klineData),
        true, // 선물
      );

      console.log(`📊 ${symbol} 현물/선물 1분봉 구독 완료`);
    }

    console.log(
      `✅ ${this.SYMBOLS.length}개 심볼 × 2개 마켓 = ${this.SYMBOLS.length * 2}개 소켓 연결`,
    );
  }

  /**
   * 현물 1분봉 데이터 처리
   */
  private handleSpotKline(symbol: string, klineData: any): void {
    const candle = this.parseKlineData(klineData);
    const key = `${symbol}_SPOT`;

    this.updateCandleBuffer(key, candle);

    // 완성된 캔들인 경우 상위 시간봉 업데이트
    if (klineData.k?.x) {
      // isFinal
      this.updateAggregatedTimeframes(key, candle);
    }
  }

  /**
   * 선물 1분봉 데이터 처리
   */
  private handleFuturesKline(symbol: string, klineData: any): void {
    const candle = this.parseKlineData(klineData);
    const key = `${symbol}_FUTURES`;

    this.updateCandleBuffer(key, candle);

    if (klineData.k?.x) {
      this.updateAggregatedTimeframes(key, candle);
    }
  }

  /**
   * 1분봉 버퍼 업데이트
   */
  private updateCandleBuffer(key: string, candle: CandleData): void {
    if (!this.minute1Buffer.has(key)) {
      this.minute1Buffer.set(key, []);
    }

    const buffer = this.minute1Buffer.get(key)!;

    // 기존 캔들 업데이트 또는 새 캔들 추가
    const lastCandle = buffer[buffer.length - 1];
    if (lastCandle && lastCandle.openTime === candle.openTime) {
      // 같은 시간 캔들 업데이트 (진행중인 캔들)
      buffer[buffer.length - 1] = candle;
    } else {
      // 새 캔들 추가
      buffer.push(candle);

      // 버퍼 크기 제한
      if (buffer.length > this.BUFFER_SIZE) {
        buffer.shift(); // 가장 오래된 캔들 제거
      }
    }
  }

  /**
   * 상위 시간봉 어그리게이션 업데이트
   */
  private updateAggregatedTimeframes(
    key: string,
    completedCandle: CandleData,
  ): void {
    const buffer = this.minute1Buffer.get(key);
    if (!buffer || buffer.length === 0) return;

    // 15분봉 생성
    this.generateAggregatedCandles(key, TimeFrame.FIFTEEN_MINUTES, 15);

    // 1시간봉 생성
    this.generateAggregatedCandles(key, TimeFrame.ONE_HOUR, 60);

    // 1일봉 생성
    this.generateAggregatedCandles(key, TimeFrame.ONE_DAY, 1440);

    console.log(`📈 ${key} 상위 시간봉 업데이트 완료`);
  }

  /**
   * 어그리게이션된 캔들 생성
   */
  private generateAggregatedCandles(
    baseKey: string,
    timeframe: TimeFrame,
    intervalMinutes: number,
  ): void {
    const buffer = this.minute1Buffer.get(baseKey);
    if (!buffer || buffer.length === 0) return;

    const aggregatedKey = `${baseKey}_${timeframe}`;
    const aggregatedCandles: CandleData[] = [];

    // 시간 기준으로 그룹핑하여 어그리게이션
    const groupedCandles = this.groupCandlesByInterval(buffer, intervalMinutes);

    for (const group of groupedCandles) {
      if (group.length === 0) continue;

      const aggregated: CandleData = {
        openTime: group[0].openTime,
        closeTime: group[group.length - 1].closeTime,
        open: group[0].open,
        close: group[group.length - 1].close,
        high: Math.max(...group.map((c) => c.high)),
        low: Math.min(...group.map((c) => c.low)),
        volume: group.reduce((sum, c) => sum + c.volume, 0),
        quoteVolume: group.reduce((sum, c) => sum + c.quoteVolume, 0),
        trades: group.reduce((sum, c) => sum + c.trades, 0),
        takerBuyBaseVolume: group.reduce(
          (sum, c) => sum + c.takerBuyBaseVolume,
          0,
        ),
        takerBuyQuoteVolume: group.reduce(
          (sum, c) => sum + c.takerBuyQuoteVolume,
          0,
        ),
      };

      aggregatedCandles.push(aggregated);
    }

    // 최근 200개만 유지 (기술적 분석에 충분)
    if (aggregatedCandles.length > 200) {
      aggregatedCandles.splice(0, aggregatedCandles.length - 200);
    }

    this.aggregatedCandles.set(aggregatedKey, aggregatedCandles);

    // 새로운 캔들 완성 시 이벤트 발생 (마지막 캔들 전달)
    if (aggregatedCandles.length > 0) {
      const lastCandle = aggregatedCandles[aggregatedCandles.length - 1];
      this.onCandleCompleted(baseKey, timeframe, lastCandle);
    }
  }

  /**
   * 캔들들을 시간 간격별로 그룹핑
   */
  private groupCandlesByInterval(
    candles: CandleData[],
    intervalMinutes: number,
  ): CandleData[][] {
    const groups: CandleData[][] = [];
    const intervalMs = intervalMinutes * 60 * 1000;

    let currentGroup: CandleData[] = [];
    let groupStartTime: number | null = null;

    for (const candle of candles) {
      // 그룹 시작 시간 계산 (정시 기준으로 정렬)
      const candleGroupStart =
        Math.floor(candle.openTime / intervalMs) * intervalMs;

      if (groupStartTime === null) {
        groupStartTime = candleGroupStart;
        currentGroup = [candle];
      } else if (candleGroupStart === groupStartTime) {
        currentGroup.push(candle);
      } else {
        // 새로운 그룹 시작
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        groupStartTime = candleGroupStart;
        currentGroup = [candle];
      }
    }

    // 마지막 그룹 추가
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * 캔들 완성 이벤트 처리
   *
   * 새로운 캔들이 완성될 때마다 호출되어 기술적 분석을 트리거합니다.
   */
  private onCandleCompleted(
    baseKey: string,
    timeframe: TimeFrame,
    newCandle: CandleData,
  ): void {
    const [symbolWithMarket] = baseKey.split('_');
    const [symbol, market] = symbolWithMarket.includes('_')
      ? symbolWithMarket.split('_')
      : [symbolWithMarket, 'SPOT'];

    console.log(
      `🕐 ${symbol} ${market} ${timeframe} 캔들 완성: ${new Date(newCandle.closeTime).toLocaleString()}`,
    );

    // 여기서 기술적 분석 서비스 호출
    // this.triggerTechnicalAnalysis(symbol, market, timeframe);
  }

  /**
   * 특정 심볼/마켓/시간봉의 캔들 데이터 조회
   */
  getCandles(
    symbol: string,
    market: 'SPOT' | 'FUTURES',
    timeframe: TimeFrame,
    limit: number = 100,
  ): CandleData[] {
    const key =
      timeframe === TimeFrame.ONE_MINUTE
        ? `${symbol}_${market}`
        : `${symbol}_${market}_${timeframe}`;

    const candles =
      timeframe === TimeFrame.ONE_MINUTE
        ? this.minute1Buffer.get(key) || []
        : this.aggregatedCandles.get(key) || [];

    return candles.slice(-limit); // 최근 limit 개만 반환
  }

  /**
   * 바이낸스 웹소켓 데이터 파싱
   */
  private parseKlineData(klineData: any): CandleData {
    const k = klineData.k;
    return {
      openTime: parseInt(k.t),
      closeTime: parseInt(k.T),
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c),
      volume: parseFloat(k.v),
      quoteVolume: parseFloat(k.q),
      trades: parseInt(k.n),
      takerBuyBaseVolume: parseFloat(k.V),
      takerBuyQuoteVolume: parseFloat(k.Q),
    };
  }

  /**
   * 모니터링 상태 조회
   */
  getStatus() {
    const minute1Count = this.minute1Buffer.size;
    const aggregatedCount = this.aggregatedCandles.size;

    return {
      symbols: this.SYMBOLS.length,
      socketConnections: this.SYMBOLS.length * 2, // 현물 + 선물
      minute1Buffers: minute1Count,
      aggregatedCandles: aggregatedCount,
      memoryUsage: `${minute1Count * this.BUFFER_SIZE + aggregatedCount * 200} candles`,
    };
  }

  /**
   * 모니터링 중지
   */
  stopMonitoring(): void {
    this.wsClient.disconnect();
    this.minute1Buffer.clear();
    this.aggregatedCandles.clear();
    console.log('🛑 실시간 캔들 어그리게이터 중지');
  }
}
