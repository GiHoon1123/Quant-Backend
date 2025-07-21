import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

/**
 * 계좌 유형 열거형
 * SPOT: 현물 계좌
 * FUTURES: 선물 계좌
 */
export enum AccountType {
  SPOT = 'SPOT',
  FUTURES = 'FUTURES',
}

/**
 * 자금 이체 요청 DTO
 *
 * 현물 계좌와 선물 계좌 간의 자금 이체를 위한 요청 정보를 정의합니다.
 */
export class TransferFundsRequest {
  @ApiProperty({
    example: 'USDT',
    description: '이체할 자산 (예: USDT, BTC)',
  })
  @IsString()
  @IsNotEmpty()
  asset: string;

  @ApiProperty({
    example: 10,
    description: '이체할 금액',
  })
  @IsNumber()
  @Min(0.1, { message: '최소 이체 금액은 0.1입니다.' })
  amount: number;

  @ApiProperty({
    enum: AccountType,
    example: AccountType.SPOT,
    description: '출발 계좌 유형',
  })
  @IsEnum(AccountType)
  fromAccountType: AccountType;

  @ApiProperty({
    enum: AccountType,
    example: AccountType.FUTURES,
    description: '도착 계좌 유형',
  })
  @IsEnum(AccountType)
  toAccountType: AccountType;
}
