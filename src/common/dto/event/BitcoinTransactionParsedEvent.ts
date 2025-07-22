import { ApiProperty } from '@nestjs/swagger';
import { BitcoinTransaction } from '../../../transaction/infra/persistence/entity/BitcoinTransactionEntity';

/**
 * 비트코인 트랜잭션 파싱 성공 이벤트 DTO
 * @event bitcoin.transaction.parsed
 */
export class BitcoinTransactionParsedEvent {
  @ApiProperty({ description: '이벤트 고유 ID' })
  eventId: string;

  @ApiProperty({ description: '이벤트 발생 서비스명' })
  service: string;

  @ApiProperty({ description: '파싱된 트랜잭션' })
  transaction: BitcoinTransaction;

  @ApiProperty({ description: '이벤트 발생 시각' })
  timestamp: Date;
}
