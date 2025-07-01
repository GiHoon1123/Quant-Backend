export class ExternalMarketBuyResponse {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  transactTime: number;
  price: string; // 항상 0.00000000
  origQty: string;
  executedQty: string;
  origQuoteOrderQty: string;
  cummulativeQuoteQty: string;
  status: string;
  timeInForce: string;
  type: string;
  side: string;
  workingTime?: number;
  fills?: {
    price: string;
    qty: string;
    commission: string;
    commissionAsset: string;
    tradeId: number;
  }[];
  selfTradePreventionMode?: string;

  static from(raw: any): ExternalMarketBuyResponse {
    const dto = new ExternalMarketBuyResponse();
    dto.symbol = raw.symbol;
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
    dto.workingTime = raw.workingTime;
    dto.fills = raw.fills;
    dto.selfTradePreventionMode = raw.selfTradePreventionMode;
    return dto;
  }
}
