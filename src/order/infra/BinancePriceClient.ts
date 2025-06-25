import axios from 'axios';

export class BinancePriceClient {
  private readonly BASE_URL = 'https://api.binance.com';

  async fetchPrice(symbol: string): Promise<number> {
    const endpoint = '/api/v3/ticker/price';
    const url = `${this.BASE_URL}${endpoint}`;
    const response = await axios.get(url, { params: { symbol } });

    return parseFloat(response.data.price); // 문자열로 오기 때문에 숫자로 변환
  }
}
