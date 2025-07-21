import { Injectable } from '@nestjs/common';
import { Candle15MRepository } from '../../market-data/infra/persistence/repository/Candle15MRepository';
import { StrategyResult } from '../types/StrategyTypes';
import { CandleData } from '../types/TechnicalAnalysisTypes';

/**
 * 🛡️ 리스크 관리 서비스
 *
 * 모든 전략에 적용할 수 있는 리스크 관리 기능들을 제공합니다.
 * 손실 제한, 포지션 사이징, 포트폴리오 관리 등을 담당합니다.
 */
@Injectable()
export class RiskManagementService {
  constructor(private readonly candleRepository: Candle15MRepository) {}

  /**
   * 📊 포지션 사이징 계산
   * Kelly Criterion과 Fixed Fractional 방식을 조합하여 최적 포지션 크기 계산
   */
  calculatePositionSize(
    accountBalance: number,
    winRate: number,
    avgWin: number,
    avgLoss: number,
    maxRiskPerTrade: number = 0.02, // 2% 기본 리스크
  ): {
    kellySize: number;
    fixedFractionalSize: number;
    recommendedSize: number;
    riskAmount: number;
  } {
    // Kelly Criterion: f = (bp - q) / b
    // b = avgWin/avgLoss, p = winRate, q = 1-winRate
    const b = avgWin / avgLoss;
    const p = winRate;
    const q = 1 - winRate;
    const kellyFraction = (b * p - q) / b;

    // Kelly 사이즈 (보수적으로 25% 적용)
    const kellySize = Math.max(
      0,
      Math.min(kellyFraction * 0.25, maxRiskPerTrade),
    );

    // Fixed Fractional (고정 비율)
    const fixedFractionalSize = maxRiskPerTrade;

    // 추천 사이즈 (두 방식의 평균, 보수적 접근)
    const recommendedSize = Math.min(kellySize, fixedFractionalSize);
    const riskAmount = accountBalance * recommendedSize;

    return {
      kellySize,
      fixedFractionalSize,
      recommendedSize,
      riskAmount,
    };
  }

  /**
   * 🎯 동적 손절매 계산
   * ATR 기반 동적 손절매 레벨 계산
   */
  async calculateDynamicStopLoss(
    symbol: string,
    entryPrice: number,
    direction: 'LONG' | 'SHORT',
    atrMultiplier: number = 2.0,
  ): Promise<{
    stopLoss: number;
    atr: number;
    riskPercentage: number;
  }> {
    const candles = await this.candleRepository.findLatestCandles(
      symbol,
      'FUTURES',
      50,
    );

    // ATR (Average True Range) 계산
    const atr = this.calculateATR(candles, 14);
    const currentATR = atr[atr.length - 1];

    let stopLoss: number;
    if (direction === 'LONG') {
      stopLoss = entryPrice - currentATR * atrMultiplier;
    } else {
      stopLoss = entryPrice + currentATR * atrMultiplier;
    }

    const riskPercentage = Math.abs(entryPrice - stopLoss) / entryPrice;

    return {
      stopLoss,
      atr: currentATR,
      riskPercentage,
    };
  }

  /**
   * 📈 트레일링 스탑 계산
   * 수익이 발생할 때 손절매를 따라 올리는 트레일링 스탑
   */
  calculateTrailingStop(
    entryPrice: number,
    currentPrice: number,
    highestPrice: number,
    direction: 'LONG' | 'SHORT',
    trailPercentage: number = 0.05, // 5% 트레일링
  ): {
    trailingStop: number;
    shouldUpdate: boolean;
    unrealizedPnL: number;
  } {
    let trailingStop: number;
    let shouldUpdate = false;
    let unrealizedPnL: number;

    if (direction === 'LONG') {
      trailingStop = highestPrice * (1 - trailPercentage);
      shouldUpdate = currentPrice > highestPrice;
      unrealizedPnL = ((currentPrice - entryPrice) / entryPrice) * 100;
    } else {
      trailingStop = highestPrice * (1 + trailPercentage);
      shouldUpdate = currentPrice < highestPrice;
      unrealizedPnL = ((entryPrice - currentPrice) / entryPrice) * 100;
    }

    return {
      trailingStop,
      shouldUpdate,
      unrealizedPnL,
    };
  }

  /**
   * 🔥 드로우다운 분석
   * 최대 손실 구간 분석 및 회복 시간 계산
   */
  analyzeDrawdown(equityCurve: number[]): {
    maxDrawdown: number;
    maxDrawdownDuration: number;
    currentDrawdown: number;
    recoveryFactor: number;
  } {
    let peak = equityCurve[0];
    let maxDrawdown = 0;
    let maxDrawdownDuration = 0;
    let currentDrawdownStart = 0;
    let currentDrawdown = 0;

    for (let i = 1; i < equityCurve.length; i++) {
      if (equityCurve[i] > peak) {
        peak = equityCurve[i];
        currentDrawdownStart = i;
      } else {
        const drawdown = (peak - equityCurve[i]) / peak;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
          maxDrawdownDuration = i - currentDrawdownStart;
        }
      }
    }

