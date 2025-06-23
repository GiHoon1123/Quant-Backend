import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class BinanceKlineRestClient {
  private readonly BASE_URL = 'https://api.binance.com/api/v3/klines';

  async fetchCandles(
    symbol: string,
    interval: string,
    limit = 100,
  ): Promise<any[]> {
    const url = `${this.BASE_URL}?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const res = await axios.get(url);
    return res.data;
  }
}
