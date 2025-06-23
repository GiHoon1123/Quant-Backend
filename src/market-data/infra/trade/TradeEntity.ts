import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'trades' })
export class TradeEntity {
  /** 고유 ID (Auto Increment) */
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  /** 트레이드 ID (심볼 기준 유니크) */
  @Index() // 조회 최적화
  @Column({ name: 'trade_id', type: 'bigint' })
  tradeId: number;

  /** 거래 이벤트 유형 (e.g., "trade") */
  @Column({ name: 'event_type' })
  eventType: string;

  /** 이벤트 시간 (ms timestamp) */
  @Column({ name: 'event_time', type: 'bigint' })
  eventTime: number;

  /** 심볼 (e.g., "BTCUSDT") */
  @Column({ name: 'symbol' })
  symbol: string;

  /** 체결 가격 */
  @Column({ name: 'price', type: 'numeric' })
  price: number;

  /** 체결 수량 */
  @Column({ name: 'quantity', type: 'numeric' })
  quantity: number;

  /** 체결 시간 */
  @Column({ name: 'trade_time', type: 'bigint' })
  tradeTime: number;

  /** 메이커 여부 */
  @Column({ name: 'is_buyer_maker', type: 'boolean' })
  isBuyerMaker: boolean;
}
