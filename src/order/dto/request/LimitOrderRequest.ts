import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { StopLossDto, TakeProfitDto } from './MarketBuyRequest';

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

  /**
   * 손절 설정 (옵셔널)
   *
   * @description 현물 지정가 주문 시 손절가를 설정할 수 있습니다.
   *
   * **지정가 주문 특징:**
   * - 지정가 주문이 체결된 후 손절/익절이 활성화됩니다
   * - 체결가(실제 진입가)를 기준으로 손절/익절 가격이 계산됩니다
   *
   * **사용 방법:**
   * - PERCENT: 체결가 기준 퍼센트로 설정 (예: 0.05 = 5% 하락 시 손절)
   * - PRICE: 절대 가격으로 설정 (예: 47000 = 47,000 USDT에서 손절)
   * - NONE: 손절 미설정
   *
   * **주의 사항:**
   * - 지정가 주문이 체결되지 않으면 손절/익절도 설정되지 않습니다
   * - 체결가와 지정가가 다를 수 있으므로 퍼센트 설정을 권장합니다
   */
  @ApiProperty({
    required: false,
    description: '손절 설정 (옵셔널)',
    example: {
      type: 'PERCENT',
      value: 0.05,
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StopLossDto)
  stopLoss?: StopLossDto;

  /**
   * 익절 설정 (옵셔널)
   *
   * @description 현물 지정가 주문 시 익절가를 설정할 수 있습니다.
   *
   * **지정가 주문 특징:**
   * - 지정가 주문이 체결된 후 익절이 활성화됩니다
   * - 체결가(실제 진입가)를 기준으로 익절 가격이 계산됩니다
   *
   * **사용 방법:**
   * - PERCENT: 체결가 기준 퍼센트로 설정 (예: 0.10 = 10% 상승 시 익절)
   * - PRICE: 절대 가격으로 설정 (예: 55000 = 55,000 USDT에서 익절)
   * - NONE: 익절 미설정
   *
   * **수익 최적화:**
   * - 지정가로 더 유리한 가격에 진입 후 익절로 수익을 확정할 수 있습니다
   * - 시장 변동성을 고려하여 적절한 익절 비율을 설정하세요
   */
  @ApiProperty({
    required: false,
    description: '익절 설정 (옵셔널)',
    example: {
      type: 'PERCENT',
      value: 0.1,
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TakeProfitDto)
  takeProfit?: TakeProfitDto;
}
