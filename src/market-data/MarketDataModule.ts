import { Module } from '@nestjs/common';
import { BinanceKlineRestClient } from './infra/kline/BinanceKlineRestClient';
import { KlineService } from './service/kline/KlineService';
import { TradeService } from './service/trade/TradeService';
import { KlineGateway } from './web/kline/KlineGateway';
import { TradeController } from './web/trade/TradeController';
import { TradeGateway } from './web/trade/TradeGateway';
import { KlineScheduler } from './scheduler/kline/KlineScheduler';

@Module({
  imports: [],
  controllers: [TradeController],
  providers: [
    TradeService,
    TradeGateway,
    KlineService,
    KlineGateway,
    KlineScheduler,
    BinanceKlineRestClient,
  ],
  exports: [],
})
export class MarketDataModule {}
