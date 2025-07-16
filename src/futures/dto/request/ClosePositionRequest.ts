import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

/**
 * 선물 포지션 청산 요청 DTO
 *
 * 기존에 보유중인 포지션을 완전히 또는 부분적으로 청산할 때 사용합니다.
 * 시장가로 즉시 청산됩니다.
 */
export class ClosePositionRequest {
  @ApiProperty({
    example: 'BTCUSDT',
    description: '청산할 포지션의 심볼',
  })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({
    example: 0.5,
    description: '청산할 수량 (0이면 전체 청산, 양수면 부분 청산)',
    required: false,
  })
  @IsNumber()
  quantity?: number; // undefined 또는 0이면 전체 청산, 양수면 부분 청산
}
