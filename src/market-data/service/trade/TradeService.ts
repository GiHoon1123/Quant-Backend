import { Injectable, OnModuleInit } from '@nestjs/common';
import { ExternalTradeResponse } from 'src/market-data/dto/trade/ExternalTradeResponse';
import { TradeResponse } from 'src/market-data/dto/trade/TradeResponse';
import { BinanceTradeManager } from 'src/market-data/infra/trade/BinanceTradeManager';
import { TradeEntity } from 'src/market-data/infra/trade/TradeEntity';
import { TradeRepository } from 'src/market-data/infra/trade/TradeRepository';
import { TradeGateway } from '../../web/trade/TradeGateway';
import { KlineService } from '../kline/KlineService';
import { DEFAULT_SYMBOLS } from 'src/common/constant/DefaultSymbols';

@Injectable()
export class TradeService implements OnModuleInit {
  private manager: BinanceTradeManager;

  constructor(
    private readonly klineService: KlineService,
    private readonly gateway: TradeGateway,
    private readonly tradeRepository: TradeRepository,
  ) {
    this.manager = new BinanceTradeManager(this.handleTick.bind(this));
  }

  onModuleInit() {
    // 애플리케이션 시작 시 기본 심볼 구독
    for (const symbol of DEFAULT_SYMBOLS) {
      this.manager.subscribe(symbol);
    }
  }

  private async handleTick(tick: ExternalTradeResponse) {
    this.gateway.sendTradeData(tick); // 소켓 전송

    // 1. 응답 DTO → 내부 응답 DTO
    const trade = TradeResponse.from(tick);

    // 2. 내부 응답 DTO → 엔티티 변환
    const entity = TradeEntity.from(trade);
    console.log(`거래 데이터 처리: ${entity.symbol} ${entity.tradeId}`);

    // 3. 저장
    this.tradeRepository.save(entity);
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
