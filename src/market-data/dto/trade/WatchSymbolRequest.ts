import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsModifiableSymbol } from 'src/common/validator/IsModifiableSymbol';
import { IsSupportedSymbol } from 'src/common/validator/IsSupportedSymbol';

export class WatchSymbolRequest {
  @ApiProperty({
    example: 'BTCUSDT',
    description: '관심 등록할 코인 심볼',
  })
  @IsModifiableSymbol()
  @IsSupportedSymbol({ message: '지원하지 않는 코인 심볼입니다.' })
  @IsString()
  @IsNotEmpty()
  symbol: string;
}
