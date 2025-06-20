import { Module } from '@nestjs/common';
import { MarketDataModule } from './market-data/MarketDataModule';

@Module({
  imports: [MarketDataModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
