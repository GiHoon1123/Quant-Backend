import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BinanceWebSocketClient } from '../../common/binance/BinanceWebSocketClient';
import { TechnicalAnalysisService } from '../technical-analysis/service/TechnicalAnalysisService';
import {
  TimeFrame,
  SignalType,
} from '../technical-analysis/types/StrategyTypes';

/**
 * 실시간 기술적 분석 알림 서비스
 *
 * WebSocket을 통해 실시간 캔들 데이터를 수신하고,
 * 200일선 돌파 등 중요한 기술적 분석 신호를 감지하여
 * 텔레그램으로 즉시 알림을 보내는 서비스입니다.
 *
 * 🎯 주요 기능:
 * - 실시간 캔들 데이터 모니터링 (WebSocket)
 * - 200일선, 50일선 돌파 감지
 * - RSI 과매도/과매수 신호 감지
 * - MACD 골든크로스/데드크로스 감지
 * - 텔레그램 즉시 알림 발송
 *
 * 🚀 모니터링 전략:
 * - 15분봉: 단기 신호 (빠른 진입/청산)
 * - 1시간봉: 중기 신호 (스윙 트레이딩)
 * - 1일봉: 장기 신호 (포지션 트레이딩)
 *
 * 💡 하이브리드 방식:
 * - WebSocket: 실시간 데이터 수신
 * - Cron: 주기적 전체 스캔 (놓친 신호 보완)
 */
@Injectable()
export class TechnicalAnalysisAlertService {
  // 모니터링할 주요 코인들
  private readonly WATCH_SYMBOLS = [
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
    'XRPUSDT',
    'LTCUSDT',
    'BCHUSDT',
    'EOSUSDT',
    'TRXUSDT',
  ];

  // 모니터링할 시간봉들
  private readonly WATCH_TIMEFRAMES = [
    TimeFrame.FIFTEEN_MINUTES,
    TimeFrame.ONE_HOUR,
    TimeFrame.ONE_DAY,
  ];

  // 마지막 분석 결과 캐시 (중복 알림 방지)
  private lastAnalysisCache = new Map<string, any>();

  // WebSocket 구독 관리
  private subscriptions = new Map<string, string>();

  constructor(
    private readonly wsClient: BinanceWebSocketClient,
    private readonly technicalAnalysisService: TechnicalAnalysisService,
    // private readonly telegramService: TelegramService, // 별도 구현 필요
  ) {
    this.initializeWebSocketMonitoring();
  }

  /**
   * WebSocket 실시간 모니터링 초기화
   *
   * 모든 주요 코인의 1분봉을 실시간으로 모니터링하여
   * 캔들이 완성될 때마다 기술적 분석을 수행합니다.
   */
  private initializeWebSocketMonitoring(): void {
    console.log('🚀 실시간 기술적 분석 모니터링 시작');

    for (const symbol of this.WATCH_SYMBOLS) {
      // 1분봉 실시간 모니터링 (가장 빠른 신호 감지)
      const subscriptionKey = this.wsClient.subscribeKline(
        symbol,
        '1m',
        (klineData) => this.handleKlineUpdate(symbol, klineData),
        false, // 현물
      );

      this.subscriptions.set(symbol, subscriptionKey);
      console.log(`📊 ${symbol} 실시간 모니터링 시작`);
    }

    console.log(
      `✅ ${this.WATCH_SYMBOLS.length}개 심볼 실시간 모니터링 활성화`,
    );
  }

  /**
   * 실시간 캔들 데이터 처리
   *
   * @param symbol 심볼
   * @param klineData 캔들 데이터
   */
  private async handleKlineUpdate(
    symbol: string,
    klineData: any,
  ): Promise<void> {
    try {
      // 캔들이 완성된 경우에만 분석 (isFinal = true)
      if (!klineData.k?.x) {
        return; // 진행중인 캔들은 무시
      }

      console.log(`📈 ${symbol} 캔들 완성 - 기술적 분석 시작`);

      // 주요 시간봉들에 대해 분석 수행
      for (const timeframe of this.WATCH_TIMEFRAMES) {
        await this.performTechnicalAnalysis(symbol, timeframe);
      }
    } catch (error) {
      console.error(`❌ ${symbol} 실시간 분석 실패:`, error);
    }
  }

