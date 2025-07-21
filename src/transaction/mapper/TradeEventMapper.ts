// 거래 이벤트 매핑 책임 클래스 예시
import { TradeExecutedEvent } from '../dto/events/TradeExecutedEvent';
import { SpotTradeRecord } from '../infra/persistence/entity/SpotTradeRecordEntity';

export class TradeEventMapper {
  static toEntity(event: TradeExecutedEvent): SpotTradeRecord {
    return {
      symbol: event.symbol,
      orderId: event.orderId,
      clientOrderId: event.clientOrderId ?? null,
      side: event.side,
      type: event.type,
      quantity: event.quantity,
      price: event.price,
      totalAmount: event.totalAmount,
      fee: event.fee,
      feeAsset: event.feeAsset,
      status: event.status,
      executedAt: event.executedAt,
      source: event.source,
      strategyId: event.strategyId ?? null,
      metadata: event.metadata ?? null,
      netAmount: event.totalAmount - event.fee,
      feeRate: 0,
      getCoin: () => event.symbol.split(/(USDT|BTC|ETH|BNB)$/)[0],
      isBuy: () => event.side === 'BUY',
      isSell: () => event.side === 'SELL',
      // ... 기타 SpotTradeRecord 필드 필요시 추가
    } as SpotTradeRecord;
  }
}
