export class FuturesPositionResponse {
  id: number;
  symbol: string;
  positionAmt: number;
  entryPrice: number;
  leverage: number;
  unrealizedProfit: number;
  createdAt: number;
  // ... 기타 필드
}
