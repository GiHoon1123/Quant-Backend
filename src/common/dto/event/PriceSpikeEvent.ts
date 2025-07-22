import { ApiProperty } from '@nestjs/swagger';
import { CandleData } from '../../../market-data/infra/persistence/entity/Candle15MEntity';

/**
 * 급격한 가격 변동 감지 이벤트 DTO
 * @event candle.price.spike
 */
export class PriceSpikeEvent {
  @ApiProperty({ description: '이벤트 고유 ID' })
  eventId: string;

  @ApiProperty({ description: '이벤트 발생 서비스명' })
  service: string;

  @ApiProperty({ description: '거래 심볼' })
  symbol: string;

  @ApiProperty({ description: '시장 구분' })
  market: string;

  @ApiProperty({ description: '캔들 주기' })
  timeframe: string;

  @ApiProperty({ description: '캔들 데이터' })
  candle: CandleData;

  @ApiProperty({ description: '가격 변동률 (%)' })
  priceChangePercent: number;

  @ApiProperty({ description: '변동 방향 (UP/DOWN)' })
  direction: 'UP' | 'DOWN';

  @ApiProperty({ description: '이벤트 발생 시각' })
  timestamp: Date;
}
