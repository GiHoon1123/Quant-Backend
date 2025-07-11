import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class MarketBuyRequest {
  @ApiProperty({
    example: 'BTCUSDT',
    description: '주문할 코인 심볼 (ex. BTCUSDT)',
  })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({
    example: 10,
    description: '주문 금액 (USDT 기준, 최소 10 이상)',
  })
  @IsNumber()
  @Min(10, { message: '주문 금액은 최소 10 USDT 이상이어야 합니다.' })
  usdtAmount: number;
}
