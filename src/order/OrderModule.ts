import { Module } from '@nestjs/common';
import { BinanceOrderClient } from './infra/client/BinanceOrderClient';
import { BinancePriceClient } from './infra/client/BinancePriceClient';
import { OrderService } from './service/OrderService';
import { OrderController } from './web/OrderController';

@Module({
  imports: [],
  controllers: [OrderController],
  providers: [OrderService, BinanceOrderClient, BinancePriceClient],
  exports: [],
})
export class OrderModule {}
