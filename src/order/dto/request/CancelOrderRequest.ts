import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';
import { IsSupportedSymbol } from 'src/common/validator/IsSupportedSymbol';

export class CancelOrderRequest {
  @ApiProperty({
    example: 'BTCUSDT',
    description: '주문을 취소할 심볼',
  })
  @IsSupportedSymbol({ message: '지원하지 않는 코인 심볼입니다.' })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({
    example: 123456789,
    description: '주문 ID',
  })
  @IsNumber()
  @IsPositive({ message: 'orderId는 양수여야 합니다.' })
  orderId: number;
}
