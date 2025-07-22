import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min } from 'class-validator';

/**
 * 포지션 추가 요청 DTO
 *
 * 기존 포지션과 같은 방향으로 수량을 추가합니다.
 * 평단가 조정이나 포지션 규모 확대에 사용됩니다.
 */
export class AddToPositionRequest {
  @ApiProperty({
    description: '거래 심볼',
    example: 'BTCUSDT',
    type: String,
  })
  @IsString()
  symbol: string;

  @ApiProperty({
    description: '추가할 포지션 수량',
    example: 0.001,
    type: Number,
    minimum: 0.001,
  })
  @IsNumber()
  @Min(0.001, { message: '최소 추가 수량은 0.001입니다.' })
  addQuantity: number;
}
