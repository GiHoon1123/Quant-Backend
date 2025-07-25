import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { AccountInfoDto } from '../../../common/dto/AccountInfoDto';
import { StopLossTakeProfitType } from '../../../common/types/StopLossTakeProfit';

/**
 * 손절 설정 DTO
 *
 * @description API 요청에서 사용되는 손절 설정 데이터 구조입니다.
 *
 * **설정 타입별 동작:**
 * - PERCENT: 진입가 기준 퍼센트 계산 (0.05 = 5% 하락 시 손절)
 * - PRICE: 절대 가격으로 직접 설정 (47000 = 47,000 USDT에서 손절)
 * - NONE: 손절 미설정 (value 필드 무시됨)
 *
 * **유효성 검증:**
 * - PERCENT/PRICE 타입일 때 value는 필수
 * - value는 0보다 큰 값이어야 함
 * - PERCENT일 때 value는 1 미만이어야 함 (100% 미만)
 *
 * **사용 예시:**
 * ```json
 * // 5% 하락 시 손절
 * { "type": "PERCENT", "value": 0.05 }
 *
 * // 47,000 USDT에서 손절
 * { "type": "PRICE", "value": 47000 }
 *
 * // 손절 미설정
 * { "type": "NONE" }
 * ```
 */
export class StopLossDto {
  @ApiProperty({
    enum: StopLossTakeProfitType,
    description: '손절 타입 (PERCENT: 퍼센트, PRICE: 절대가격, NONE: 미설정)',
    example: StopLossTakeProfitType.PERCENT,
  })
  @IsEnum(StopLossTakeProfitType)
  type: StopLossTakeProfitType;

  @ApiProperty({
    required: false,
    description: '손절 값 (type이 NONE이면 무시됨)',
    example: 0.05,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.000001, { message: '손절 값은 0보다 커야 합니다.' })
  value?: number;
}

/**
 * 익절 설정 DTO
 *
 * @description API 요청에서 사용되는 익절 설정 데이터 구조입니다.
 *
 * **설정 타입별 동작:**
 * - PERCENT: 진입가 기준 퍼센트 계산 (0.10 = 10% 상승 시 익절)
 * - PRICE: 절대 가격으로 직접 설정 (55000 = 55,000 USDT에서 익절)
 * - NONE: 익절 미설정 (value 필드 무시됨)
 *
 * **유효성 검증:**
 * - PERCENT/PRICE 타입일 때 value는 필수
 * - value는 0보다 큰 값이어야 함
 * - PERCENT일 때 value는 1 미만이어야 함 (100% 미만)
 *
 * **사용 예시:**
 * ```json
 * // 10% 상승 시 익절
 * { "type": "PERCENT", "value": 0.10 }
 *
 * // 55,000 USDT에서 익절
 * { "type": "PRICE", "value": 55000 }
 *
 * // 익절 미설정
 * { "type": "NONE" }
 * ```
 */
export class TakeProfitDto {
  @ApiProperty({
    enum: StopLossTakeProfitType,
    description: '익절 타입 (PERCENT: 퍼센트, PRICE: 절대가격, NONE: 미설정)',
    example: StopLossTakeProfitType.PERCENT,
  })
  @IsEnum(StopLossTakeProfitType)
  type: StopLossTakeProfitType;

  @ApiProperty({
    required: false,
    description: '익절 값 (type이 NONE이면 무시됨)',
    example: 0.1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.000001, { message: '익절 값은 0보다 커야 합니다.' })
  value?: number;
}

export class MarketBuyRequest extends AccountInfoDto {
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

  /**
   * 손절 설정 (옵셔널)
   *
   * @description 현물 매수 주문 시 손절가를 설정할 수 있습니다.
   *
   * **사용 방법:**
   * - PERCENT: 진입가 기준 퍼센트로 설정 (예: 0.05 = 5% 하락 시 손절)
   * - PRICE: 절대 가격으로 설정 (예: 47000 = 47,000 USDT에서 손절)
   * - NONE: 손절 미설정 (손절 없이 거래)
   *
   * **중요 사항:**
   * - 수동 거래: 사용자가 직접 설정하거나 미설정 선택 가능
   * - 자동매매/전략: 미설정 시 환경변수 기본값(3%) 자동 적용
   * - 현물은 롱 포지션만 가능하므로 진입가보다 낮은 가격에서 손절
   *
   * **리스크 관리:**
   * - 손절 설정을 통해 최대 손실을 제한할 수 있습니다
   * - 변동성이 큰 암호화폐 특성상 손절 설정을 권장합니다
   */
  @ApiProperty({
    required: false,
    description: '손절 설정 (옵셔널)',
    example: {
      type: 'PERCENT',
      value: 0.05,
    },
    type: 'object',
    properties: {
      type: {
        enum: ['PERCENT', 'PRICE', 'NONE'],
        description:
          '손절 타입 (PERCENT: 퍼센트, PRICE: 절대가격, NONE: 미설정)',
      },
      value: {
        type: 'number',
        description: '손절 값 (PERCENT일 때: 0.05=5%, PRICE일 때: 실제 가격)',
      },
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StopLossDto)
  stopLoss?: StopLossDto;

  /**
   * 익절 설정 (옵셔널)
   *
   * @description 현물 매수 주문 시 익절가를 설정할 수 있습니다.
   *
   * **사용 방법:**
   * - PERCENT: 진입가 기준 퍼센트로 설정 (예: 0.10 = 10% 상승 시 익절)
   * - PRICE: 절대 가격으로 설정 (예: 55000 = 55,000 USDT에서 익절)
   * - NONE: 익절 미설정 (익절 없이 거래)
   *
   * **중요 사항:**
   * - 수동 거래: 사용자가 직접 설정하거나 미설정 선택 가능
   * - 자동매매/전략: 미설정 시 환경변수 기본값(6%) 자동 적용
   * - 현물은 롱 포지션만 가능하므로 진입가보다 높은 가격에서 익절
   *
   * **수익 관리:**
   * - 익절 설정을 통해 목표 수익에서 자동으로 매도할 수 있습니다
   * - 욕심을 제어하고 안정적인 수익 실현에 도움이 됩니다
   */
  @ApiProperty({
    required: false,
    description: '익절 설정 (옵셔널)',
    example: {
      type: 'PERCENT',
      value: 0.1,
    },
    type: 'object',
    properties: {
      type: {
        enum: ['PERCENT', 'PRICE', 'NONE'],
        description:
          '익절 타입 (PERCENT: 퍼센트, PRICE: 절대가격, NONE: 미설정)',
      },
      value: {
        type: 'number',
        description: '익절 값 (PERCENT일 때: 0.10=10%, PRICE일 때: 실제 가격)',
      },
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TakeProfitDto)
  takeProfit?: TakeProfitDto;
}
