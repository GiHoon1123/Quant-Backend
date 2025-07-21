import { ApiProperty } from '@nestjs/swagger';
import { ExternalCancelOrderResponse } from '../external/ExternalCancelOrderResponse';

export class CancelOrderResponse {
  @ApiProperty({ example: 'BTCUSDT', description: '거래 심볼' })
  symbol: string;

  @ApiProperty({ example: 45464533328, description: '주문 ID' })
  orderId: number;

  @ApiProperty({ example: 'CANCELED', description: '주문 상태' })
  status: string;

  @ApiProperty({ example: 'BUY', description: '매수/매도 구분' })
  side: string;

  @ApiProperty({ example: 'LIMIT', description: '주문 유형' })
  type: string;

  @ApiProperty({ example: '0.00000000', description: '체결된 수량' })
  executedQty: string;

  static from(ext: ExternalCancelOrderResponse): CancelOrderResponse {
    const dto = new CancelOrderResponse();
    dto.symbol = ext.symbol;
    dto.orderId = ext.orderId;
    dto.status = ext.status;
    dto.side = ext.side;
    dto.type = ext.type;
    dto.executedQty = ext.executedQty;
    return dto;
  }
}