    // 현재 드로우다운
    const currentPeak = Math.max(...equityCurve);
    const currentValue = equityCurve[equityCurve.length - 1];
    currentDrawdown = (currentPeak - currentValue) / currentPeak;

    // 회복 팩터 (총 수익 / 최대 드로우다운)
    const totalReturn = (currentValue - equityCurve[0]) / equityCurve[0];
    const recoveryFactor = maxDrawdown > 0 ? totalReturn / maxDrawdown : 0;

    return {
      maxDrawdown,
      maxDrawdownDuration,
      currentDrawdown,
      recoveryFactor,
    };
  }

  /**
   * ⚡ 실시간 리스크 모니터링
   * 현재 포지션들의 리스크를 실시간으로 모니터링
   */
  async monitorRealTimeRisk(
    positions: Array<{
      symbol: string;
      side: 'LONG' | 'SHORT';
      size: number;
      entryPrice: number;
      currentPrice: number;
    }>,
    accountBalance: number,
  ): Promise<{
    totalRisk: number;
    portfolioVaR: number; // Value at Risk
    riskWarnings: string[];
    recommendations: string[];
  }> {
    let totalRisk = 0;
    const riskWarnings: string[] = [];
    const recommendations: string[] = [];

    // 각 포지션의 리스크 계산
    for (const position of positions) {
      const positionRisk =
        Math.abs(position.currentPrice - position.entryPrice) /
        position.entryPrice;
      const positionValue = position.size * position.currentPrice;
      const riskAmount = positionValue * positionRisk;

      totalRisk += riskAmount;

      // 개별 포지션 리스크 경고
      if (positionRisk > 0.1) {
        // 10% 이상 손실
        riskWarnings.push(
          `${position.symbol}: 높은 손실 위험 (${(positionRisk * 100).toFixed(1)}%)`,
        );
        recommendations.push(`${position.symbol} 포지션 축소 고려`);
      }
    }

    // 포트폴리오 전체 리스크
    const portfolioRiskRatio = totalRisk / accountBalance;

    // VaR 계산 (95% 신뢰구간)
    const portfolioVaR = totalRisk * 1.65; // 정규분포 가정

    // 전체 포트폴리오 경고
    if (portfolioRiskRatio > 0.2) {
      // 20% 이상
      riskWarnings.push('포트폴리오 전체 리스크 과도');
      recommendations.push('전체 포지션 크기 축소 필요');
    }

    if (positions.length > 10) {
      riskWarnings.push('과도한 포지션 수');
      recommendations.push('포지션 수 축소 및 집중 투자');
    }

    return {
      totalRisk: portfolioRiskRatio,
      portfolioVaR,
      riskWarnings,
      recommendations,
    };
  }

  /**
   * 🎯 전략별 리스크 조정
   * 각 전략의 과거 성과를 바탕으로 리스크를 조정
   */
  adjustStrategyRisk(
    strategyResult: StrategyResult,
    historicalPerformance: {
      winRate: number;
      avgWin: number;
      avgLoss: number;
      sharpeRatio: number;
      maxDrawdown: number;
    },
  ): {
    adjustedConfidence: number;
    recommendedRisk: number;
    riskAdjustmentFactor: number;
  } {
    const baseConfidence = strategyResult.confidence;

    // 샤프 비율 기반 조정
    const sharpeAdjustment = Math.min(historicalPerformance.sharpeRatio / 2, 1);

    // 승률 기반 조정
    const winRateAdjustment = historicalPerformance.winRate;

    // 최대 드로우다운 기반 조정 (드로우다운이 클수록 리스크 감소)
    const drawdownAdjustment = Math.max(
      0.5,
      1 - historicalPerformance.maxDrawdown,
    );

    // 종합 조정 팩터
    const riskAdjustmentFactor =
      (sharpeAdjustment + winRateAdjustment + drawdownAdjustment) / 3;

    const adjustedConfidence = baseConfidence * riskAdjustmentFactor;
    const recommendedRisk = 0.02 * riskAdjustmentFactor; // 기본 2%에서 조정

    return {
      adjustedConfidence,
      recommendedRisk,
      riskAdjustmentFactor,
    };
  }

  // 헬퍼 메서드들
  private calculateATR(candles: CandleData[], period: number): number[] {
    const atr: number[] = [];

    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose),
      );

      if (i === 1) {
        atr.push(tr);
      } else {
        const prevATR = atr[atr.length - 1];
        const currentATR = (prevATR * (period - 1) + tr) / period;
        atr.push(currentATR);
      }
    }

    return atr;
  }
}
