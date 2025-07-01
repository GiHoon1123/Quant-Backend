export class ExternalCancelOrderResponse {
  symbol: string;
  origClientOrderId: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  transactTime: number;
  price: string;
  origQty: string;
  executedQty: string;
  origQuoteOrderQty: string;
  cummulativeQuoteQty: string;
  status: string;
  timeInForce: string;
  type: string;
  side: string;
  selfTradePreventionMode?: string;

  static from(raw: any): ExternalCancelOrderResponse {
    const dto = new ExternalCancelOrderResponse();
    dto.symbol = raw.symbol;
    dto.origClientOrderId = raw.origClientOrderId;
    dto.orderId = raw.orderId;
    dto.orderListId = raw.orderListId;
    dto.clientOrderId = raw.clientOrderId;
    dto.transactTime = raw.transactTime;
    dto.price = raw.price;
    dto.origQty = raw.origQty;
    dto.executedQty = raw.executedQty;
    dto.origQuoteOrderQty = raw.origQuoteOrderQty;
    dto.cummulativeQuoteQty = raw.cummulativeQuoteQty;
    dto.status = raw.status;
    dto.timeInForce = raw.timeInForce;
    dto.type = raw.type;
    dto.side = raw.side;
    dto.selfTradePreventionMode = raw.selfTradePreventionMode;
    return dto;
  }
}
