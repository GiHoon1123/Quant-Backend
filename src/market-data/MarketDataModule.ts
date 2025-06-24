import { Module } from '@nestjs/common';
import { BinanceKlineRestClient } from './infra/kline/BinanceKlineRestClient';
import { KlineRepository } from './infra/kline/KlineRepository';
import { TradeRepository } from './infra/trade/TradeRepository';
import { KlineScheduler } from './scheduler/kline/KlineScheduler';
import { KlineService } from './service/kline/KlineService';
import { TradeService } from './service/trade/TradeService';
import { KlineGateway } from './web/kline/KlineGateway';
import { TradeGateway } from './web/trade/TradeGateway';
import { TradeWatchlistController } from './web/trade/TradeWatchlistController';

@Module({
  imports: [],
  controllers: [TradeWatchlistController],
  providers: [
    TradeService,
    TradeGateway,
    TradeRepository,
    KlineService,
    KlineGateway,
    KlineScheduler,
    KlineRepository,
    BinanceKlineRestClient,
  ],
  exports: [],
})
export class MarketDataModule {}
