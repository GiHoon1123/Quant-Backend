import { TradeResponse } from 'src/market-data/dto/trade/TradeResponse';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 실시간 거래 체결 내역을 저장하는 엔티티
 */
@Entity({ name: 'trades' })
@Index(['symbol', 'tradeTime'])
export class TradeEntity {
  /** 고유 ID (Auto Increment, Primary Key) */
  @PrimaryGeneratedColumn({
    name: 'id',
    type: 'bigint',
    comment: '고유 ID (Auto Increment)',
  })
  id: number;

  /** 트레이드 ID (심볼 기준 유니크) */
  @Index() // 조회 최적화
  @Column({
    name: 'trade_id',
    type: 'bigint',
    comment: '거래 ID (거래소 단위 ID, 심볼 기준 유니크)',
  })
  tradeId: number;

  /** 거래 이벤트 유형 (예: "trade") */
  @Column({ name: 'event_type', comment: '거래 이벤트 유형 (예: trade)' })
  eventType: string;

  /** 이벤트 발생 시각 (밀리초 타임스탬프) */
  @Column({
    name: 'event_time',
    type: 'bigint',
    comment: '이벤트 발생 시간 (Unix timestamp in ms)',
  })
  eventTime: number;

  /** 거래 종목 (예: BTCUSDT) */
  @Column({ name: 'symbol', comment: '거래 심볼 (예: BTCUSDT)' })
  symbol: string;

  /** 체결 가격 */
  @Column({ name: 'price', type: 'numeric', comment: '체결 가격' })
  price: number;

  /** 체결 수량 */
  @Column({ name: 'quantity', type: 'numeric', comment: '체결 수량' })
  quantity: number;

  /** 거래 발생 시간 */
  @Column({
    name: 'trade_time',
    type: 'bigint',
    comment: '거래 발생 시간 (Unix timestamp in ms)',
  })
  tradeTime: number;

  /** 매수자 메이커 여부 (true = 매도 주도) */
  @Column({
    name: 'is_buyer_maker',
    type: 'boolean',
    comment: '메이커 여부 (true = 매도자 주도)',
  })
  isBuyerMaker: boolean;

  /**
   * 응답 DTO → 엔티티 변환
   */
  static from(dto: TradeResponse): TradeEntity {
    const entity = new TradeEntity();
    entity.eventType = dto.eventType;
    entity.eventTime = dto.eventTime;
    entity.symbol = dto.symbol;
    entity.tradeId = dto.tradeId;
    entity.price = dto.price;
    entity.quantity = dto.quantity;
    entity.tradeTime = dto.tradeTime;
    entity.isBuyerMaker = dto.isBuyerMaker;
    return entity;
  }
}
