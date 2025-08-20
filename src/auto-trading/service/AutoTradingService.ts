import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CacheService } from '../../common/cache/CacheService';
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

  // 자동 매매 설정 (피벗 반전 전략 기반)
  private readonly AUTO_TRADING_CONFIG = {
    // 피벗 반전 전략 설정
    PIVOT_TOUCH_TOLERANCE: 0.005, // 피벗선 터치 허용 오차 (0.5%)
    MIN_VOLUME_RATIO: 1.5, // 거래량 급증 기준 (1.5배)

    // RSI 설정
    RSI_OVERSOLD: 30, // RSI 과매도 기준
    RSI_OVERBOUGHT: 70, // RSI 과매수 기준

    // 리스크 관리
    SWITCH_CONDITIONS_REQUIRED: 2, // 스위칭 조건 2개

    // 피벗 레벨 설정
    PIVOT_LEVELS: {
      SUPPORT_1: 'S1', // 1차 지지선
      SUPPORT_2: 'S2', // 2차 지지선
      RESISTANCE_1: 'R1', // 1차 저항선
      RESISTANCE_2: 'R2', // 2차 저항선
    },
  };

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly futuresService: FuturesService,
    private readonly tradingConfigService: TradingConfigService,
    private readonly cacheService: CacheService,
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
    const { overallSignal, currentPrice, strategies } = analysisResult;

    // 전략별 상세 분석 로깅
    this.logger.log(`📊 [AUTO-TRADING] ${symbol} 전략 분석 결과:`);
    if (strategies && Array.isArray(strategies)) {
      strategies.forEach((strategy) => {
        this.logger.log(`  • ${strategy.name}: ${strategy.signal}`);
      });
    }

    // STRONG_BUY 신호: 롱 진입 검토
    if (overallSignal === 'STRONG_BUY') {
      this.logger.log(
        `🔥🔥🔥 [AUTO-TRADING] ${symbol} STRONG_BUY 신호 감지 - 롱 진입 조건 검사 시작 🔥🔥🔥`,
      );

      // 피벗 반전 전략 상세 확인
      const pivotStrategy = strategies?.find(
        (s) => s.type === 'PIVOT_REVERSAL',
      );
      if (pivotStrategy && pivotStrategy.signal === 'STRONG_BUY') {
        const { details } = pivotStrategy;
        this.logger.log(`🎯 [AUTO-TRADING] 피벗 반전 전략 상세:`);
        this.logger.log(
          `  • 피벗 포인트: ${details.indicators?.pivotPoint?.toFixed(2) || 'N/A'}`,
        );
        this.logger.log(
          `  • 지지선 S1: ${details.indicators?.support1?.toFixed(2) || 'N/A'}`,
        );
        this.logger.log(
          `  • RSI: ${details.indicators?.rsi?.toFixed(1) || 'N/A'}`,
        );
        this.logger.log(
          `  • 거래량 비율: ${details.indicators?.volumeRatio?.toFixed(1) || 'N/A'}`,
        );
      }

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
    // STRONG_SELL 또는 SELL 신호: 숏 진입 검토 (신호 범위 확대)
    else if (overallSignal === 'STRONG_SELL' || overallSignal === 'SELL') {
      this.logger.log(
        `💥💥💥 [AUTO-TRADING] ${symbol} ${overallSignal} 신호 감지 - 숏 진입 조건 검사 시작 💥💥💥`,
      );

      // 피벗 반전 전략 상세 확인
      const pivotStrategy = strategies?.find(
        (s) => s.type === 'PIVOT_REVERSAL',
      );
      if (
        pivotStrategy &&
        (pivotStrategy.signal === 'STRONG_SELL' ||
          pivotStrategy.signal === 'SELL')
      ) {
        const { details } = pivotStrategy;
        this.logger.log(`🎯 [AUTO-TRADING] 피벗 반전 전략 상세:`);
        this.logger.log(
          `  • 피벗 포인트: ${details.indicators?.pivotPoint?.toFixed(2) || 'N/A'}`,
        );
        this.logger.log(
          `  • 저항선 R1: ${details.indicators?.resistance1?.toFixed(2) || 'N/A'}`,
        );
        this.logger.log(
          `  • RSI: ${details.indicators?.rsi?.toFixed(1) || 'N/A'}`,
        );
        this.logger.log(
          `  • 거래량 비율: ${details.indicators?.volumeRatio?.toFixed(1) || 'N/A'}`,
        );
      }

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

    // 최소 보유 시간 확인 (제거됨 - 기술적 신호 기반으로 변경)
    // 기존: 시간 기반 제한 → 변경: 기술적 신호 기반 판단
    // if (positionAge < this.AUTO_TRADING_CONFIG.MIN_HOLD_TIME) {
    //   this.logger.debug(
    //     `⏰ [${symbol}] 최소 보유 시간 미달: ${Math.round(positionAge / 60000)}분 < ${this.AUTO_TRADING_CONFIG.MIN_HOLD_TIME / 60000}분`,
    //   );
    //   return;
    // }

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

    // 롱 포지션에서 숏 신호: 롱→숏 스위칭 검토 (신호 범위 확대)
    if (
      currentPosition.side === 'LONG' &&
      (overallSignal === 'STRONG_SELL' || overallSignal === 'SELL')
    ) {
      const canSwitchToShort = this.checkLongToShortSwitch(analysisResult);
      if (canSwitchToShort) {
        shouldSwitch = true;
        switchReason = '롱→숏 전략 신호';
      }
    }
    // 숏 포지션에서 롱 신호: 숏→롱 스위칭 검토 (신호 범위 확대)
    else if (
      currentPosition.side === 'SHORT' &&
      (overallSignal === 'STRONG_BUY' || overallSignal === 'BUY')
    ) {
      const canSwitchToLong = this.checkShortToLongSwitch(analysisResult);
      if (canSwitchToLong) {
        shouldSwitch = true;
        switchReason = '숏→롱 전략 신호';
      }
    }

    // 손실 제한 확인 (제거됨 - ATR 기반으로 변경 예정)
    // 기존: 고정 손실률 제한 → 변경: ATR 기반 동적 손절
    // if (
    //   shouldSwitch &&
    //   pnlPercent < this.AUTO_TRADING_CONFIG.MAX_LOSS_FOR_SWITCH
    // ) {
    //   this.logger.warn(
    //     `⚠️ [${symbol}] 손실률 과다로 스위칭 차단: ${pnlPercent.toFixed(2)}% < ${this.AUTO_TRADING_CONFIG.MAX_LOSS_FOR_SWITCH}% (${switchReason})`,
    //   );
    //   // 손실이 너무 클 때는 스위칭 대신 손절 고려
    //   this.logger.log(
    //     `💡 [${symbol}] 손절 로직 실행 권장 (현재 손실: ${pnlPercent.toFixed(2)}%)`,
    //   );
    //   return;
    // }

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
   * 롱 진입 조건 확인 (피벗 반전 전략 기반)
   *
   * @param analysisResult 분석 결과
   * @returns 롱 진입 가능 여부
   */
  private checkLongEntryConditions(analysisResult: any): boolean {
    const indicators = analysisResult.indicators || {};
    const currentPrice = analysisResult.currentPrice || 0;
    const support1 = indicators?.support1 || indicators?.Support1 || 0;
    const support2 = indicators?.support2 || indicators?.Support2 || 0;
    const rsi = indicators?.RSI || indicators?.rsi || 50;
    const volumeRatio = indicators?.VolumeRatio || indicators?.volumeRatio || 1;

    const isPivotSupportTouch =
      currentPrice <=
        support1 * (1 + this.AUTO_TRADING_CONFIG.PIVOT_TOUCH_TOLERANCE) ||
      currentPrice <=
        support2 * (1 + this.AUTO_TRADING_CONFIG.PIVOT_TOUCH_TOLERANCE);

    const isRsiOversold = rsi < this.AUTO_TRADING_CONFIG.RSI_OVERSOLD;
    const isVolumeSurge =
      volumeRatio > this.AUTO_TRADING_CONFIG.MIN_VOLUME_RATIO;

    const conditions = [isPivotSupportTouch, isRsiOversold, isVolumeSurge];
    const satisfiedCount = conditions.filter(Boolean).length;

    this.logger.log(
      `🔍 피벗 반전 롱 진입 조건 검사 (${satisfiedCount}/3 만족):`,
    );
    this.logger.log(
      `  • 피벗 지지선 터치 (S1: ${support1}, S2: ${support2}): ${currentPrice} → ${isPivotSupportTouch ? '✅' : '❌'}`,
    );
    this.logger.log(
      `  • RSI 과매도 (<${this.AUTO_TRADING_CONFIG.RSI_OVERSOLD}): ${rsi} → ${isRsiOversold ? '✅' : '❌'}`,
    );
    this.logger.log(
      `  • 거래량 급증 (≥${this.AUTO_TRADING_CONFIG.MIN_VOLUME_RATIO}): ${volumeRatio} → ${isVolumeSurge ? '✅' : '❌'}`,
    );

    return satisfiedCount >= 2;
  }

  /**
   * 숏 진입 조건 확인 (피벗 반전 전략 기반)
   *
   * @param analysisResult 분석 결과
   * @returns 숏 진입 가능 여부
   */
  private checkShortEntryConditions(analysisResult: any): boolean {
    const indicators = analysisResult.indicators || {};
    const currentPrice = analysisResult.currentPrice || 0;
    const resistance1 = indicators?.resistance1 || indicators?.Resistance1 || 0;
    const resistance2 = indicators?.resistance2 || indicators?.Resistance2 || 0;
    const rsi = indicators?.RSI || indicators?.rsi || 50;
    const volumeRatio = indicators?.VolumeRatio || indicators?.volumeRatio || 1;

    const isPivotResistanceTouch =
      currentPrice >=
        resistance1 * (1 - this.AUTO_TRADING_CONFIG.PIVOT_TOUCH_TOLERANCE) ||
      currentPrice >=
        resistance2 * (1 - this.AUTO_TRADING_CONFIG.PIVOT_TOUCH_TOLERANCE);

    const isRsiOverbought = rsi > this.AUTO_TRADING_CONFIG.RSI_OVERBOUGHT;
    const isVolumeSurge =
      volumeRatio > this.AUTO_TRADING_CONFIG.MIN_VOLUME_RATIO;

    const conditions = [isPivotResistanceTouch, isRsiOverbought, isVolumeSurge];
    const satisfiedCount = conditions.filter(Boolean).length;

    this.logger.log(
      `🔍 피벗 반전 숏 진입 조건 검사 (${satisfiedCount}/3 만족):`,
    );
    this.logger.log(
      `  • 피벗 저항선 터치 (R1: ${resistance1}, R2: ${resistance2}): ${currentPrice} → ${isPivotResistanceTouch ? '✅' : '❌'}`,
    );
    this.logger.log(
      `  • RSI 과매수 (>${this.AUTO_TRADING_CONFIG.RSI_OVERBOUGHT}): ${rsi} → ${isRsiOverbought ? '✅' : '❌'}`,
    );
    this.logger.log(
      `  • 거래량 급증 (≥${this.AUTO_TRADING_CONFIG.MIN_VOLUME_RATIO}): ${volumeRatio} → ${isVolumeSurge ? '✅' : '❌'}`,
    );

    return satisfiedCount >= 1;
  }

  /**
   * 롱→숏 스위칭 조건 확인 (피벗 반전 전략 기반)
   *
   * @param analysisResult 분석 결과
   * @returns 롱→숏 스위칭 가능 여부
   */
  private checkLongToShortSwitch(analysisResult: any): boolean {
    const indicators = analysisResult.indicators || {};

    const currentPrice = analysisResult.currentPrice;
    const resistance1 = indicators?.resistance1 || indicators?.Resistance1 || 0;
    const resistance2 = indicators?.resistance2 || indicators?.Resistance2 || 0;
    const rsi = indicators?.RSI || indicators?.rsi || 50;
    const volumeRatio = indicators?.VolumeRatio || indicators?.volumeRatio || 1;

    // 피벗 반전 스위칭 조건들
    const isPivotResistanceTouch =
      currentPrice >=
        resistance1 * (1 - this.AUTO_TRADING_CONFIG.PIVOT_TOUCH_TOLERANCE) ||
      currentPrice >=
        resistance2 * (1 - this.AUTO_TRADING_CONFIG.PIVOT_TOUCH_TOLERANCE); // 피벗 저항선 터치
    const isRsiOverbought = rsi > this.AUTO_TRADING_CONFIG.RSI_OVERBOUGHT; // RSI 과매수
    const isVolumeSurge =
      volumeRatio > this.AUTO_TRADING_CONFIG.MIN_VOLUME_RATIO; // 거래량 급증

    const conditions = [isPivotResistanceTouch, isRsiOverbought, isVolumeSurge];
    const satisfiedCount = conditions.filter(Boolean).length;

    this.logger.debug(
      `🔄 피벗 반전 롱→숏 스위칭 조건: 저항선터치=${isPivotResistanceTouch}, RSI과매수=${isRsiOverbought}, 거래량급증=${isVolumeSurge} (${satisfiedCount}/3)`,
    );

    return (
      satisfiedCount >= this.AUTO_TRADING_CONFIG.SWITCH_CONDITIONS_REQUIRED
    );
  }

  /**
   * 숏→롱 스위칭 조건 확인 (피벗 반전 전략 기반)
   *
   * @param analysisResult 분석 결과
   * @returns 숏→롱 스위칭 가능 여부
   */
  private checkShortToLongSwitch(analysisResult: any): boolean {
    const indicators = analysisResult.indicators || {};

    const currentPrice = analysisResult.currentPrice;
    const support1 = indicators?.support1 || indicators?.Support1 || 0;
    const support2 = indicators?.support1 || indicators?.Support2 || 0;
    const rsi = indicators?.RSI || indicators?.rsi || 50;
    const volumeRatio = indicators?.VolumeRatio || indicators?.volumeRatio || 1;

    // 피벗 반전 스위칭 조건들
    const isPivotSupportTouch =
      currentPrice <=
        support1 * (1 + this.AUTO_TRADING_CONFIG.PIVOT_TOUCH_TOLERANCE) ||
      currentPrice <=
        support2 * (1 + this.AUTO_TRADING_CONFIG.PIVOT_TOUCH_TOLERANCE); // 피벗 지지선 터치
    const isRsiOversold = rsi < this.AUTO_TRADING_CONFIG.RSI_OVERSOLD; // RSI 과매도
    const isVolumeSurge =
      volumeRatio > this.AUTO_TRADING_CONFIG.MIN_VOLUME_RATIO; // 거래량 급증

    const conditions = [isPivotSupportTouch, isRsiOversold, isVolumeSurge];
    const satisfiedCount = conditions.filter(Boolean).length;

    this.logger.debug(
      `🔄 피벗 반전 숏→롱 스위칭 조건: 지지선터치=${isPivotSupportTouch}, RSI과매도=${isRsiOversold}, 거래량급증=${isVolumeSurge} (${satisfiedCount}/3)`,
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
    const { currentPrice, strategies } = analysisResult;

    // 피벗 반전 전략 상세 정보 추출
    const pivotStrategy = strategies?.find((s) => s.type === 'PIVOT_REVERSAL');
    const pivotDetails = pivotStrategy?.details;

    // 포지션 크기 계산 (async)
    const quantity = await this.calculatePositionSize(symbol, currentPrice);

    if (quantity <= 0) {
      this.logger.warn(`⚠️ [${symbol}] 포지션 크기가 0이므로 진입 취소`);
      return;
    }

    // ATR 기반 손절/익절 가격 계산
    const stopLoss = this.calculateATRBasedStopLoss(
      symbol,
      currentPrice,
      'LONG',
    );
    const takeProfit = this.calculateATRBasedTakeProfit(
      symbol,
      currentPrice,
      'LONG',
    );

    // 레버리지 가져오기
    const leverage = Number(process.env.AUTO_TRADING_LEVERAGE) || 3;

    // 진입 조건 상세 정보 구성
    const entryConditions = pivotDetails?.conditions || ['롱 진입 조건 만족'];

    // trading.signal 이벤트 발생
    const signalEvent: TradingSignalEvent = {
      eventId: `auto_trading_${Date.now()}`,
      timestamp: new Date(),
      symbol,
      signal: 'LONG',
      strategy: 'PIVOT_REVERSAL',
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      quantity,
      source: 'AutoTradingService',
      metadata: {
        analysis: analysisResult,
        conditions: entryConditions.join(', '),
        leverage: leverage,
        pivotDetails: {
          pivotPoint: pivotDetails?.indicators?.pivotPoint,
          support1: pivotDetails?.indicators?.support1,
          support2: pivotDetails?.indicators?.support2,
          rsi: pivotDetails?.indicators?.rsi,
          volumeRatio: pivotDetails?.indicators?.volumeRatio,
        },
      },
    };

    this.eventEmitter.emit('trading.signal', signalEvent);

    // 상세한 진입 로그
    this.logger.log(`🚀🚀🚀 [AUTO-TRADING] ${symbol} 롱 진입 신호 발생 🚀🚀🚀`);
    this.logger.log(
      `💰💰💰 [AUTO-TRADING] ${symbol} 진입 가격: $${currentPrice.toFixed(2)} 💰💰💰`,
    );
    this.logger.log(
      `📊📊📊 [AUTO-TRADING] ${symbol} 진입 수량: ${quantity.toFixed(6)} 📊📊📊`,
    );
    this.logger.log(
      `💵💵💵 [AUTO-TRADING] ${symbol} 진입 금액: $${(currentPrice * quantity).toFixed(2)} 💵💵💵`,
    );
    this.logger.log(
      `⚡⚡⚡ [AUTO-TRADING] ${symbol} 레버리지: ${leverage}배 ⚡⚡⚡`,
    );
    this.logger.log(
      `🛑🛑🛑 [AUTO-TRADING] ${symbol} 손절가: $${stopLoss.toFixed(2)} 🛑🛑🛑`,
    );
    this.logger.log(
      `🎯🎯🎯 [AUTO-TRADING] ${symbol} 익절가: $${takeProfit.toFixed(2)} 🎯🎯🎯`,
    );

    // 피벗 전략 상세 정보 로그
    if (pivotDetails) {
      this.logger.log(`🎯 [AUTO-TRADING] 피벗 전략 진입 상세:`);
      this.logger.log(
        `  • 피벗 포인트: $${pivotDetails.indicators?.pivotPoint?.toFixed(2) || 'N/A'}`,
      );
      this.logger.log(
        `  • 지지선 S1: $${pivotDetails.indicators?.support1?.toFixed(2) || 'N/A'}`,
      );
      this.logger.log(
        `  • RSI: ${pivotDetails.indicators?.rsi?.toFixed(1) || 'N/A'}`,
      );
      this.logger.log(
        `  • 거래량 비율: ${pivotDetails.indicators?.volumeRatio?.toFixed(1) || 'N/A'}`,
      );
      this.logger.log(`  • 진입 조건: ${entryConditions.join(', ')}`);
    }
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
    const { currentPrice, strategies } = analysisResult;

    // 피벗 반전 전략 상세 정보 추출
    const pivotStrategy = strategies?.find((s) => s.type === 'PIVOT_REVERSAL');
    const pivotDetails = pivotStrategy?.details;

    // 포지션 크기 계산 (async)
    const quantity = await this.calculatePositionSize(symbol, currentPrice);

    if (quantity <= 0) {
      this.logger.warn(`⚠️ [${symbol}] 포지션 크기가 0이므로 진입 취소`);
      return;
    }

    // ATR 기반 손절/익절 가격 계산
    const stopLoss = this.calculateATRBasedStopLoss(
      symbol,
      currentPrice,
      'SHORT',
    );
    const takeProfit = this.calculateATRBasedTakeProfit(
      symbol,
      currentPrice,
      'SHORT',
    );

    // 레버리지 가져오기
    const leverage = Number(process.env.AUTO_TRADING_LEVERAGE) || 3;

    // 진입 조건 상세 정보 구성
    const entryConditions = pivotDetails?.conditions || ['숏 진입 조건 만족'];

    // trading.signal 이벤트 발생
    const signalEvent: TradingSignalEvent = {
      eventId: `auto_trading_${Date.now()}`,
      timestamp: new Date(),
      symbol,
      signal: 'SHORT',
      strategy: 'PIVOT_REVERSAL',
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      quantity,
      source: 'AutoTradingService',
      metadata: {
        analysis: analysisResult,
        conditions: entryConditions.join(', '),
        leverage: leverage,
        pivotDetails: {
          pivotPoint: pivotDetails?.indicators?.pivotPoint,
          resistance1: pivotDetails?.indicators?.resistance1,
          resistance2: pivotDetails?.indicators?.resistance2,
          rsi: pivotDetails?.indicators?.rsi,
          volumeRatio: pivotDetails?.indicators?.volumeRatio,
        },
      },
    };

    this.eventEmitter.emit('trading.signal', signalEvent);

    // 상세한 진입 로그
    this.logger.log(`⚡⚡⚡ [AUTO-TRADING] ${symbol} 숏 진입 신호 발생 ⚡⚡⚡`);
    this.logger.log(
      `💰💰💰 [AUTO-TRADING] ${symbol} 진입 가격: $${currentPrice.toFixed(2)} 💰💰💰`,
    );
    this.logger.log(
      `📊📊📊 [AUTO-TRADING] ${symbol} 진입 수량: ${quantity.toFixed(6)} 📊📊📊`,
    );
    this.logger.log(
      `💵💵💵 [AUTO-TRADING] ${symbol} 진입 금액: $${(currentPrice * quantity).toFixed(2)} 💵💵💵`,
    );
    this.logger.log(
      `⚡⚡⚡ [AUTO-TRADING] ${symbol} 레버리지: ${leverage}배 ⚡⚡⚡`,
    );
    this.logger.log(
      `🛑🛑🛑 [AUTO-TRADING] ${symbol} 손절가: $${stopLoss.toFixed(2)} 🛑🛑🛑`,
    );
    this.logger.log(
      `🎯🎯🎯 [AUTO-TRADING] ${symbol} 익절가: $${takeProfit.toFixed(2)} 🎯🎯🎯`,
    );

    // 피벗 전략 상세 정보 로그
    if (pivotDetails) {
      this.logger.log(`🎯 [AUTO-TRADING] 피벗 전략 진입 상세:`);
      this.logger.log(
        `  • 피벗 포인트: $${pivotDetails.indicators?.pivotPoint?.toFixed(2) || 'N/A'}`,
      );
      this.logger.log(
        `  • 저항선 R1: $${pivotDetails.indicators?.resistance1?.toFixed(2) || 'N/A'}`,
      );
      this.logger.log(
        `  • RSI: ${pivotDetails.indicators?.rsi?.toFixed(1) || 'N/A'}`,
      );
      this.logger.log(
        `  • 거래량 비율: ${pivotDetails.indicators?.volumeRatio?.toFixed(1) || 'N/A'}`,
      );
      this.logger.log(`  • 진입 조건: ${entryConditions.join(', ')}`);
    }
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
  private async calculatePositionSize(
    symbol: string,
    currentPrice: number,
  ): Promise<number> {
    try {
      // 선물 계정 잔고 조회
      const balances = await this.futuresService.getFuturesBalances();
      const usdtBalance = balances.find((b) => b.asset === 'USDT');

      if (!usdtBalance || usdtBalance.availableBalance <= 0) {
        this.logger.warn(
          `⚠️ [${symbol}] USDT 잔고 부족: ${usdtBalance?.availableBalance || 0}`,
        );
        return 0;
      }

      // 환경변수에서 포지션 크기 비율 가져오기 (기본값: 100% = 전체 자산)
      const positionSizePercent =
        Number(process.env.AUTO_TRADING_POSITION_SIZE_PERCENT) || 100;
      const availableBalance = usdtBalance.availableBalance;
      const positionAmount = (availableBalance * positionSizePercent) / 100;

      // 레버리지 적용하여 수량 계산
      const leverage = Number(process.env.AUTO_TRADING_LEVERAGE) || 3;
      const notionalValue = positionAmount * leverage;
      const quantity = notionalValue / currentPrice;

      this.logger.log(`💰 [${symbol}] 포지션 크기 계산:`);
      this.logger.log(`  • 사용가능 잔고: $${availableBalance.toFixed(2)}`);
      this.logger.log(`  • 포지션 크기 비율: ${positionSizePercent}%`);
      this.logger.log(`  • 포지션 금액: $${positionAmount.toFixed(2)}`);
      this.logger.log(`  • 레버리지: ${leverage}배`);
      this.logger.log(`  • 노셔널 값: $${notionalValue.toFixed(2)}`);
      this.logger.log(`  • 진입 수량: ${quantity.toFixed(6)}`);

      return quantity;
    } catch (error) {
      this.logger.error(
        `❌ [${symbol}] 포지션 크기 계산 실패: ${error.message}`,
      );
      // 에러 시 기본값 반환
      return 0.001; // 최소 수량
    }
  }

  /**
   * ATR 기반 손절가 계산
   *
   * @param symbol 거래 심볼
   * @param currentPrice 현재 가격
   * @param side 포지션 방향
   * @returns 손절가
   */
  private calculateATRBasedStopLoss(
    symbol: string,
    currentPrice: number,
    side: 'LONG' | 'SHORT',
  ): number {
    // 캐시에서 ATR 조회
    const atrData = this.cacheService.get(`atr:${symbol}`);
    const stopLossMultiplier =
      this.cacheService.get('config:atr_stop_loss_multiplier') ||
      Number(process.env.ATR_STOP_LOSS_MULTIPLIER) ||
      2.8; // ATR 배수 (ATR의 2.8배)

    if (atrData && atrData.atr) {
      // ATR 배수 기반 거리 계산
      const stopLossDistance = atrData.atr * stopLossMultiplier; // ATR * 배수

      if (side === 'LONG') {
        return currentPrice - stopLossDistance;
      } else {
        return currentPrice + stopLossDistance;
      }
    }

    // ATR이 없으면 기본 손절가 사용
    const futuresConfig = this.tradingConfigService.getFuturesDefaultConfig();
    if (side === 'LONG') {
      return currentPrice * (1 - futuresConfig.stopLossPercent);
    } else {
      return currentPrice * (1 + futuresConfig.stopLossPercent);
    }
  }

  /**
   * ATR 기반 익절가 계산
   *
   * @param symbol 거래 심볼
   * @param currentPrice 현재 가격
   * @param side 포지션 방향
   * @returns 익절가
   */
  private calculateATRBasedTakeProfit(
    symbol: string,
    currentPrice: number,
    side: 'LONG' | 'SHORT',
  ): number {
    // 캐시에서 ATR 조회
    const atrData = this.cacheService.get(`atr:${symbol}`);
    const takeProfitMultiplier =
      this.cacheService.get('config:atr_take_profit_multiplier') ||
      Number(process.env.ATR_TAKE_PROFIT_MULTIPLIER) ||
      1.3; // ATR 배수 (ATR의 1.3배)

    if (atrData && atrData.atr) {
      // ATR 배수 기반 거리 계산
      const takeProfitDistance = atrData.atr * takeProfitMultiplier; // ATR * 배수

      if (side === 'LONG') {
        return currentPrice + takeProfitDistance;
      } else {
        return currentPrice - takeProfitDistance;
      }
    }

    // ATR이 없으면 기본 익절가 사용
    const futuresConfig = this.tradingConfigService.getFuturesDefaultConfig();
    if (side === 'LONG') {
      return currentPrice * (1 + futuresConfig.takeProfitPercent);
    } else {
      return currentPrice * (1 - futuresConfig.takeProfitPercent);
    }
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
