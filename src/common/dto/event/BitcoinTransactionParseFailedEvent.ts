import { ApiProperty } from '@nestjs/swagger';

/**
 * 비트코인 트랜잭션 파싱 실패 이벤트 DTO
 * @event bitcoin.transaction.parse.failed
 */
export class BitcoinTransactionParseFailedEvent {
  @ApiProperty({ description: '이벤트 고유 ID' })
  eventId: string;

  @ApiProperty({ description: '이벤트 발생 서비스명' })
  service: string;

  @ApiProperty({ description: '실패 원인 메시지' })
  error: string;

  @ApiProperty({ description: '이벤트 발생 시각' })
  timestamp: Date;
}
