import { ExternalPositionResponse } from '../external/ExternalPositionResponse';

/**
 * 현재 포지션 정보 응답 DTO
 *
 * 사용자가 현재 보유중인 포지션의 상세 정보를 제공합니다.
 * 손익, 청산가격, 레버리지 등 중요한 정보들을 포함합니다.
 */
export class PositionInfoResponse {
  /** 거래 심볼 (예: BTCUSDT) */
  symbol: string;

  /** 포지션 수량 (양수: 롱, 음수: 숏, 0: 포지션 없음) */
  quantity: number;

  /** 포지션 방향 (LONG, SHORT, NONE) */
  side: 'LONG' | 'SHORT' | 'NONE';

  /** 포지션 진입 평균 가격 */
  entryPrice: number;

  /** 현재 마크 가격 (청산 계산 기준 가격) */
  markPrice: number;

  /** 미실현 손익 (USDT 기준) */
  unrealizedPnl: number;

  /** 미실현 손익률 (%) */
  unrealizedPnlPercent: number;

  /** 청산 가격 (이 가격에 도달하면 강제 청산) */
  liquidationPrice: number;

  /** 현재 레버리지 배수 */
  leverage: number;

  /** 마진 모드 (ISOLATED: 격리마진, CROSSED: 교차마진) */
  marginType: 'ISOLATED' | 'CROSSED';

  /** 포지션 가치 (현재 포지션의 총 가치, USDT 기준) */
  notionalValue: number;

  /** 격리 마진 (격리마진 모드일 때만) */
  isolatedMargin: number;

  /** 유지 마진율 (청산 위험도, 낮을수록 안전) */
  maintMarginRatio: number;

  /** 마지막 업데이트 시간 */
  updateTime: Date;

  /**
   * 외부 바이낸스 API 응답을 내부 응답 DTO로 변환
   * @param external 바이낸스 API에서 받은 외부 응답 DTO
   * @returns 변환된 PositionInfoResponse 객체
   */
  static from(external: ExternalPositionResponse): PositionInfoResponse {
    const response = new PositionInfoResponse();

    response.symbol = external.symbol;
    response.quantity = parseFloat(external.positionAmt);

    // 포지션 방향 결정
    if (response.quantity > 0) {
      response.side = 'LONG';
    } else if (response.quantity < 0) {
      response.side = 'SHORT';
      response.quantity = Math.abs(response.quantity); // 수량은 항상 양수로 표시
    } else {
      response.side = 'NONE';
    }

    response.entryPrice = parseFloat(external.entryPrice);
    response.markPrice = parseFloat(external.markPrice);
    response.unrealizedPnl = parseFloat(external.unRealizedProfit);

    // 손익률 계산 (진입가격 대비 현재 손익의 비율)
    if (response.entryPrice > 0) {
      response.unrealizedPnlPercent =
        (response.unrealizedPnl /
          (response.entryPrice * Math.abs(parseFloat(external.positionAmt)))) *
        100;
    } else {
      response.unrealizedPnlPercent = 0;
    }

    response.liquidationPrice = parseFloat(external.liquidationPrice);
    response.leverage = parseInt(external.leverage);
    response.marginType = external.marginType.toUpperCase() as
      | 'ISOLATED'
      | 'CROSSED';
    response.notionalValue = Math.abs(parseFloat(external.notional));
    response.isolatedMargin = parseFloat(external.isolatedMargin);
    response.maintMarginRatio = parseFloat(external.maintMarginRatio);
    response.updateTime = new Date(external.updateTime);

    return response;
  }

  /**
   * 배열 형태의 외부 응답을 내부 응답 배열로 변환
   * 포지션이 있는 것만 필터링하여 반환
   * @param externalList 외부 응답 DTO 배열
   * @returns 포지션이 있는 PositionInfoResponse 배열
   */
  static fromList(
    externalList: ExternalPositionResponse[],
  ): PositionInfoResponse[] {
    return externalList
      .map((external) => PositionInfoResponse.from(external))
      .filter((position) => position.side !== 'NONE'); // 포지션이 있는 것만 반환
  }
}
