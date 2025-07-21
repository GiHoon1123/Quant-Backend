import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// 15분봉 관련 import
import { Candle15MEntity } from './infra/persistence/entity/Candle15MEntity';
import { Candle15MRepository } from './infra/persistence/repository/Candle15MRepository';
import { BinanceHistoryDataService } from './service/candle/BinanceHistoryDataService';
import { Candle15MService } from './service/candle/Candle15MService';
import { BinanceHistoryController } from './web/candle/BinanceHistoryController';
import { Candle15MController } from './web/candle/Candle15MController';

/**
 * 📊 Market Data 모듈
 *
 * 🎯 **핵심 책임**: 시장 데이터 수집과 저장
 * - 바이낸스 웹소켓을 통한 실시간 15분봉 데이터 수집
 * - 캔들 데이터의 안전한 저장 및 관리
 * - 히스토리컬 데이터 수집 지원
 * - 다른 도메인을 위한 이벤트 발송
 *
 * 🚫 **포함하지 않는 기능**:
 * - 기술적 분석 (technical-analysis 모듈 담당)
 * - 알림 발송 (notification 모듈 담당)
 *
 * 📡 **발송 이벤트**:
 * - candle.saved: 캔들 저장 완료 시
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Candle15MEntity]), // 15분봉 엔티티 등록
  ],
  controllers: [Candle15MController, BinanceHistoryController],
  providers: [
    // 📊 캔들 데이터 수집 및 저장 서비스들
    Candle15MService,
    Candle15MRepository,
    BinanceHistoryDataService, // 히스토리컬 데이터 수집 서비스
  ],
  exports: [
    // 🔄 다른 도메인에서 사용할 수 있도록 export
    Candle15MService, // 이벤트 수신용
    Candle15MRepository, // 데이터 조회용
    BinanceHistoryDataService, // 백테스팅용
  ],
})
export class MarketDataModule {}
