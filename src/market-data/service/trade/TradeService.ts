import { Injectable, OnModuleInit } from '@nestjs/common';
import { ExternalTradeResponse } from 'src/market-data/dto/trade/ExternalTradeResponse';
import { BinanceTradeManager } from 'src/market-data/infra/trade/BinanceTradeManager';
import { TradeGateway } from '../../web/trade/TradeGateway';

@Injectable()
export class TradeService implements OnModuleInit {
  private manager: BinanceTradeManager;
  // private readonly defaultSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  private readonly defaultSymbols = ['BTCUSDT'];

  constructor(private readonly gateway: TradeGateway) {
    this.manager = new BinanceTradeManager(this.handleTick.bind(this));
  }

  onModuleInit() {
    // 애플리케이션 시작 시 기본 심볼 구독
    for (const symbol of this.defaultSymbols) {
      this.manager.subscribe(symbol);
    }
  }

  private handleTick(tick: ExternalTradeResponse) {
    this.gateway.sendTradeData(tick);
  }

  subscribe(symbol: string) {
    this.manager.subscribe(symbol);
  }

  unsubscribe(symbol: string) {
    this.manager.unsubscribe(symbol);
  }

  getSubscribedSymbols(): string[] {
    return this.manager.getSubscribedSymbols();
  }
}
