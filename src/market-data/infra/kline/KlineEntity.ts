import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'kline' })
@Index(['symbol', 'interval', 'open_timestamp'], { unique: true })
export class KlineEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  symbol: string;

  @Column()
  interval: string;

  @Column({ type: 'bigint', name: 'open_timestamp' })
  openTimestamp: number;

  @Column({ type: 'float', name: 'open_price' })
  openPrice: number;

  @Column({ type: 'float', name: 'high_price' })
  highPrice: number;

  @Column({ type: 'float', name: 'low_price' })
  lowPrice: number;

  @Column({ type: 'float', name: 'close_price' })
  closePrice: number;

  @Column({ type: 'float', name: 'base_volume' })
  baseVolume: number;

  @Column({ type: 'float', name: 'quote_volume' })
  quoteVolume: number;

  @Column({ type: 'float', name: 'taker_buy_base_volume' })
  takerBuyBaseVolume: number;

  @Column({ type: 'float', name: 'taker_buy_quote_volume' })
  takerBuyQuoteVolume: number;
}
