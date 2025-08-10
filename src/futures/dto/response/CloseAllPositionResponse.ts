import { ApiProperty } from '@nestjs/swagger';

/**
 * 선물 포지션 전체 청산 응답 DTO
 *
 * 포지션 전체 청산 결과를 포함하는 응답 데이터
 * 원래 포지션 정보와 청산 결과를 모두 포함
 */
export class CloseAllPositionResponse {
  @ApiProperty({
    description: '청산된 포지션의 심볼',
    example: 'BTCUSDT',
  })
  symbol: string;

  @ApiProperty({
    description: '원래 포지션 방향 (LONG/SHORT)',
    example: 'LONG',
  })
  originalSide: string;

  @ApiProperty({
    description: '원래 포지션 수량',
    example: 0.001,
  })
  originalQuantity: number;

  @ApiProperty({
    description: '실제 청산된 수량',
    example: 0.001,
  })
  closedQuantity: number;

  @ApiProperty({
    description: '청산 평균가',
    example: 120000.0,
  })
  avgPrice: number;

  @ApiProperty({
    description: '청산 총액',
    example: 120.0,
  })
  totalAmount: number;

  @ApiProperty({
    description: '주문 ID',
    example: 123456789,
  })
  orderId: number;

  @ApiProperty({
    description: '주문 상태',
    example: 'FILLED',
  })
  status: string;

  @ApiProperty({
    description: '청산 시간',
    example: '2024-01-01T00:00:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: '사용자 정의 메모',
    example: '전체 청산 테스트',
    required: false,
  })
  memo?: string;
}
