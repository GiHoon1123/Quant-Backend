import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// 공통 모듈 import
import { TelegramNotificationService } from '../common/notification/TelegramNotificationService';

// 15분봉 관련 import
import { Candle15MEntity } from './infra/candle/Candle15MEntity';
import { Candle15MRepository } from './infra/candle/Candle15MRepository';
import { Candle15MService } from './service/candle/Candle15MService';
import { BinanceHistoryDataService } from './service/candle/BinanceHistoryDataService';
import { Candle15MController } from './web/candle/Candle15MController';
import { BinanceHistoryController } from './web/candle/BinanceHistoryController';

@Module({
  imports: [
    TypeOrmModule.forFeature([Candle15MEntity]), // 15분봉 엔티티 등록
  ],
  controllers: [Candle15MController, BinanceHistoryController],
  providers: [
    // 15분봉 서비스 및 레포지토리 등록
    Candle15MService,
    Candle15MRepository,
    BinanceHistoryDataService, // 히스토리컬 데이터 수집 서비스
    TelegramNotificationService, // 공통 알림 서비스
  ],
  exports: [
    Candle15MService, // 다른 모듈에서 사용할 수 있도록 export
    Candle15MRepository,
    BinanceHistoryDataService, // 히스토리컬 데이터 수집 서비스 export
    TelegramNotificationService, // 공통 알림 서비스 export
  ],
})
export class MarketDataModule {}
