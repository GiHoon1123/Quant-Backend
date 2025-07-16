import { Module } from '@nestjs/common';
import { TechnicalAnalysisService } from './service/TechnicalAnalysisService';
import { StrategyExecutionService } from './service/StrategyExecutionService';
import { CandleDataService } from './service/CandleDataService';
import { TechnicalIndicatorService } from './service/TechnicalIndicatorService';
import { TechnicalAnalysisController } from './web/TechnicalAnalysisController';
import { StrategyRepository } from './infra/StrategyRepository';

/**
 * 기술적 분석 및 트레이딩 전략 모듈
 *
 * 이 모듈은 다양한 기술적 분석 지표와 트레이딩 전략을 제공합니다:
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
 * 🎯 확장 가능한 구조:
 * - 새로운 코인 쉽게 추가 가능
 * - 커스텀 전략 개발 지원
 * - 백테스팅 및 성과 분석
 */
@Module({
  imports: [],
  controllers: [TechnicalAnalysisController],
  providers: [
    TechnicalAnalysisService,
    StrategyExecutionService,
    CandleDataService,
    TechnicalIndicatorService,
    StrategyRepository,
  ],
  exports: [
    TechnicalAnalysisService,
    StrategyExecutionService,
    CandleDataService,
  ],
})
export class TechnicalAnalysisModule {}