  /**
   * 기술적 분석 수행 및 알림 체크
   *
   * @param symbol 심볼
   * @param timeframe 시간봉
   */
  private async performTechnicalAnalysis(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<void> {
    try {
      const cacheKey = `${symbol}_${timeframe}`;

      // 기술적 분석 실행
      const analysis = await this.technicalAnalysisService.analyzeSymbol(
        symbol,
        undefined, // 모든 전략 사용
        [timeframe],
      );

      // 이전 분석 결과와 비교
      const lastAnalysis = this.lastAnalysisCache.get(cacheKey);

      // 중요한 신호 변화 감지
      const alerts = this.detectSignalChanges(
        symbol,
        timeframe,
        analysis,
        lastAnalysis,
      );

      // 알림 발송
      for (const alert of alerts) {
        await this.sendTelegramAlert(alert);
      }

      // 캐시 업데이트
      this.lastAnalysisCache.set(cacheKey, {
        timestamp: Date.now(),
        signal: analysis.overallSignal,
        confidence: analysis.overallConfidence,
        strategies: analysis.strategies,
      });
    } catch (error) {
      console.error(`❌ ${symbol} ${timeframe} 분석 실패:`, error);
    }
  }

  /**
   * 신호 변화 감지 및 알림 조건 체크
   *
   * @param symbol 심볼
   * @param timeframe 시간봉
   * @param currentAnalysis 현재 분석 결과
   * @param lastAnalysis 이전 분석 결과
   * @returns 알림 배열
   */
  private detectSignalChanges(
    symbol: string,
    timeframe: TimeFrame,
    currentAnalysis: any,
    lastAnalysis: any,
  ): Array<{
    type: string;
    message: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }> {
    const alerts: Array<{
      type: string;
      message: string;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
    }> = [];

    // 1. 강한 매수/매도 신호 신규 발생
    if (
      currentAnalysis.overallSignal === SignalType.STRONG_BUY &&
      lastAnalysis?.signal !== SignalType.STRONG_BUY &&
      currentAnalysis.overallConfidence >= 80
    ) {
      alerts.push({
        type: 'STRONG_BUY_SIGNAL',
        message: `🚀 ${symbol} ${timeframe} 강한 매수 신호!\n신뢰도: ${currentAnalysis.overallConfidence}%\n합의도: ${(currentAnalysis.consensus * 100).toFixed(1)}%`,
        priority: 'HIGH',
      });
    }

    if (
      currentAnalysis.overallSignal === SignalType.STRONG_SELL &&
      lastAnalysis?.signal !== SignalType.STRONG_SELL &&
      currentAnalysis.overallConfidence >= 80
    ) {
      alerts.push({
        type: 'STRONG_SELL_SIGNAL',
        message: `🔴 ${symbol} ${timeframe} 강한 매도 신호!\n신뢰도: ${currentAnalysis.overallConfidence}%\n합의도: ${(currentAnalysis.consensus * 100).toFixed(1)}%`,
        priority: 'HIGH',
      });
    }

    // 2. 200일선 돌파 감지
    const ma200Strategy = currentAnalysis.strategies.find(
      (s) => s.strategy === 'MA_200_BREAKOUT',
    );
    const lastMa200 = lastAnalysis?.strategies?.find(
      (s) => s.strategy === 'MA_200_BREAKOUT',
    );

    if (
      ma200Strategy?.signal === SignalType.BUY &&
      lastMa200?.signal !== SignalType.BUY &&
      ma200Strategy.confidence >= 70
    ) {
      alerts.push({
        type: 'MA200_BREAKOUT',
        message: `📈 ${symbol} ${timeframe} 200일선 돌파!\n신뢰도: ${ma200Strategy.confidence}%\n장기 상승 추세 전환 가능성`,
        priority: 'HIGH',
      });
    }

    // 3. 50일선 돌파 감지
    const ma50Strategy = currentAnalysis.strategies.find(
      (s) => s.strategy === 'MA_50_BREAKOUT',
    );
    const lastMa50 = lastAnalysis?.strategies?.find(
      (s) => s.strategy === 'MA_50_BREAKOUT',
    );

    if (
      ma50Strategy?.signal === SignalType.BUY &&
      lastMa50?.signal !== SignalType.BUY &&
      ma50Strategy.confidence >= 70
    ) {
      alerts.push({
        type: 'MA50_BREAKOUT',
        message: `📊 ${symbol} ${timeframe} 50일선 돌파!\n신뢰도: ${ma50Strategy.confidence}%\n중기 상승 추세 시작`,
        priority: 'MEDIUM',
      });
    }

    // 4. 골든크로스 감지
    const goldenCross = currentAnalysis.strategies.find(
      (s) => s.strategy === 'GOLDEN_CROSS_50_200',
    );
    const lastGoldenCross = lastAnalysis?.strategies?.find(
      (s) => s.strategy === 'GOLDEN_CROSS_50_200',
    );

    if (
      goldenCross?.signal === SignalType.BUY &&
      lastGoldenCross?.signal !== SignalType.BUY &&
      goldenCross.confidence >= 75
    ) {
      alerts.push({
        type: 'GOLDEN_CROSS',
        message: `⭐ ${symbol} ${timeframe} 골든크로스 발생!\n신뢰도: ${goldenCross.confidence}%\n강력한 상승 신호 - 장기 상승 전환점`,
        priority: 'HIGH',
      });
    }

    // 5. RSI 과매도 바운스 신호
    const rsiSignal = currentAnalysis.strategies.find(
      (s) => s.strategy === 'RSI_OVERSOLD_BOUNCE',
    );
    const lastRsi = lastAnalysis?.strategies?.find(
      (s) => s.strategy === 'RSI_OVERSOLD_BOUNCE',
    );

    if (
      rsiSignal?.signal === SignalType.BUY &&
      lastRsi?.signal !== SignalType.BUY &&
      rsiSignal.confidence >= 70
    ) {
      alerts.push({
        type: 'RSI_OVERSOLD_BOUNCE',
        message: `🔄 ${symbol} ${timeframe} RSI 과매도 반등!\n신뢰도: ${rsiSignal.confidence}%\n단기 반등 기회`,
        priority: 'MEDIUM',
      });
    }

    return alerts;
  }

  /**
   * 텔레그램 알림 발송
   *
   * @param alert 알림 정보
   */
  private async sendTelegramAlert(alert: {
    type: string;
    message: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }): Promise<void> {
    try {
      console.log(`📱 텔레그램 알림 발송: ${alert.type}`);
      console.log(alert.message);

      // TODO: 실제 텔레그램 API 호출
      // await this.telegramService.sendMessage(alert.message, alert.priority);
    } catch (error) {
      console.error(`❌ 텔레그램 알림 발송 실패:`, error);
    }
  }

  /**
   * 정기 전체 스캔 (WebSocket 보완용)
   *
   * 매 15분마다 모든 코인을 전체 스캔하여
   * WebSocket으로 놓칠 수 있는 신호를 보완합니다.
   */
  @Cron(CronExpression.EVERY_15_MINUTES)
  async performFullScan(): Promise<void> {
    console.log('🔍 정기 전체 스캔 시작');

    try {
      // 강한 매수 신호 검색
      const buySignals =
        await this.technicalAnalysisService.findStrongBuySignals(
          this.WATCH_SYMBOLS,
          75, // 최소 75% 신뢰도
        );

      for (const { symbol, result } of buySignals) {
        await this.sendTelegramAlert({
          type: 'PERIODIC_SCAN_BUY',
          message: `🔍 정기스캔: ${symbol} 강한 매수 신호\n신뢰도: ${result.overallConfidence}%\n상위 전략들이 매수 신호 합의`,
          priority: 'MEDIUM',
        });
      }

      console.log(`✅ 정기 전체 스캔 완료: ${buySignals.length}개 신호 발견`);
    } catch (error) {
      console.error('❌ 정기 전체 스캔 실패:', error);
    }
  }

  /**
   * 시장 모니터링 상태 조회
   */
  getMonitoringStatus() {
    return {
      watchingSymbols: this.WATCH_SYMBOLS.length,
      activeSubscriptions: this.subscriptions.size,
      cacheEntries: this.lastAnalysisCache.size,
      timeframes: this.WATCH_TIMEFRAMES,
      isRunning: this.subscriptions.size > 0,
    };
  }

  /**
   * 모니터링 중지
   */
  stopMonitoring(): void {
    console.log('🛑 실시간 모니터링 중지');

    for (const [symbol, subscriptionKey] of this.subscriptions) {
      this.wsClient.unsubscribe(subscriptionKey);
      console.log(`❌ ${symbol} 모니터링 중지`);
    }

    this.subscriptions.clear();
    this.lastAnalysisCache.clear();
  }

  /**
   * 특정 심볼 모니터링 추가
   */
  addSymbolMonitoring(symbol: string): void {
    if (this.subscriptions.has(symbol)) {
      console.log(`⚠️ ${symbol} 이미 모니터링 중`);
      return;
    }

    const subscriptionKey = this.wsClient.subscribeKline(
      symbol,
      '1m',
      (klineData) => this.handleKlineUpdate(symbol, klineData),
      false,
    );

    this.subscriptions.set(symbol, subscriptionKey);
    console.log(`✅ ${symbol} 모니터링 추가`);
  }

  /**
   * 특정 심볼 모니터링 제거
   */
  removeSymbolMonitoring(symbol: string): void {
    const subscriptionKey = this.subscriptions.get(symbol);
    if (subscriptionKey) {
      this.wsClient.unsubscribe(subscriptionKey);
      this.subscriptions.delete(symbol);
      console.log(`❌ ${symbol} 모니터링 제거`);
    }
  }
}
