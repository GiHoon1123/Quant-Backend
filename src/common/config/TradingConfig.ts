import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 거래 관련 환경변수 설정 서비스
 *
 * @description 손절/익절 기본값 등 거래 관련 환경변수를 관리하는 서비스입니다.
 * 자동매매/전략에서만 기본값을 사용하며, 수동 거래에서는 사용하지 않습니다.
 */
@Injectable()
export class TradingConfigService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * 현물 거래 기본 손절 비율 조회
   *
   * @description 자동매매/전략에서 사용할 현물 거래의 기본 손절 비율을 반환합니다.
   * 환경변수 SPOT_DEFAULT_STOP_LOSS_PERCENT에서 값을 읽어옵니다.
   *
   * @returns 현물 기본 손절 비율 (0.03 = 3%)
   * @default 0.03 (3%)
   *
   * @example
   * const stopLoss = getSpotDefaultStopLossPercent(); // 0.03 (3% 하락 시 손절)
   */
  getSpotDefaultStopLossPercent(): number {
    return this.configService.get<number>(
      'SPOT_DEFAULT_STOP_LOSS_PERCENT',
      0.03,
    );
  }

  /**
   * 현물 거래 기본 익절 비율 조회
   *
   * @description 자동매매/전략에서 사용할 현물 거래의 기본 익절 비율을 반환합니다.
   * 환경변수 SPOT_DEFAULT_TAKE_PROFIT_PERCENT에서 값을 읽어옵니다.
   *
   * @returns 현물 기본 익절 비율 (0.06 = 6%)
   * @default 0.06 (6%)
   *
   * @example
   * const takeProfit = getSpotDefaultTakeProfitPercent(); // 0.06 (6% 상승 시 익절)
   */
  getSpotDefaultTakeProfitPercent(): number {
    return this.configService.get<number>(
      'SPOT_DEFAULT_TAKE_PROFIT_PERCENT',
      0.06,
    );
  }

  /**
   * 선물 거래 기본 손절 비율 조회
   *
   * @description 자동매매/전략에서 사용할 선물 거래의 기본 손절 비율을 반환합니다.
   * 환경변수 FUTURES_DEFAULT_STOP_LOSS_PERCENT에서 값을 읽어옵니다.
   * 선물은 레버리지가 있어 현물보다 낮은 비율을 사용합니다.
   *
   * @returns 선물 기본 손절 비율 (0.02 = 2%)
   * @default 0.02 (2%)
   *
   * @example
   * const stopLoss = getFuturesDefaultStopLossPercent(); // 0.02 (2% 하락 시 손절)
   */
  getFuturesDefaultStopLossPercent(): number {
    return this.configService.get<number>(
      'FUTURES_DEFAULT_STOP_LOSS_PERCENT',
      0.02,
    );
  }

  /**
   * 선물 거래 기본 익절 비율 조회
   *
   * @description 자동매매/전략에서 사용할 선물 거래의 기본 익절 비율을 반환합니다.
   * 환경변수 FUTURES_DEFAULT_TAKE_PROFIT_PERCENT에서 값을 읽어옵니다.
   * 선물은 레버리지가 있어 현물보다 낮은 비율을 사용합니다.
   *
   * @returns 선물 기본 익절 비율 (0.04 = 4%)
   * @default 0.04 (4%)
   *
   * @example
   * const takeProfit = getFuturesDefaultTakeProfitPercent(); // 0.04 (4% 상승 시 익절)
   */
  getFuturesDefaultTakeProfitPercent(): number {
    return this.configService.get<number>(
      'FUTURES_DEFAULT_TAKE_PROFIT_PERCENT',
      0.04,
    );
  }

  /**
   * 현물 거래 기본 손절/익절 설정 조회
   *
   * @description 자동매매/전략에서 사용할 현물 거래의 기본 손절/익절 설정을 반환합니다.
   *
   * @returns 현물 기본 손절/익절 설정 객체
   *
   * @example
   * const config = getSpotDefaultConfig();
   * // { stopLossPercent: 0.03, takeProfitPercent: 0.06 }
   */
  getSpotDefaultConfig() {
    return {
      stopLossPercent: this.getSpotDefaultStopLossPercent(),
      takeProfitPercent: this.getSpotDefaultTakeProfitPercent(),
    };
  }

  /**
   * 선물 거래 기본 손절/익절 설정 조회
   *
   * @description 자동매매/전략에서 사용할 선물 거래의 기본 손절/익절 설정을 반환합니다.
   *
   * @returns 선물 기본 손절/익절 설정 객체
   *
   * @example
   * const config = getFuturesDefaultConfig();
   * // { stopLossPercent: 0.02, takeProfitPercent: 0.04 }
   */
  getFuturesDefaultConfig() {
    return {
      stopLossPercent: this.getFuturesDefaultStopLossPercent(),
      takeProfitPercent: this.getFuturesDefaultTakeProfitPercent(),
    };
  }
}
