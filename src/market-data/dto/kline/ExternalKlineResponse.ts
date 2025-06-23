export class ExternalKlineResponse {
  symbol: string;
  interval: string;
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;

  static from(raw: any): ExternalKlineResponse {
    const k = raw.k;
    return {
      symbol: raw.s,
      interval: k.i,
      openTime: k.t,
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c),
      volume: parseFloat(k.v),
    };
  }
}
