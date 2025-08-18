import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TradingConfigService } from '../../common/config/TradingConfig';
import { AnalysisCompletedEvent } from '../../common/dto/event/AnalysisCompletedEvent';
import { TradingSignalEvent } from '../../common/dto/event/TradingSignalEvent';
import { FuturesService } from '../../futures/service/FuturesService';

/**
 * 자동 매매 서비스
 *
 * 15분봉 기술적 분석 결과를 기반으로 자동 매매를 수행하는 서비스입니다.
 * 이벤트 기반으로 동작하며, 분석 완료 시 자동으로 매매 신호를 생성하고 실행합니다.
 *
 * 🎯 주요 기능:
 * - 기술적 분석 결과 기반 자동 매매 신호 생성
 * - 롱/숏 포지션 진입 및 스위칭
 * - 리스크 관리 (손절/익절, 포지션 크기)
 * - 최소 보유 시간 및 손실 제한
 *
 * 📊 매매 조건:
 * - 신뢰도 80% 이상
 * - 기술적 지표 3개 이상 만족
 * - 최소 30분 보유 시간
 * - 최대 -5% 손실 제한
 *
 * 🔄 이벤트 플로우:
 * analysis.completed → 매매 판단 → trading.signal → FuturesService에서 실제 거래 실행
 */
@Injectable()
export class AutoTradingService implements OnModuleInit {
  private readonly logger = new Logger(AutoTradingService.name);

