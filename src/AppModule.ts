import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './common/config/DatabaseConfig';
import { BinanceModule } from './common/binance/BinanceModule';
import { MarketDataModule } from './market-data/MarketDataModule';
import { OrderModule } from './order/OrderModule';
import { FuturesModule } from './futures/FuturesModule';
import { TechnicalAnalysisModule } from './technical-analysis/TechnicalAnalysisModule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV}`, // NODE_ENV 기반 env 파일 우선
        '.env', // 공통 설정 (fallback)
      ],
    }),
    TypeOrmModule.forRoot(typeOrmConfig),
    ScheduleModule.forRoot(),
    BinanceModule, // 바이낸스 공통 모듈 (글로벌)
    MarketDataModule,
    OrderModule,
    FuturesModule,
    TechnicalAnalysisModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
