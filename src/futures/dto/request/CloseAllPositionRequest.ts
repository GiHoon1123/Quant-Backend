import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * 선물 포지션 전체 청산 요청 DTO
 *
 * 특정 심볼의 모든 포지션을 자동으로 전체 청산하기 위한 요청 데이터
 * 포지션 수량은 자동으로 조회되므로 사용자가 직접 입력할 필요가 없음
 */
export class CloseAllPositionRequest {
  @ApiProperty({
    description: '청산할 포지션의 심볼 (예: BTCUSDT)',
    example: 'BTCUSDT',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({
    description: '청산 작업에 대한 메모 (선택사항)',
    example: '전체 청산 테스트',
    required: false,
  })
  @IsString()
  @IsOptional()
  memo?: string;
}
