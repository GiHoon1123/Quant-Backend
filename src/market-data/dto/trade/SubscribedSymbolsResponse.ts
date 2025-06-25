import { ApiProperty } from '@nestjs/swagger';

export class SubscribedSymbolsResponse {
  @ApiProperty({
    type: [String],
    example: ['BTCUSDT', 'ETHUSDT'],
    description: '구독 중인 심볼 목록',
  })
  symbols: string[];

  constructor(symbols: string[]) {
    this.symbols = symbols;
  }

  static from(symbols: string[]): SubscribedSymbolsResponse {
    return new SubscribedSymbolsResponse(symbols);
  }
}
