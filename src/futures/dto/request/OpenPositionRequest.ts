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
import {
  StopLossDto,
  TakeProfitDto,
} from '../../../order/dto/request/MarketBuyRequest';

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

  /**
   * 손절 설정 (옵셔널)
   *
   * @description 선물 포지션 진입 시 손절가를 설정할 수 있습니다.
   *
   * **포지션별 손절 방향:**
   * - 롱 포지션: 진입가보다 낮은 가격에서 손절 (가격 하락 시 손실 제한)
   * - 숏 포지션: 진입가보다 높은 가격에서 손절 (가격 상승 시 손실 제한)
   *
   * **사용 방법:**
   * - PERCENT: 진입가 기준 퍼센트로 설정 (예: 0.02 = 2% 불리한 방향 이동 시 손절)
   * - PRICE: 절대 가격으로 설정 (예: 49000 = 49,000 USDT에서 손절)
   * - NONE: 손절 미설정 (위험하므로 권장하지 않음)
   *
   * **레버리지 고려사항:**
   * - 레버리지가 높을수록 작은 가격 변동으로도 큰 손실 발생 가능
   * - 환경변수 기본값(2%)은 레버리지를 고려한 보수적 설정
   * - 수동 거래: 사용자 판단에 따라 설정 또는 미설정
   * - 자동매매: 미설정 시 환경변수 기본값 자동 적용으로 리스크 관리
   *
   * **중요 경고:**
   * - 선물 거래는 레버리지로 인해 손실이 증폭될 수 있습니다
   * - 손절 설정 없이 거래하는 것은 매우 위험합니다
   */
  @ApiProperty({
    required: false,
    description: '손절 설정 (옵셔널)',
    example: {
      type: 'PERCENT',
      value: 0.02,
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
        description: '손절 값 (PERCENT일 때: 0.02=2%, PRICE일 때: 실제 가격)',
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
   * @description 선물 포지션 진입 시 익절가를 설정할 수 있습니다.
   *
   * **포지션별 익절 방향:**
   * - 롱 포지션: 진입가보다 높은 가격에서 익절 (가격 상승 시 수익 실현)
   * - 숏 포지션: 진입가보다 낮은 가격에서 익절 (가격 하락 시 수익 실현)
   *
   * **사용 방법:**
   * - PERCENT: 진입가 기준 퍼센트로 설정 (예: 0.04 = 4% 유리한 방향 이동 시 익절)
   * - PRICE: 절대 가격으로 설정 (예: 52000 = 52,000 USDT에서 익절)
   * - NONE: 익절 미설정 (수동으로 포지션 관리)
   *
   * **레버리지 활용:**
   * - 레버리지로 인해 작은 가격 변동으로도 큰 수익 실현 가능
   * - 환경변수 기본값(4%)은 레버리지를 고려한 적절한 수익 목표
   * - 욕심을 제어하고 안정적인 수익 실현에 도움
   *
   * **수익 관리 전략:**
   * - 수동 거래: 시장 상황에 따라 유연하게 설정 또는 미설정
   * - 자동매매: 미설정 시 환경변수 기본값으로 일관된 수익 관리
   * - 부분 익절: 여러 구간으로 나누어 익절하는 전략도 고려 가능
   */
  @ApiProperty({
    required: false,
    description: '익절 설정 (옵셔널)',
    example: {
      type: 'PERCENT',
      value: 0.04,
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
        description: '익절 값 (PERCENT일 때: 0.04=4%, PRICE일 때: 실제 가격)',
      },
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TakeProfitDto)
  takeProfit?: TakeProfitDto;
}
