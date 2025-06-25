import { ApiProperty } from '@nestjs/swagger';
import { ExternalBalanceResponse } from './ExternalBalanceResponse';

export class BalanceResponse {
  @ApiProperty({
    example: 'USDT',
    description: '자산 종류 (예: USDT, BTC)',
  })
  asset: string;

  @ApiProperty({
    example: 100.25,
    description: '사용 가능한 잔고',
  })
  free: number;

  @ApiProperty({
    example: 5.75,
    description: '주문에 묶인 잔고',
  })
  locked: number;

  static from(external: ExternalBalanceResponse): BalanceResponse {
    return {
      asset: external.asset,
      free: external.free,
      locked: external.locked,
    };
  }

  static fromList(externals: ExternalBalanceResponse[]): BalanceResponse[] {
    return externals.map(BalanceResponse.from);
  }
}
