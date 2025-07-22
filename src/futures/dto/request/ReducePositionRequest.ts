import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min } from 'class-validator';

/**
 * 포지션 부분 청산 요청 DTO
 *
 * 기존 포지션의 일부 수량만 청산합니다.
 * 수익 실현이나 리스크 감소에 사용됩니다.
 */
export class ReducePositionRequest {
  @ApiProperty({
    description: '거래 심볼',
    example: 'BTCUSDT',
    type: String,
  })
  @IsString()
  symbol: string;

  @ApiProperty({
    description: '청산할 포지션 수량',
    example: 0.0005,
    type: Number,
    minimum: 0.001,
  })
  @IsNumber()
  @Min(0.0001, { message: '최소 청산 수량은 0.0001입니다.' })
  reduceQuantity: number;
}
