import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CryptoUtil } from 'src/common/utils/CryptoUtil';
import { handleBinanceAxiosError } from 'src/common/utils/binance/BinanceAxiosErrorHandler';

const BASE_URL = 'https://api.binance.com';

@Injectable()
export class BinanceOrderClient {
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.getOrThrow<string>('BINANCE_API_KEY');
    this.apiSecret =
      this.configService.getOrThrow<string>('BINANCE_API_SECRET');
  }

  async placeMarketOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantityOrQuoteQty: number,
  ) {
    try {
      const endpoint = '/api/v3/order';
      const timestamp = Date.now();

      const baseParams = `symbol=${symbol}&side=${side}&type=MARKET&timestamp=${timestamp}`;
      const quantityParam =
        side === 'BUY'
          ? `quoteOrderQty=${quantityOrQuoteQty}`
          : `quantity=${quantityOrQuoteQty}`;

      const query = `${baseParams}&${quantityParam}`;
      const signature = CryptoUtil.generateBinanceSignature(
        query,
        this.apiSecret,
      );
      const finalQuery = `${query}&signature=${signature}`;

      const res = await axios.post(
        `${BASE_URL}${endpoint}?${finalQuery}`,
        null,
        {
          headers: { 'X-MBX-APIKEY': this.apiKey },
        },
      );

      return res.data;
    } catch (error) {
      handleBinanceAxiosError(
        error,
        '시장가 주문에 실패했습니다. 나중에 다시 시도해주세요.',
        symbol,
      );
    }
  }

  async placeLimitOrder(
    symbol: string,
    side: string,
    quantity: number,
    price: number,
    timeInForce: string = 'GTC',
  ) {
    try {
      const endpoint = '/api/v3/order';
      const timestamp = Date.now();
      const query = `symbol=${symbol}&side=${side}&type=LIMIT&timeInForce=${timeInForce}&quantity=${quantity}&price=${price}&timestamp=${timestamp}`;
      const signature = CryptoUtil.generateBinanceSignature(
        query,
        this.apiSecret,
      );
      const finalQuery = `${query}&signature=${signature}`;

      const res = await axios.post(
        `${BASE_URL}${endpoint}?${finalQuery}`,
        null,
        {
          headers: { 'X-MBX-APIKEY': this.apiKey },
        },
      );

      return res.data;
    } catch (error) {
      handleBinanceAxiosError(
        error,
        '지정가 주문에 실패했습니다. 나중에 다시 시도해주세요.',
        symbol,
      );
    }
  }

  async cancelOrder(symbol: string, orderId: number) {
    try {
      const endpoint = '/api/v3/order';
      const timestamp = Date.now();
      const query = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
      const signature = CryptoUtil.generateBinanceSignature(
        query,
        this.apiSecret,
      );
      const finalQuery = `${query}&signature=${signature}`;

      const res = await axios.delete(`${BASE_URL}${endpoint}?${finalQuery}`, {
        headers: { 'X-MBX-APIKEY': this.apiKey },
      });

      return res.data;
    } catch (error) {
      handleBinanceAxiosError(
        error,
        '주문 취소에 실패했습니다. 나중에 다시 시도해주세요.',
        symbol,
      );
    }
  }

  async fetchBalances(): Promise<
    { asset: string; free: number; locked: number }[]
  > {
    try {
      const endpoint = '/api/v3/account';
      const timestamp = Date.now();
      const query = `timestamp=${timestamp}`;
      const signature = CryptoUtil.generateBinanceSignature(
        query,
        this.apiSecret,
      );

      const res = await axios.get(
        `${BASE_URL}${endpoint}?${query}&signature=${signature}`,
        {
          headers: { 'X-MBX-APIKEY': this.apiKey },
        },
      );

      return res.data.balances
        .map((b: any) => ({
          asset: b.asset,
          free: parseFloat(b.free),
          locked: parseFloat(b.locked),
        }))
        .filter((b) => b.free > 0 || b.locked > 0);
    } catch (error) {
      handleBinanceAxiosError(
        error,
        '잔고 조회에 실패했습니다. 나중에 다시 시도해주세요.',
      );
    }
  }
}
