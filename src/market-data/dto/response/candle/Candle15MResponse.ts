// 15분봉 응답 DTO (Response Suffix만 사용)
export class Candle15MResponse {
  openTime: number;
  closeTime: number;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  symbol: string;
  market: string;
  timeframe: string;
}
