import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

/**
 * 레버리지 설정 요청 DTO
 *
 * 특정 심볼의 레버리지를 변경할 때 사용합니다.
 * 포지션이 있는 상태에서는 레버리지 변경이 제한될 수 있습니다.
 */
export class SetLeverageRequest {
  @ApiProperty({
    example: 'BTCUSDT',
    description: '레버리지를 설정할 심볼',
  })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({
    example: 20,
    description: '설정할 레버리지 배수 (1~125배)',
    minimum: 1,
    maximum: 125,
  })
  @IsNumber()
  @Min(1, { message: '레버리지는 최소 1배입니다.' })
  @Max(125, { message: '레버리지는 최대 125배입니다.' })
  leverage: number;
}
