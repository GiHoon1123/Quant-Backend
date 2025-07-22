import { ApiProperty } from '@nestjs/swagger';

/**
 * 시스템 헬스체크 이벤트 DTO
 * @event aggregator.health.check
 */
export class HealthCheckEvent {
  @ApiProperty({ description: '이벤트 고유 ID', required: false })
  eventId?: string;

  @ApiProperty({ description: '이벤트 발생 서비스명', required: false })
  service?: string;

  @ApiProperty({ description: '헬스체크 시각' })
  timestamp: Date;

  @ApiProperty({ description: '연결된 심볼 개수' })
  connectedSymbols: number;

  @ApiProperty({ description: '끊어진 심볼 개수' })
  disconnectedSymbols: number;

  @ApiProperty({ description: '정체된 연결 개수' })
  staleConnections: number;

  @ApiProperty({ description: '메모리 사용량 정보' })
  memoryUsage: { totalCandles: number; memoryMB: number };

  @ApiProperty({ description: 'DB 연결 상태' })
  dbConnected: boolean;
}
