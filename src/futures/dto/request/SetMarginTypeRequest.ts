import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

/**
 * 마진 모드 열거형
 * ISOLATED: 격리마진 - 포지션별로 마진이 분리됨, 리스크 제한적
 * CROSSED: 교차마진 - 전체 잔고를 마진으로 사용, 리스크 높지만 청산 위험 낮음
 */
export enum MarginType {
  ISOLATED = 'ISOLATED', // 격리마진 - 안전하지만 자금효율성 낮음
  CROSSED = 'CROSSED', // 교차마진 - 위험하지만 자금효율성 높음
}

/**
 * 마진 모드 설정 요청 DTO
 *
 * 특정 심볼의 마진 모드를 변경할 때 사용합니다.
 * 포지션이 있는 상태에서는 마진 모드 변경이 불가능합니다.
 */
export class SetMarginTypeRequest {
  @ApiProperty({
    example: 'BTCUSDT',
    description: '마진 모드를 설정할 심볼',
  })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({
    enum: MarginType,
    example: MarginType.ISOLATED,
    description: '마진 모드 (ISOLATED: 격리마진, CROSSED: 교차마진)',
  })
  @IsEnum(MarginType)
  marginType: MarginType;
}
