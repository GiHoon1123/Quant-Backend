import { Injectable, OnModuleInit } from '@nestjs/common';
import { DEFAULT_SYMBOLS } from 'src/common/constant/DefaultSymbols';
import { ExternalTradeResponse } from 'src/market-data/dto/trade/ExternalTradeResponse';
import { BinanceTradeManager } from 'src/market-data/infra/trade/BinanceTradeManager';
import { TradeGateway } from '../../web/trade/TradeGateway';
import { KlineService } from '../kline/KlineService';

@Injectable()
export class TradeService implements OnModuleInit {
  private manager: BinanceTradeManager;

  constructor(
    private readonly klineService: KlineService,
    private readonly gateway: TradeGateway,
  ) {
    this.manager = new BinanceTradeManager(this.handleTick.bind(this));
  }

  onModuleInit() {
    // 애플리케이션 시작 시 기본 심볼 구독
    for (const symbol of DEFAULT_SYMBOLS) {
      this.manager.subscribe(symbol);
    }
  }

  private handleTick(tick: ExternalTradeResponse) {
    this.gateway.sendTradeData(tick);
  }

  subscribe(symbol: string) {
    this.manager.subscribe(symbol);
    this.klineService.subscribe(symbol);
  }

  unsubscribe(symbol: string) {
    this.manager.unsubscribe(symbol);
    this.klineService.unsubscribe(symbol);
  }

  getSubscribedSymbols(): string[] {
    return this.manager.getSubscribedSymbols();
  }
}
