import { Module } from '@nestjs/common';
import { MarketDataModule } from '../market-data/MarketDataModule';
import { StrategyRepository } from './infra/StrategyRepository';
import { StrategyExecutionService } from './service/StrategyExecutionService';
import { TechnicalAnalysisEventService } from './service/TechnicalAnalysisEventService';
import { TechnicalAnalysisService } from './service/TechnicalAnalysisService';
import { TechnicalIndicatorService } from './service/TechnicalIndicatorService';
import { TechnicalAnalysisController } from './web/TechnicalAnalysisController';

/**
 * 🔍 기술적 분석 및 트레이딩 전략 모듈
 *
 * 🎯 **핵심 책임**: 캔들 데이터 기반 기술적 분석
 * - market-data 도메인의 candle.saved 이벤트 수신
 * - market-data 도메인의 저장된 데이터를 직접 조회
 * - 다양한 기술적 지표와 트레이딩 전략 실행
 * - 분석 완료 후 analysis.completed 이벤트 발송
 *
 * 🔍 주요 기능:
 * - 이동평균선 기반 전략 (20일선, 50일선, 200일선 등)
 * - 모멘텀 지표 분석 (RSI, MACD, 스토캐스틱)
 * - 볼린저 밴드 및 지지/저항 분석
 * - 거래량 기반 전략
 * - 복합 전략 및 신호 생성
 *
 * 📊 지원 시간봉:
 * - 1분봉 (1m): 단기 스캘핑 전략
 * - 15분봉 (15m): 단기 스윙 전략
 * - 1시간봉 (1h): 중기 트렌드 전략
 * - 1일봉 (1d): 장기 투자 전략
 *
 * 🔄 **이벤트 플로우**:
 * candle.saved 수신 → 기술적 분석 실행 → analysis.completed 발송
 *
 * 📡 **수신 이벤트**: candle.saved
 * 📡 **발송 이벤트**: analysis.completed
 */
@Module({
  imports: [MarketDataModule], // Market-data 모듈에서 Repository 사용
  controllers: [TechnicalAnalysisController],
  providers: [
    // 🔍 핵심 분석 서비스들
    TechnicalAnalysisService,
    TechnicalAnalysisEventService, // 🆕 이벤트 기반 분석 처리
    StrategyExecutionService,
    TechnicalIndicatorService,
    StrategyRepository,
  ],
  exports: [
    // 🔄 다른 도메인에서 사용할 수 있도록 export
    TechnicalAnalysisService,
    TechnicalAnalysisEventService, // 🆕 이벤트 연결용
    StrategyExecutionService,
  ],
})
export class TechnicalAnalysisModule {}
