import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MarketDataModule } from './market-data/MarketDataModule';

@Module({
  imports: [ScheduleModule.forRoot(), MarketDataModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
