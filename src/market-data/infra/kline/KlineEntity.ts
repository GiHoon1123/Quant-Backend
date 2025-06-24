import { KlineResponse } from 'src/market-data/dto/kline/KlineResponse';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 캔들(Kline) 데이터 엔티티
 */
@Entity({ name: 'klines' })
@Index(['symbol', 'interval', 'openTimestamp'], { unique: true })
export class KlineEntity {
  @PrimaryGeneratedColumn({ comment: '자동 증가 ID (PK)' })
  id: number;

  @Column({ comment: '종목 심볼 (예: BTCUSDT)' })
  symbol: string;

  @Column({ comment: '차트 간격 (예: 1m, 5m, 1d)' })
  interval: string;

  @Column({
    type: 'bigint',
    name: 'open_timestamp',
    comment: '캔들 시작 시간 (Unix timestamp, ms)',
  })
  openTimestamp: number;

  @Column({ type: 'float', name: 'open_price', comment: '시가' })
  openPrice: number;

  @Column({ type: 'float', name: 'high_price', comment: '고가' })
  highPrice: number;

  @Column({ type: 'float', name: 'low_price', comment: '저가' })
  lowPrice: number;

  @Column({ type: 'float', name: 'close_price', comment: '종가' })
  closePrice: number;

  @Column({
    type: 'float',
    name: 'base_volume',
    comment: 'Base 자산 기준 거래량',
  })
  baseVolume: number;

  @Column({
    type: 'float',
    name: 'quote_volume',
    comment: 'Quote 자산 기준 거래량',
  })
  quoteVolume: number;

  @Column({
    type: 'float',
    name: 'taker_buy_base_volume',
    comment: '매수자 주도 거래량 (Base)',
  })
  takerBuyBaseVolume: number;

  @Column({
    type: 'float',
    name: 'taker_buy_quote_volume',
    comment: '매수자 주도 거래량 (Quote)',
  })
  takerBuyQuoteVolume: number;

  /**
   * 내부 KlineResponse → KlineEntity 변환
   */
  static from(response: KlineResponse): KlineEntity {
    const entity = new KlineEntity();
    entity.symbol = response.symbol;
    entity.interval = response.interval;
    entity.openTimestamp = response.openTimestamp;
    entity.openPrice = response.openPrice;
    entity.highPrice = response.highPrice;
    entity.lowPrice = response.lowPrice;
    entity.closePrice = response.closePrice;
    entity.baseVolume = response.baseVolume;
    entity.quoteVolume = response.quoteVolume;
    entity.takerBuyBaseVolume = response.takerBuyBaseVolume;
    entity.takerBuyQuoteVolume = response.takerBuyQuoteVolume;
    return entity;
  }
}
