// 주문 도메인 매핑 책임 클래스 예시
import { OrderResponse } from '../dto/response/OrderResponse';
import { OrderEntity } from '../infra/persistence/entity/OrderEntity';

export class OrderMapper {
  static toResponse(entity: OrderEntity): OrderResponse {
    return {
      id: entity.id,
      symbol: entity.symbol,
      price: entity.price,
      quantity: entity.quantity,
      status: entity.status,
      createdAt: entity.createdAt.getTime(),
      // ... 기타 필드
    };
  }
}
