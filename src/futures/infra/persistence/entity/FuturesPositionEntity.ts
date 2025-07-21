export class FuturesPositionEntity {
  id: number;
  symbol: string;
  positionAmt: number;
  entryPrice: number;
  leverage: number;
  unrealizedProfit: number;
  createdAt: Date;
  // ... 기타 필드
}
