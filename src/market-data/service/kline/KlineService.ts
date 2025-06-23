import { Injectable, OnModuleInit } from '@nestjs/common';
import { DEFAULT_SYMBOLS } from 'src/common/constant/DefaultSymbols';
import { ExternalKlineResponse } from 'src/market-data/dto/kline/ExternalKlineResponse';
import { BinanceKlineManager } from 'src/market-data/infra/kline/BinanceKlineManager';
import { BinanceKlineRestClient } from 'src/market-data/infra/kline/BinanceKlineRestClient';
import { KlineGateway } from 'src/market-data/web/kline/KlineGateway';

@Injectable()
export class KlineService implements OnModuleInit {
  private readonly manager: BinanceKlineManager;

  constructor(
    private readonly gateway: KlineGateway,
    private readonly restClient: BinanceKlineRestClient,
  ) {
    this.manager = new BinanceKlineManager(this.handleKline.bind(this));
  }

  onModuleInit() {
    DEFAULT_SYMBOLS.forEach((symbol) => {
      this.manager.subscribe(symbol);
    });
  }

  private handleKline(data: ExternalKlineResponse) {
    this.gateway.sendKlinedata(data);
  }

  subscribe(symbol: string) {
    this.manager.subscribe(symbol);
  }

  unsubscribe(symbol: string) {
    this.manager.unsubscribe(symbol);
  }

  getSubscribed(): string[] {
    return this.manager.getSubscribed();
  }

  async fetchCandles(symbol: string, interval: string) {
    const raw = await this.restClient.fetchCandles(symbol, interval);
    console.log(`${symbol} ${interval} 캔들차트 데이터 가져오기:`, raw);
  }
}
