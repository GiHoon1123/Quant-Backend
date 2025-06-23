import { Module } from '@nestjs/common';
import { TradeService } from './service/trade/TradeService';
import { TradeController } from './web/trade/TradeController';
import { TradeGateway } from './web/trade/TradeGateway';

@Module({
  imports: [],
  controllers: [TradeController],
  providers: [TradeGateway, TradeService],
  exports: [],
})
export class MarketDataModule {}
