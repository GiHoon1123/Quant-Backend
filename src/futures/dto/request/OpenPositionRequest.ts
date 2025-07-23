import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { AccountInfoDto } from '../../../common/dto/AccountInfoDto';

/**
 * 선물 포지션 타입 열거형
 * LONG: 롱 포지션 (상승 베팅)
 * SHORT: 숏 포지션 (하락 베팅)
 */
export enum PositionSide {
  LONG = 'LONG', // 롱 포지션 - 가격 상승 시 수익
  SHORT = 'SHORT', // 숏 포지션 - 가격 하락 시 수익
}

/**
 * 선물 포지션 진입 요청 DTO
 *
 * 사용자가 선물 포지션을 진입할 때 필요한 정보들을 정의합니다.
 * 시장가 주문으로 즉시 포지션을 진입합니다.
 */
export class OpenPositionRequest extends AccountInfoDto {
  @ApiProperty({
    example: 'BTCUSDT',
    description: '선물 거래 심볼 (예: BTCUSDT, ETHUSDT)',
  })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({
    enum: PositionSide,
    example: PositionSide.LONG,
    description: '포지션 방향 (LONG: 롱/상승베팅, SHORT: 숏/하락베팅)',
  })
  @IsEnum(PositionSide)
  side: PositionSide;

  @ApiProperty({
    example: 0.001,
    description: '포지션 수량 (BTC 기준으로 0.001 = 천분의 1개)',
  })
  @IsNumber()
  @Min(0.001, { message: '최소 포지션 수량은 0.001입니다.' })
  quantity: number;

  @ApiProperty({
    example: 10,
    description: '레버리지 배수 (1~125배, 높을수록 위험)',
    minimum: 1,
    maximum: 125,
  })
  @IsNumber()
  @Min(1, { message: '레버리지는 최소 1배입니다.' })
  leverage: number;
}
