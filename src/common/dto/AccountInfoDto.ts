import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * 계정 정보 베이스 DTO
 *
 * 모든 거래 요청에서 계정 정보를 포함하기 위한 베이스 클래스입니다.
 * 실제로는 JWT 토큰이나 API 키에서 추출하여 자동으로 설정됩니다.
 */
export class AccountInfoDto {
  @ApiProperty({
    example: 'binance_api_user_001',
    description: '계정 식별자 (API KEY 기반 또는 사용자 ID)',
    required: false,
  })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiProperty({
    example: 'user123',
    description: '사용자 ID (있는 경우)',
    required: false,
  })
  @IsOptional()
  @IsString()
  userId?: string;
}
