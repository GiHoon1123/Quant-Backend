import { Injectable } from '@nestjs/common';
import {
  CalculatedStopLossTakeProfit,
  StopLossConfig,
  StopLossTakeProfitType,
  TakeProfitConfig,
} from '../types/StopLossTakeProfit';

/**
 * 손절/익절 가격 계산 유틸리티 서비스
 *
 * @description 퍼센트나 절대가격 설정을 바탕으로 실제 손절/익절 가격을 계산하는 서비스입니다.
 * 현물과 선물 거래 모두에서 사용할 수 있습니다.
 */
@Injectable()
export class StopLossTakeProfitCalculator {
  /**
   * 현물 거래용 손절/익절 가격 계산
   *
   * @description 현물 거래에서 진입가를 기준으로 손절/익절 가격을 계산합니다.
   * 현물은 롱 포지션만 가능하므로 계산이 단순합니다.
   *
   * @param entryPrice 진입가 (USDT 기준)
   * @param stopLoss 손절 설정
   * @param takeProfit 익절 설정
   * @returns 계산된 손절/익절 가격
   *
   * @example
   * // 50,000 USDT에 진입, 5% 손절, 10% 익절
   * const result = calculateSpotStopLossTakeProfit(50000,
   *   { type: 'PERCENT', value: 0.05 },
   *   { type: 'PERCENT', value: 0.10 }
   * );
   * // result: { stopLossPrice: 47500, takeProfitPrice: 55000 }
   */
  calculateSpotStopLossTakeProfit(
    entryPrice: number,
    stopLoss: StopLossConfig,
    takeProfit: TakeProfitConfig,
  ): CalculatedStopLossTakeProfit {
    const stopLossPrice = this.calculateStopLossPrice(
      entryPrice,
      stopLoss,
      'LONG',
    );
    const takeProfitPrice = this.calculateTakeProfitPrice(
      entryPrice,
      takeProfit,
      'LONG',
    );

    return {
      stopLossPrice,
      takeProfitPrice,
    };
  }

  /**
   * 선물 거래용 손절/익절 가격 계산
   *
   * @description 선물 거래에서 진입가와 포지션 방향을 기준으로 손절/익절 가격을 계산합니다.
   * 롱/숏 포지션에 따라 계산 방식이 달라집니다.
   *
   * @param entryPrice 진입가 (USDT 기준)
   * @param positionSide 포지션 방향 ('LONG' | 'SHORT')
   * @param stopLoss 손절 설정
   * @param takeProfit 익절 설정
   * @returns 계산된 손절/익절 가격
   *
   * @example
   * // 롱 포지션: 50,000 USDT에 진입, 2% 손절, 4% 익절
   * const longResult = calculateFuturesStopLossTakeProfit(50000, 'LONG',
   *   { type: 'PERCENT', value: 0.02 },
   *   { type: 'PERCENT', value: 0.04 }
   * );
   * // longResult: { stopLossPrice: 49000, takeProfitPrice: 52000 }
   *
   * // 숏 포지션: 50,000 USDT에 진입, 2% 손절, 4% 익절
   * const shortResult = calculateFuturesStopLossTakeProfit(50000, 'SHORT',
   *   { type: 'PERCENT', value: 0.02 },
   *   { type: 'PERCENT', value: 0.04 }
   * );
   * // shortResult: { stopLossPrice: 51000, takeProfitPrice: 48000 }
   */
  calculateFuturesStopLossTakeProfit(
    entryPrice: number,
    positionSide: 'LONG' | 'SHORT',
    stopLoss: StopLossConfig,
    takeProfit: TakeProfitConfig,
  ): CalculatedStopLossTakeProfit {
    const stopLossPrice = this.calculateStopLossPrice(
      entryPrice,
      stopLoss,
      positionSide,
    );
    const takeProfitPrice = this.calculateTakeProfitPrice(
      entryPrice,
      takeProfit,
      positionSide,
    );

    return {
      stopLossPrice,
      takeProfitPrice,
    };
  }

