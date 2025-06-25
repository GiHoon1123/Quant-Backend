import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './common/config/DatabaseConfig';
import { MarketDataModule } from './market-data/MarketDataModule';
import { OrderModule } from './order/OrderModule';

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
    MarketDataModule,
    OrderModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
