// 선물 포지션 도메인 매핑 책임 클래스 예시
import { FuturesPositionResponse } from '../dto/response/FuturesPositionResponse';
import { FuturesPositionEntity } from '../infra/persistence/entity/FuturesPositionEntity';

export class FuturesPositionMapper {
  static toResponse(entity: FuturesPositionEntity): FuturesPositionResponse {
    return {
      id: entity.id,
      symbol: entity.symbol,
      positionAmt: entity.positionAmt,
      entryPrice: entity.entryPrice,
      leverage: entity.leverage,
      unrealizedProfit: entity.unrealizedProfit,
      createdAt: entity.createdAt.getTime(),
      // ... 기타 필드
    };
  }
}
