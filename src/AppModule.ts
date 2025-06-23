import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './common/config/DatabaseConfig';
import { MarketDataModule } from './market-data/MarketDataModule';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeOrmConfig),
    ScheduleModule.forRoot(),
    MarketDataModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
