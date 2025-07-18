import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// 15분봉 관련 import 추가
import { Candle15MEntity } from './infra/candle/Candle15MEntity';
import { Candle15MRepository } from './infra/candle/Candle15MRepository';
import { Candle15MService } from './service/candle/Candle15MService';
import { TelegramNotificationService } from './service/notification/TelegramNotificationService';
import { Candle15MController } from './web/candle/Candle15MController';

@Module({
  imports: [
    TypeOrmModule.forFeature([Candle15MEntity]), // 15분봉 엔티티 등록
  ],
  controllers: [Candle15MController],
  providers: [
    // 15분봉 서비스 및 레포지토리 등록
    Candle15MService,
    Candle15MRepository,
    TelegramNotificationService,
  ],
  exports: [
    Candle15MService, // 다른 모듈에서 사용할 수 있도록 export
    Candle15MRepository,
    TelegramNotificationService,
  ],
})
export class MarketDataModule {}