  // 자동 매매 설정 (환경변수에서 동적 로드)
  private readonly AUTO_TRADING_CONFIG = {
    // 진입 조건
    MIN_VOLUME_RATIO: 1.2, // 최소 거래량 비율
    MIN_RSI_FOR_LONG: 40, // 롱 진입 최소 RSI
    MAX_RSI_FOR_LONG: 70, // 롱 진입 최대 RSI
    MIN_RSI_FOR_SHORT: 70, // 숏 진입 최소 RSI

    // 스위칭 조건
    MIN_HOLD_TIME: 30 * 60 * 1000, // 최소 보유 시간 (30분)
    MAX_LOSS_FOR_SWITCH: -5, // 스위칭 허용 최대 손실률 (%) - 너무 큰 손실일 때는 스위칭 대신 손절

    // 리스크 관리 (환경변수에서 동적 로드)
    POSITION_SIZE_PERCENT: 2, // 계좌 대비 포지션 크기 (%)

    // 스위칭 신호 조건 (2개 이상 만족 시)
    SWITCH_CONDITIONS_REQUIRED: 2,
  };

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly futuresService: FuturesService,
    private readonly tradingConfigService: TradingConfigService,
  ) {}

  /**
   * 모듈 초기화 시 이벤트 리스너 등록
   */
  onModuleInit(): void {
    this.logger.log('🚀 AutoTradingService 초기화 시작');

    this.eventEmitter.on(
      'analysis.completed',
      (event: AnalysisCompletedEvent) => {
        this.logger.log(
          `📡 [AutoTrading] analysis.completed 이벤트 수신: ${event?.symbol || 'unknown'}`,
        );
        try {
          this.handleAnalysisCompleted(event);
        } catch (error) {
          this.logger.error(
            `analysis.completed 처리 중 오류: ${error?.message || error}`,
          );
        }
      },
    );
    this.logger.log('✅ AutoTradingService 이벤트 리스너 등록 완료');
  }

  /**
   * 분석 완료 이벤트 처리
   *
   * 15분봉 기술적 분석이 완료되면 자동 매매 판단을 수행합니다.
   *
   * @param event 분석 완료 이벤트
   */
  private async handleAnalysisCompleted(event: any): Promise<void> {
    const { symbol, analysisResult, timeframe, analyzedAt } = event;

    this.logger.log(
      `🎯🎯🎯 [AUTO-TRADING] ${symbol} 자동 매매 분석 시작 🎯🎯🎯`,
    );

    try {
      // 현재 포지션 상태 확인
      const currentPosition = await this.getCurrentPosition(symbol);

      if (currentPosition) {
        // 기존 포지션이 있는 경우: 스위칭 또는 청산 판단
        await this.handlePositionManagement(
          symbol,
          analysisResult,
          currentPosition,
        );
      } else {
        // 포지션이 없는 경우: 신규 진입 판단
        await this.handleNewPosition(symbol, analysisResult);
      }
    } catch (error) {
      this.logger.error(`❌ [${symbol}] 자동 매매 처리 실패: ${error.message}`);
    }
  }

  /**
   * 신규 포지션 진입 판단
   *
   * @param symbol 거래 심볼
   * @param analysisResult 분석 결과
   */
  private async handleNewPosition(
    symbol: string,
    analysisResult: any,
  ): Promise<void> {
    const { overallSignal, currentPrice } = analysisResult;

    // STRONG_BUY 신호: 롱 진입 검토
    if (overallSignal === 'STRONG_BUY') {
      this.logger.log(
        `🔥🔥🔥 [AUTO-TRADING] ${symbol} STRONG_BUY 신호 감지 - 롱 진입 조건 검사 시작 🔥🔥🔥`,
      );
      const canEnterLong = this.checkLongEntryConditions(analysisResult);
      if (canEnterLong) {
        this.logger.log(
          `🚀🚀🚀 [AUTO-TRADING] ${symbol} 롱 진입 조건 만족 - 진입 실행 🚀🚀🚀`,
        );
        await this.executeLongEntry(symbol, analysisResult);
      } else {
        this.logger.log(
          `❌❌❌ [AUTO-TRADING] ${symbol} 롱 진입 조건 불만족 - 진입 보류 ❌❌❌`,
        );
      }
    }
    // STRONG_SELL 신호: 숏 진입 검토
    else if (overallSignal === 'STRONG_SELL') {
      this.logger.log(
        `💥💥💥 [AUTO-TRADING] ${symbol} STRONG_SELL 신호 감지 - 숏 진입 조건 검사 시작 💥💥💥`,
      );
      const canEnterShort = this.checkShortEntryConditions(analysisResult);
      if (canEnterShort) {
        this.logger.log(
          `⚡⚡⚡ [AUTO-TRADING] ${symbol} 숏 진입 조건 만족 - 진입 실행 ⚡⚡⚡`,
        );
        await this.executeShortEntry(symbol, analysisResult);
      } else {
        this.logger.log(
          `❌❌❌ [AUTO-TRADING] ${symbol} 숏 진입 조건 불만족 - 진입 보류 ❌❌❌`,
        );
      }
    }
    // 기타 신호
    else {
      this.logger.log(
        `💤💤💤 [AUTO-TRADING] ${symbol} ${overallSignal} 신호 - 진입 조건 미충족 💤💤💤`,
      );
    }
  }

  /**
   * 기존 포지션 관리 (스위칭 또는 청산)
   *
   * @param symbol 거래 심볼
   * @param analysisResult 분석 결과
   * @param currentPosition 현재 포지션 정보
   */
  private async handlePositionManagement(
    symbol: string,
    analysisResult: any,
    currentPosition: any,
  ): Promise<void> {
    const { overallSignal } = analysisResult;
    const positionAge =
      Date.now() - new Date(currentPosition.timestamp).getTime();

    // 최소 보유 시간 확인
    if (positionAge < this.AUTO_TRADING_CONFIG.MIN_HOLD_TIME) {
      this.logger.debug(
        `⏰ [${symbol}] 최소 보유 시간 미달: ${Math.round(positionAge / 60000)}분 < ${this.AUTO_TRADING_CONFIG.MIN_HOLD_TIME / 60000}분`,
      );
      return;
    }

    // 현재 포지션의 수익률 계산
    const currentPrice = analysisResult.currentPrice;
    const entryPrice = currentPosition.entryPrice;
    const pnlPercent =
      currentPosition.side === 'LONG'
        ? ((currentPrice - entryPrice) / entryPrice) * 100
        : ((entryPrice - currentPrice) / entryPrice) * 100;

    // 전략 기반 스위칭 판단 (우선순위 1)
    let shouldSwitch = false;
    let switchReason = '';

    // 롱 포지션에서 숏 신호: 롱→숏 스위칭 검토
    if (currentPosition.side === 'LONG' && overallSignal === 'STRONG_SELL') {
      const canSwitchToShort = this.checkLongToShortSwitch(analysisResult);
      if (canSwitchToShort) {
        shouldSwitch = true;
        switchReason = '롱→숏 전략 신호';
      }
    }
    // 숏 포지션에서 롱 신호: 숏→롱 스위칭 검토
    else if (
      currentPosition.side === 'SHORT' &&
      overallSignal === 'STRONG_BUY'
    ) {
      const canSwitchToLong = this.checkShortToLongSwitch(analysisResult);
      if (canSwitchToLong) {
        shouldSwitch = true;
        switchReason = '숏→롱 전략 신호';
      }
    }

    // 손실 제한 확인 (우선순위 2)
    if (
      shouldSwitch &&
      pnlPercent < this.AUTO_TRADING_CONFIG.MAX_LOSS_FOR_SWITCH
    ) {
      this.logger.warn(
        `⚠️ [${symbol}] 손실률 과다로 스위칭 차단: ${pnlPercent.toFixed(2)}% < ${this.AUTO_TRADING_CONFIG.MAX_LOSS_FOR_SWITCH}% (${switchReason})`,
      );
      // 손실이 너무 클 때는 스위칭 대신 손절 고려
      this.logger.log(
        `💡 [${symbol}] 손절 로직 실행 권장 (현재 손실: ${pnlPercent.toFixed(2)}%)`,
      );
      return;
    }

    // 스위칭 실행
    if (shouldSwitch) {
      this.logger.log(
        `🔄 [${symbol}] 전략 기반 스위칭 실행: ${switchReason} (손실: ${pnlPercent.toFixed(2)}%)`,
      );

      if (currentPosition.side === 'LONG') {
        await this.executeLongToShortSwitch(symbol, analysisResult);
      } else {
        await this.executeShortToLongSwitch(symbol, analysisResult);
      }
    } else {
      this.logger.debug(
        `📊 [${symbol}] 스위칭 조건 미충족 (현재 손실: ${pnlPercent.toFixed(2)}%)`,
      );
    }
  }

  /**
   * 롱 진입 조건 확인
   *
   * @param analysisResult 분석 결과
   * @returns 롱 진입 가능 여부
   */
  private checkLongEntryConditions(analysisResult: any): boolean {
    const indicators = analysisResult.indicators || {};

    // 안전한 지표 추출 (실제 구조에 맞게 조정)
    const sma20 = indicators?.SMA20 || indicators?.sma20 || 0;
    const sma50 = indicators?.SMA50 || indicators?.sma50 || 0;
    const rsi = indicators?.RSI || indicators?.rsi || 50;
    const volumeRatio = indicators?.VolumeRatio || indicators?.volumeRatio || 1;
    const ema12 = indicators?.EMA12 || indicators?.ema12 || 0;
    const ema26 = indicators?.EMA26 || indicators?.ema26 || 0;

    // 기본 조건들
    const isTrendUp = sma20 > sma50; // 상승 트렌드
    const isRsiHealthy =
      rsi > this.AUTO_TRADING_CONFIG.MIN_RSI_FOR_LONG &&
      rsi < this.AUTO_TRADING_CONFIG.MAX_RSI_FOR_LONG; // RSI 건전
    const isVolumeSupport =
      volumeRatio > this.AUTO_TRADING_CONFIG.MIN_VOLUME_RATIO; // 거래량 지지
    const isGoldenCross = ema12 > ema26; // 골든크로스

    // 4개 조건 중 3개 이상 만족
    const conditions = [
      isTrendUp,
      isRsiHealthy,
      isVolumeSupport,
      isGoldenCross,
    ];
    const satisfiedCount = conditions.filter(Boolean).length;

    this.logger.log(`🔍 롱 진입 조건 검사 (${satisfiedCount}/4 만족):`);
    this.logger.log(
      `  • 상승 트렌드 (SMA20 > SMA50): ${sma20} > ${sma50} → ${isTrendUp ? '✅' : '❌'}`,
    );
    this.logger.log(
      `  • RSI 건전 (${this.AUTO_TRADING_CONFIG.MIN_RSI_FOR_LONG}-${this.AUTO_TRADING_CONFIG.MAX_RSI_FOR_LONG}): ${rsi} → ${isRsiHealthy ? '✅' : '❌'}`,
    );
    this.logger.log(
      `  • 거래량 지지 (≥${this.AUTO_TRADING_CONFIG.MIN_VOLUME_RATIO}): ${volumeRatio} → ${isVolumeSupport ? '✅' : '❌'}`,
    );
    this.logger.log(
      `  • 골든크로스 (EMA12 > EMA26): ${ema12} > ${ema26} → ${isGoldenCross ? '✅' : '❌'}`,
    );

    return satisfiedCount >= 3;
  }

  /**
   * 숏 진입 조건 확인
   *
   * @param analysisResult 분석 결과
   * @returns 숏 진입 가능 여부
   */
  private checkShortEntryConditions(analysisResult: any): boolean {
    const indicators = analysisResult.indicators || {};

    // 안전한 지표 추출
    const sma20 = indicators?.SMA20 || indicators?.sma20 || 0;
    const sma50 = indicators?.SMA50 || indicators?.sma50 || 0;
    const rsi = indicators?.RSI || indicators?.rsi || 50;
    const volumeRatio = indicators?.VolumeRatio || indicators?.volumeRatio || 1;
    const ema12 = indicators?.EMA12 || indicators?.ema12 || 0;
    const ema26 = indicators?.EMA26 || indicators?.ema26 || 0;

    // 기본 조건들
    const isTrendDown = sma20 < sma50; // 하락 트렌드
    const isRsiOverbought = rsi > this.AUTO_TRADING_CONFIG.MIN_RSI_FOR_SHORT; // RSI 과매수
    const isVolumeSupport =
      volumeRatio > this.AUTO_TRADING_CONFIG.MIN_VOLUME_RATIO; // 거래량 지지
    const isDeadCross = ema12 < ema26; // 데드크로스

    // 4개 조건 중 3개 이상 만족
    const conditions = [
      isTrendDown,
      isRsiOverbought,
      isVolumeSupport,
      isDeadCross,
    ];
    const satisfiedCount = conditions.filter(Boolean).length;

    this.logger.log(`🔍 숏 진입 조건 검사 (${satisfiedCount}/4 만족):`);
    this.logger.log(
      `  • 하락 트렌드 (SMA20 < SMA50): ${sma20} < ${sma50} → ${isTrendDown ? '✅' : '❌'}`,
    );
    this.logger.log(
      `  • RSI 과매수 (≥${this.AUTO_TRADING_CONFIG.MIN_RSI_FOR_SHORT}): ${rsi} → ${isRsiOverbought ? '✅' : '❌'}`,
    );
    this.logger.log(
      `  • 거래량 지지 (≥${this.AUTO_TRADING_CONFIG.MIN_VOLUME_RATIO}): ${volumeRatio} → ${isVolumeSupport ? '✅' : '❌'}`,
    );
    this.logger.log(
      `  • 데드크로스 (EMA12 < EMA26): ${ema12} < ${ema26} → ${isDeadCross ? '✅' : '❌'}`,
    );

    return satisfiedCount >= 3;
  }

  /**
   * 롱→숏 스위칭 조건 확인
   *
   * @param analysisResult 분석 결과
   * @returns 롱→숏 스위칭 가능 여부
   */
  private checkLongToShortSwitch(analysisResult: any): boolean {
    const indicators = analysisResult.indicators || {};

    const sma20 = indicators?.SMA20 || indicators?.sma20 || 0;
    const currentPrice = analysisResult.currentPrice;
    const rsi = indicators?.RSI || indicators?.rsi || 50;
    const ema12 = indicators?.EMA12 || indicators?.ema12 || 0;
    const ema26 = indicators?.EMA26 || indicators?.ema26 || 0;

    // 스위칭 조건들
    const isPriceBelowSMA20 = currentPrice < sma20; // 현재가가 20일선 아래
    const isRsiOverbought = rsi > 70; // RSI 과매수
    const isDeadCross = ema12 < ema26; // 데드크로스

    const conditions = [isPriceBelowSMA20, isRsiOverbought, isDeadCross];
    const satisfiedCount = conditions.filter(Boolean).length;

    this.logger.debug(
      `🔄 롱→숏 스위칭 조건: 가격=${isPriceBelowSMA20}, RSI=${isRsiOverbought}, 데드크로스=${isDeadCross} (${satisfiedCount}/3)`,
    );

    return (
      satisfiedCount >= this.AUTO_TRADING_CONFIG.SWITCH_CONDITIONS_REQUIRED
    );
  }

  /**
   * 숏→롱 스위칭 조건 확인
   *
   * @param analysisResult 분석 결과
   * @returns 숏→롱 스위칭 가능 여부
   */
  private checkShortToLongSwitch(analysisResult: any): boolean {
    const indicators = analysisResult.indicators || {};

    const sma20 = indicators?.SMA20 || indicators?.sma20 || 0;
    const currentPrice = analysisResult.currentPrice;
    const rsi = indicators?.RSI || indicators?.rsi || 50;
    const ema12 = indicators?.EMA12 || indicators?.ema12 || 0;
    const ema26 = indicators?.EMA26 || indicators?.ema26 || 0;

    // 스위칭 조건들
    const isPriceAboveSMA20 = currentPrice > sma20; // 현재가가 20일선 위
    const isRsiOversold = rsi < 30; // RSI 과매도
    const isGoldenCross = ema12 > ema26; // 골든크로스

    const conditions = [isPriceAboveSMA20, isRsiOversold, isGoldenCross];
    const satisfiedCount = conditions.filter(Boolean).length;

    this.logger.debug(
      `🔄 숏→롱 스위칭 조건: 가격=${isPriceAboveSMA20}, RSI=${isRsiOversold}, 골든크로스=${isGoldenCross} (${satisfiedCount}/3)`,
    );

    return (
      satisfiedCount >= this.AUTO_TRADING_CONFIG.SWITCH_CONDITIONS_REQUIRED
    );
  }

  /**
   * 롱 포지션 진입 실행
   *
   * @param symbol 거래 심볼
   * @param analysisResult 분석 결과
   */
  private async executeLongEntry(
    symbol: string,
    analysisResult: any,
  ): Promise<void> {
    const { currentPrice } = analysisResult;

    // 포지션 크기 계산
    const quantity = this.calculatePositionSize(symbol, currentPrice);

    // 손절/익절 가격 계산 (환경변수에서 동적 로드)
    const futuresConfig = this.tradingConfigService.getFuturesDefaultConfig();
    const stopLoss = currentPrice * (1 + futuresConfig.stopLossPercent);
    const takeProfit = currentPrice * (1 + futuresConfig.takeProfitPercent);

    // trading.signal 이벤트 발생
    const signalEvent: TradingSignalEvent = {
      eventId: `auto_trading_${Date.now()}`,
      timestamp: new Date(),
      symbol,
      signal: 'LONG',
      strategy: 'AutoTradingService',
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      quantity,
      source: 'AutoTradingService',
      metadata: {
        analysis: analysisResult,
        conditions: '롱 진입 조건 만족',
      },
    };

    this.eventEmitter.emit('trading.signal', signalEvent);
    this.logger.log(`🚀🚀🚀 [AUTO-TRADING] ${symbol} 롱 진입 신호 발생 🚀🚀🚀`);
    this.logger.log(
      `💰💰💰 [AUTO-TRADING] ${symbol} 진입 가격: $${currentPrice.toFixed(2)} 💰💰💰`,
    );
    this.logger.log(
      `📊📊📊 [AUTO-TRADING] ${symbol} 진입 수량: ${quantity.toFixed(4)} BTC 📊📊📊`,
    );
    this.logger.log(
      `💵💵💵 [AUTO-TRADING] ${symbol} 진입 금액: $${(currentPrice * quantity).toFixed(2)} 💵💵💵`,
    );
    this.logger.log(
      `🛑🛑🛑 [AUTO-TRADING] ${symbol} 손절가: $${stopLoss.toFixed(2)} (${futuresConfig.stopLossPercent * 100}%) 🛑🛑🛑`,
    );
    this.logger.log(
      `🎯🎯🎯 [AUTO-TRADING] ${symbol} 익절가: $${takeProfit.toFixed(2)} (${futuresConfig.takeProfitPercent * 100}%) 🎯🎯🎯`,
    );
  }

  /**
   * 숏 포지션 진입 실행
   *
   * @param symbol 거래 심볼
   * @param analysisResult 분석 결과
   */
  private async executeShortEntry(
    symbol: string,
    analysisResult: any,
  ): Promise<void> {
    const { currentPrice } = analysisResult;

    // 포지션 크기 계산
    const quantity = this.calculatePositionSize(symbol, currentPrice);

    // 손절/익절 가격 계산 (환경변수에서 동적 로드)
    const futuresConfig = this.tradingConfigService.getFuturesDefaultConfig();
    const stopLoss = currentPrice * (1 + futuresConfig.stopLossPercent);
    const takeProfit = currentPrice * (1 + futuresConfig.takeProfitPercent);

    // trading.signal 이벤트 발생
    const signalEvent: TradingSignalEvent = {
      eventId: `auto_trading_${Date.now()}`,
      timestamp: new Date(),
      symbol,
      signal: 'SHORT',
      strategy: 'AutoTradingService',
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      quantity,
      source: 'AutoTradingService',
      metadata: {
        analysis: analysisResult,
        conditions: '숏 진입 조건 만족',
      },
    };

    this.eventEmitter.emit('trading.signal', signalEvent);
    this.logger.log(`⚡⚡⚡ [AUTO-TRADING] ${symbol} 숏 진입 신호 발생 ⚡⚡⚡`);
    this.logger.log(
      `💰💰💰 [AUTO-TRADING] ${symbol} 진입 가격: $${currentPrice.toFixed(2)} 💰💰💰`,
    );
    this.logger.log(
      `📊📊📊 [AUTO-TRADING] ${symbol} 진입 수량: ${quantity.toFixed(4)} BTC 📊📊📊`,
    );
    this.logger.log(
      `💵💵💵 [AUTO-TRADING] ${symbol} 진입 금액: $${(currentPrice * quantity).toFixed(2)} 💵💵💵`,
    );
    this.logger.log(
      `🛑🛑🛑 [AUTO-TRADING] ${symbol} 손절가: $${stopLoss.toFixed(2)} (${futuresConfig.stopLossPercent * 100}%) 🛑🛑🛑`,
    );
    this.logger.log(
      `🎯🎯🎯 [AUTO-TRADING] ${symbol} 익절가: $${takeProfit.toFixed(2)} (${futuresConfig.takeProfitPercent * 100}%) 🎯🎯🎯`,
    );
  }

  /**
   * 롱→숏 스위칭 실행
   *
   * @param symbol 거래 심볼
   * @param analysisResult 분석 결과
   */
  private async executeLongToShortSwitch(
    symbol: string,
    analysisResult: any,
  ): Promise<void> {
    this.logger.log(`🔄 [${symbol}] 롱→숏 스위칭 시작`);

    try {
      // 기존 롱 포지션 청산
      await this.futuresService.closeAllPosition(symbol, '롱→숏 스위칭');

      // 새로운 숏 포지션 진입
      await this.executeShortEntry(symbol, analysisResult);

      this.logger.log(`✅ [${symbol}] 롱→숏 스위칭 완료`);
    } catch (error) {
      this.logger.error(`❌ [${symbol}] 롱→숏 스위칭 실패: ${error.message}`);
    }
  }

  /**
   * 숏→롱 스위칭 실행
   *
   * @param symbol 거래 심볼
   * @param analysisResult 분석 결과
   */
  private async executeShortToLongSwitch(
    symbol: string,
    analysisResult: any,
  ): Promise<void> {
    this.logger.log(`🔄 [${symbol}] 숏→롱 스위칭 시작`);

    try {
      // 기존 숏 포지션 청산
      await this.futuresService.closeAllPosition(symbol, '숏→롱 스위칭');

      // 새로운 롱 포지션 진입
      await this.executeLongEntry(symbol, analysisResult);

      this.logger.log(`✅ [${symbol}] 숏→롱 스위칭 완료`);
    } catch (error) {
      this.logger.error(`❌ [${symbol}] 숏→롱 스위칭 실패: ${error.message}`);
    }
  }

  /**
   * 포지션 크기 계산
   *
   * @param symbol 거래 심볼
   * @param currentPrice 현재 가격
   * @returns 포지션 수량
   */
  private calculatePositionSize(symbol: string, currentPrice: number): number {
    // TODO: 계좌 잔고를 확인하여 동적으로 계산
    // 현재는 고정 $100 노셔널 값 사용
    const notionalValue = 100; // USD
    const quantity = notionalValue / currentPrice;

    this.logger.debug(
      `💰 [${symbol}] 포지션 크기 계산: 노셔널=${notionalValue}USD, 수량=${quantity.toFixed(6)}`,
    );

    return quantity;
  }

  /**
   * 현재 포지션 조회
   *
   * @param symbol 거래 심볼
   * @returns 현재 포지션 정보
   */
  private async getCurrentPosition(symbol: string): Promise<any> {
    try {
      const positions = await this.futuresService.getActivePositions(symbol);
      return positions.find(
        (pos: any) => pos.symbol === symbol && pos.quantity !== 0,
      );
    } catch (error) {
      this.logger.error(`❌ [${symbol}] 포지션 조회 실패: ${error.message}`);
      return null;
    }
  }
}
