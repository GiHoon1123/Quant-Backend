import { Module } from '@nestjs/common';
import { BinanceClient } from './infra/BinanceClient';
import { MarketDataGateway } from './web/MarketDataGateway';

@Module({
  imports: [],
  controllers: [],
  providers: [BinanceClient, MarketDataGateway],
  exports: [],
})
export class MarketDataModule {}
