import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsString, Min } from 'class-validator';
import { PositionSide } from './OpenPositionRequest';

/**
 * 포지션 스위칭 요청 DTO
 *
 * 기존 포지션을 반대 방향으로 전환합니다.
 * 예: LONG → SHORT, SHORT → LONG
 */
export class SwitchPositionRequest {
  @ApiProperty({
    description: '거래 심볼',
    example: 'BTCUSDT',
    type: String,
  })
  @IsString()
  symbol: string;

  @ApiProperty({
    description: '새로운 포지션 방향',
    example: 'SHORT',
    enum: PositionSide,
  })
  @IsEnum(PositionSide)
  newSide: PositionSide;

  @ApiProperty({
    description: '새로운 포지션 수량',
    example: 0.002,
    type: Number,
    minimum: 0.001,
  })
  @IsNumber()
  @Min(0.001, { message: '최소 포지션 수량은 0.001입니다.' })
  newQuantity: number;
}
