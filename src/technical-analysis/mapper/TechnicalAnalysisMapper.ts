// 기술적 분석 도메인 매핑 책임 클래스 예시
import { Candle15MEntity } from '../../market-data/infra/persistence/entity/Candle15MEntity';
import { TechnicalAnalysisResultResponse } from '../dto/response/TechnicalAnalysisResultResponse';
import { MultiStrategyResult } from '../types/StrategyTypes';

export class TechnicalAnalysisMapper {
  /**
   * MultiStrategyResult → TechnicalAnalysisResultResponse 변환
   */
  static toResultResponseFromMulti(
    result: MultiStrategyResult,
  ): TechnicalAnalysisResultResponse {
    return {
      symbol: result.symbol,
      timestamp: result.timestamp,
      overallSignal: result.overallSignal,

      consensus: result.consensus,
      strategies: result.strategies,
      timeframeSummary: result.timeframeSummary,
    };
  }

  /**
   * DB 엔티티 → 클라이언트 응답 DTO 변환
   */
  static toResultResponse(
    entity: Candle15MEntity,
  ): TechnicalAnalysisResultResponse {
    return {
      openTime: entity.openTime.getTime(),
      closeTime: entity.closeTime.getTime(),
      open: entity.open,
      close: entity.close,
      high: entity.high,
      low: entity.low,
      volume: entity.volume,
      // ... 기타 필요한 필드 매핑
    } as any;
  }

  /**
   * 외부 API 응답 → 엔티티 변환 (예시)
   */
  // static fromExternal(response: ExternalCandleResponse): Candle15MEntity {
  //   return { ... };
  // }
}