  /**
   * 손절가 계산 (내부 메서드)
   *
   * @description 포지션 방향과 설정에 따라 손절가를 계산합니다.
   * - 롱 포지션: 진입가보다 낮은 가격에서 손절
   * - 숏 포지션: 진입가보다 높은 가격에서 손절
   *
   * @param entryPrice 진입가
   * @param stopLoss 손절 설정
   * @param positionSide 포지션 방향
   * @returns 계산된 손절가 (미설정 시 null)
   */
  private calculateStopLossPrice(
    entryPrice: number,
    stopLoss: StopLossConfig,
    positionSide: 'LONG' | 'SHORT',
  ): number | null {
    // 손절이 미설정된 경우
    if (stopLoss.type === StopLossTakeProfitType.NONE || !stopLoss.value) {
      return null;
    }

    // 절대 가격으로 설정된 경우
    if (stopLoss.type === StopLossTakeProfitType.PRICE) {
      return stopLoss.value;
    }

    // 퍼센트로 설정된 경우
    if (stopLoss.type === StopLossTakeProfitType.PERCENT) {
      if (positionSide === 'LONG') {
        // 롱 포지션: 진입가 * (1 - 손절비율)
        // 예: 50,000 * (1 - 0.05) = 47,500 (5% 하락 시 손절)
        return entryPrice * (1 - stopLoss.value);
      } else {
        // 숏 포지션: 진입가 * (1 + 손절비율)
        // 예: 50,000 * (1 + 0.05) = 52,500 (5% 상승 시 손절)
        return entryPrice * (1 + stopLoss.value);
      }
    }

    return null;
  }

  /**
   * 익절가 계산 (내부 메서드)
   *
   * @description 포지션 방향과 설정에 따라 익절가를 계산합니다.
   * - 롱 포지션: 진입가보다 높은 가격에서 익절
   * - 숏 포지션: 진입가보다 낮은 가격에서 익절
   *
   * @param entryPrice 진입가
   * @param takeProfit 익절 설정
   * @param positionSide 포지션 방향
   * @returns 계산된 익절가 (미설정 시 null)
   */
  private calculateTakeProfitPrice(
    entryPrice: number,
    takeProfit: TakeProfitConfig,
    positionSide: 'LONG' | 'SHORT',
  ): number | null {
    // 익절이 미설정된 경우
    if (takeProfit.type === StopLossTakeProfitType.NONE || !takeProfit.value) {
      return null;
    }

    // 절대 가격으로 설정된 경우
    if (takeProfit.type === StopLossTakeProfitType.PRICE) {
      return takeProfit.value;
    }

    // 퍼센트로 설정된 경우
    if (takeProfit.type === StopLossTakeProfitType.PERCENT) {
      if (positionSide === 'LONG') {
        // 롱 포지션: 진입가 * (1 + 익절비율)
        // 예: 50,000 * (1 + 0.10) = 55,000 (10% 상승 시 익절)
        return entryPrice * (1 + takeProfit.value);
      } else {
        // 숏 포지션: 진입가 * (1 - 익절비율)
        // 예: 50,000 * (1 - 0.10) = 45,000 (10% 하락 시 익절)
        return entryPrice * (1 - takeProfit.value);
      }
    }

    return null;
  }

  /**
   * 손절/익절 설정 유효성 검증
   *
   * @description 사용자가 입력한 손절/익절 설정이 유효한지 검증합니다.
   *
   * @param stopLoss 손절 설정
   * @param takeProfit 익절 설정
   * @param positionSide 포지션 방향
   * @returns 유효성 검증 결과와 오류 메시지
   *
   * @example
   * const validation = validateStopLossTakeProfit(
   *   { type: 'PERCENT', value: 0.05 },
   *   { type: 'PERCENT', value: 0.10 },
   *   'LONG'
   * );
   * // validation: { isValid: true, errors: [] }
   */
  validateStopLossTakeProfit(
    stopLoss: StopLossConfig,
    takeProfit: TakeProfitConfig,
    positionSide: 'LONG' | 'SHORT',
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 손절 설정 검증
    if (stopLoss.type !== StopLossTakeProfitType.NONE) {
      if (!stopLoss.value || stopLoss.value <= 0) {
        errors.push('손절 값은 0보다 커야 합니다.');
      }

      if (
        stopLoss.type === StopLossTakeProfitType.PERCENT &&
        stopLoss.value &&
        stopLoss.value >= 1
      ) {
        errors.push('손절 퍼센트는 100% 미만이어야 합니다.');
      }
    }

    // 익절 설정 검증
    if (takeProfit.type !== StopLossTakeProfitType.NONE) {
      if (!takeProfit.value || takeProfit.value <= 0) {
        errors.push('익절 값은 0보다 커야 합니다.');
      }

      if (
        takeProfit.type === StopLossTakeProfitType.PERCENT &&
        takeProfit.value &&
        takeProfit.value >= 1
      ) {
        errors.push('익절 퍼센트는 100% 미만이어야 합니다.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
