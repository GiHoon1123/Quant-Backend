import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './common/config/DatabaseConfig';
import { MarketDataModule } from './market-data/MarketDataModule';
import { OrderModule } from './order/OrderModule';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeOrmConfig),
    ScheduleModule.forRoot(),
    MarketDataModule,
    OrderModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
