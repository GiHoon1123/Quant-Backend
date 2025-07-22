import { ApiProperty } from '@nestjs/swagger';
import { CandleData } from '../../../market-data/infra/persistence/entity/Candle15MEntity';

/**
 * 갭 발생 감지 이벤트 DTO
 * @event candle.gap.detected
 */
export class GapDetectedEvent {
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

  @ApiProperty({ description: '갭 비율 (%)' })
  gapPercent: number;

  @ApiProperty({ description: '갭 방향 (UP/DOWN)' })
  direction: 'UP' | 'DOWN';

  @ApiProperty({ description: '이전 캔들 종가' })
  prevClose: number;

  @ApiProperty({ description: '현재 캔들 시가' })
  currentOpen: number;

  @ApiProperty({ description: '이벤트 발생 시각' })
  timestamp: Date;
}
