import axios from 'axios';
import * as crypto from 'crypto';

const BASE_URL = 'https://api.binance.com';
const API_KEY = process.env.BINANCE_API_KEY!;
const API_SECRET = process.env.BINANCE_API_SECRET!;

export class BinanceOrderClient {
  /**
   * 시장가 주문 (매수/매도)
   */
  async placeMarketOrder(symbol: string, side: string, quantity: number) {
    const endpoint = '/api/v3/order';
    const timestamp = Date.now();
    const query = `symbol=${symbol}&side=${side}&type=MARKET&quantity=${quantity}&timestamp=${timestamp}`;
    const signature = crypto
      .createHmac('sha256', API_SECRET)
      .update(query)
      .digest('hex');
    const finalQuery = `${query}&signature=${signature}`;

    const res = await axios.post(`${BASE_URL}${endpoint}?${finalQuery}`, null, {
      headers: { 'X-MBX-APIKEY': API_KEY },
    });

    return res.data;
  }

  /**
   * 지정가 주문 (매수/매도)
   */
  async placeLimitOrder(
    symbol: string,
    side: string,
    quantity: number,
    price: number,
    timeInForce: string = 'GTC',
  ) {
    const endpoint = '/api/v3/order';
    const timestamp = Date.now();
    const query = `symbol=${symbol}&side=${side}&type=LIMIT&timeInForce=${timeInForce}&quantity=${quantity}&price=${price}&timestamp=${timestamp}`;
    const signature = crypto
      .createHmac('sha256', API_SECRET)
      .update(query)
      .digest('hex');
    const finalQuery = `${query}&signature=${signature}`;

    const res = await axios.post(`${BASE_URL}${endpoint}?${finalQuery}`, null, {
      headers: { 'X-MBX-APIKEY': API_KEY },
    });

    return res.data;
  }

  /**
   * 주문 취소
   */
  async cancelOrder(symbol: string, orderId: number) {
    const endpoint = '/api/v3/order';
    const timestamp = Date.now();
    const query = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
    const signature = crypto
      .createHmac('sha256', API_SECRET)
      .update(query)
      .digest('hex');
    const finalQuery = `${query}&signature=${signature}`;

    const res = await axios.delete(`${BASE_URL}${endpoint}?${finalQuery}`, {
      headers: { 'X-MBX-APIKEY': API_KEY },
    });

    return res.data;
  }

  /**
   * 잔고 조회
   */
  async fetchBalances(): Promise<
    { asset: string; free: number; locked: number }[]
  > {
    const endpoint = '/api/v3/account';
    const timestamp = Date.now();
    const query = `timestamp=${timestamp}`;
    const signature = crypto
      .createHmac('sha256', API_SECRET)
      .update(query)
      .digest('hex');

    const res = await axios.get(
      `${BASE_URL}${endpoint}?${query}&signature=${signature}`,
      {
        headers: { 'X-MBX-APIKEY': API_KEY },
      },
    );

    return res.data.balances
      .map((b: any) => ({
        asset: b.asset,
        free: parseFloat(b.free),
        locked: parseFloat(b.locked),
      }))
      .filter((b) => b.free > 0 || b.locked > 0);
  }
}
