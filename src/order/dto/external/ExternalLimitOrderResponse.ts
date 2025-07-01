export class ExternalLimitOrderResponse {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  status: string;
  type: string;
  side: string;
  timeInForce: string;
  transactTime: number;

  // 선택적으로 추가
  fills: any[];
  origQuoteOrderQty?: string;
  cummulativeQuoteQty?: string;
  workingTime?: number;
  selfTradePreventionMode?: string;

  static from(raw: any): ExternalLimitOrderResponse {
    const dto = new ExternalLimitOrderResponse();
    dto.symbol = raw.symbol;
    dto.orderId = raw.orderId;
    dto.clientOrderId = raw.clientOrderId;
    dto.price = raw.price;
    dto.origQty = raw.origQty;
    dto.executedQty = raw.executedQty;
    dto.status = raw.status;
    dto.type = raw.type;
    dto.side = raw.side;
    dto.timeInForce = raw.timeInForce;
    dto.transactTime = raw.transactTime;
    dto.fills = raw.fills;
    dto.origQuoteOrderQty = raw.origQuoteOrderQty;
    dto.cummulativeQuoteQty = raw.cummulativeQuoteQty;
    dto.workingTime = raw.workingTime;
    dto.selfTradePreventionMode = raw.selfTradePreventionMode;
    return dto;
  }
}
