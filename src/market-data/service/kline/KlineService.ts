import { Injectable, OnModuleInit } from '@nestjs/common';
import { DEFAULT_SYMBOLS } from 'src/common/constant/DefaultSymbols';
import { ExternalKlineResponse } from 'src/market-data/dto/kline/ExternalKlineResponse';
import { ExternalRestKlineResponse } from 'src/market-data/dto/kline/ExternalRestKlineResponse';
import { KlineResponse } from 'src/market-data/dto/kline/KlineResponse';
import { BinanceKlineManager } from 'src/market-data/infra/kline/BinanceKlineManager';
import { BinanceKlineRestClient } from 'src/market-data/infra/kline/BinanceKlineRestClient';
import { KlineEntity } from 'src/market-data/infra/kline/KlineEntity';
import { KlineRepository } from 'src/market-data/infra/kline/KlineRepository';

import { KlineGateway } from 'src/market-data/web/kline/KlineGateway';

@Injectable()
export class KlineService implements OnModuleInit {
  private readonly manager: BinanceKlineManager;

  constructor(
    private readonly gateway: KlineGateway,
    private readonly restClient: BinanceKlineRestClient,
    private readonly klineRepository: KlineRepository,
  ) {
    this.manager = new BinanceKlineManager(this.handleKline.bind(this));
  }

  onModuleInit() {
    DEFAULT_SYMBOLS.forEach((symbol) => {
      this.manager.subscribe(symbol);
    });
  }

  private async handleKline(data: ExternalKlineResponse) {
    this.gateway.sendKlinedata(data);

    // 1. 응답 DTO → 내부 응답 DTO
    const kline = KlineResponse.fromWebSocket(data);

    // 2. 내부 응답 DTO → 엔티티 변환
    const entity = KlineEntity.from(kline);

    // 3. 저장
    this.klineRepository.saveOrUpdateKline(entity);
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

  async fetchCandlesAndSave(symbol: string, interval: string): Promise<void> {
    const externalList = await this.restClient.fetchCandles(symbol, interval);

    const responseList = externalList.map((item) =>
      KlineResponse.fromRest(
        symbol,
        interval,
        ExternalRestKlineResponse.from(item),
      ),
    );

    const entityList = responseList.map(KlineEntity.from);

    await this.klineRepository.upsertMany(entityList);
  }
}
