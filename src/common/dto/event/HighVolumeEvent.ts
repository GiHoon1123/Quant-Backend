import { ApiProperty } from '@nestjs/swagger';
import { CandleData } from '../../../market-data/infra/persistence/entity/Candle15MEntity';

/**
 * 높은 거래량 감지 이벤트 DTO
 * @event candle.high.volume
 */
export class HighVolumeEvent {
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

  @ApiProperty({ description: '현재 거래량' })
  currentVolume: number;

  @ApiProperty({ description: '최근 평균 거래량' })
  averageVolume: number;

  @ApiProperty({ description: '거래량 비율 (현재/평균)' })
  volumeRatio: number;

  @ApiProperty({ description: '이벤트 발생 시각' })
  timestamp: Date;
}
