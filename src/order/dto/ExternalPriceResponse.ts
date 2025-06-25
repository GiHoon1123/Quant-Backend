export class ExternalPriceResponse {
  symbol: string;
  price: number;

  static from(raw: any): ExternalPriceResponse {
    return {
      symbol: raw.symbol,
      price: parseFloat(raw.price),
    };
  }
}
