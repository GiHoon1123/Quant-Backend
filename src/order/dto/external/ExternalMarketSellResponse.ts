export class ExternalMarketSellResponse {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  transactTime: number;
  price: string; // MARKET 주문은 0.00000000
  origQty: string;
  executedQty: string;
  origQuoteOrderQty: string;
  cummulativeQuoteQty: string;
  status: string;
  timeInForce: string;
  type: string; // "MARKET"
  side: 'SELL';
  workingTime?: number;
  selfTradePreventionMode?: string;

  fills?: {
    price: string;
    qty: string;
    commission: string;
    commissionAsset: string; // 매도는 보통 USDT
    tradeId: number;
  }[];

  static from(raw: any): ExternalMarketSellResponse {
    const dto = new ExternalMarketSellResponse();
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
    dto.selfTradePreventionMode = raw.selfTradePreventionMode;
    dto.fills = raw.fills;
    return dto;
  }
}
