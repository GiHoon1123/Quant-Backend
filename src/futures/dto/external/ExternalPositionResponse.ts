/**
 * 바이낸스 선물 포지션 정보 API 응답 DTO
 *
 * 바이낸스 /fapi/v2/positionRisk 엔드포인트에서 반환하는 응답 구조입니다.
 * 현재 보유중인 모든 포지션의 상세 정보를 포함합니다.
 */
export class ExternalPositionResponse {
  /** 거래 심볼 (예: BTCUSDT) */
  symbol: string;

  /** 포지션 수량 (양수: 롱, 음수: 숏, 0: 포지션 없음) */
  positionAmt: string;

  /** 포지션 진입 가격 (평균 체결 가격) */
  entryPrice: string;

  /** 현재 손익 (PnL) - 실현되지 않은 손익 */
  unRealizedProfit: string;

  /** 포지션 사이드 (BOTH, LONG, SHORT) */
  positionSide: string;

  /** 격리 마진 (격리마진 모드일 때만 해당) */
  isolatedMargin: string;

  /** 유지 마진율 (청산 위험도를 나타내는 지표) */
  maintMarginRatio: string;

  /** 초기 마진율 (포지션 진입에 필요한 마진 비율) */
  initialMarginRatio: string;

  /** 포지션 노션값 (현재 포지션의 총 가치) */
  notional: string;

  /** 격리 지갑 잔고 (격리마진 모드일 때의 전용 지갑) */
  isolatedWallet: string;

  /** 현재 시장 가격 (마크 가격) */
  markPrice: string;

  /** 청산 가격 (이 가격에 도달하면 강제 청산) */
  liquidationPrice: string;

  /** 마진 타입 (isolated: 격리마진, cross: 교차마진) */
  marginType: string;

  /** 레버리지 배수 */
  leverage: string;

  /** 최대 노션값 (해당 레버리지로 보유 가능한 최대 포지션 크기) */
  maxNotionalValue: string;

  /** 포지션 업데이트 시간 (Unix timestamp) */
  updateTime: number;

  /**
   * 바이낸스 API 원시 응답을 이 DTO로 변환하는 정적 메서드
   * @param raw 바이낸스 API에서 받은 원시 응답 데이터
   * @returns 변환된 ExternalPositionResponse 객체
   */
  static from(raw: any): ExternalPositionResponse {
    const response = new ExternalPositionResponse();
    response.symbol = raw.symbol;
    response.positionAmt = raw.positionAmt;
    response.entryPrice = raw.entryPrice;
    response.unRealizedProfit = raw.unRealizedProfit;
    response.positionSide = raw.positionSide;
    response.isolatedMargin = raw.isolatedMargin;
    response.maintMarginRatio = raw.maintMarginRatio;
    response.initialMarginRatio = raw.initialMarginRatio;
    response.notional = raw.notional;
    response.isolatedWallet = raw.isolatedWallet;
    response.markPrice = raw.markPrice;
    response.liquidationPrice = raw.liquidationPrice;
    response.marginType = raw.marginType;
    response.leverage = raw.leverage;
    response.maxNotionalValue = raw.maxNotionalValue;
    response.updateTime = raw.updateTime;
    return response;
  }

  /**
   * 배열 형태의 바이낸스 API 응답을 DTO 배열로 변환
   * @param rawList 바이낸스 API에서 받은 원시 응답 배열
   * @returns 변환된 ExternalPositionResponse 배열
   */
  static fromList(rawList: any[]): ExternalPositionResponse[] {
    return rawList.map((raw) => ExternalPositionResponse.from(raw));
  }
}
