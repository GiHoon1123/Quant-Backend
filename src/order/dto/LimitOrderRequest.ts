import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class LimitOrderRequest {
  @ApiProperty({
    example: 'BTCUSDT',
    description: '주문할 코인 심볼',
  })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({
    example: 0.001,
    description: '주문 수량 (최소 0.000001 이상)',
  })
  @IsNumber()
  @Min(0.000001, { message: 'quantity는 최소 0.000001 이상이어야 합니다.' })
  quantity: number;

  @ApiProperty({
    example: 62000,
    description: '주문 가격 (지정가)',
  })
  @IsNumber()
  @Min(0.000001, { message: 'price는 0보다 커야 합니다.' })
  price: number;
}
