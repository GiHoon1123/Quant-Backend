export class ExternalBalanceResponse {
  asset: string;
  free: number;
  locked: number;

  static from(raw: any): ExternalBalanceResponse {
    return {
      asset: raw.asset,
      free: parseFloat(raw.free),
      locked: parseFloat(raw.locked),
    };
  }

  static fromList(rawList: any[]): ExternalBalanceResponse[] {
    return rawList
      .map(ExternalBalanceResponse.from)
      .filter((b) => b.free > 0 || b.locked > 0);
  }
}
