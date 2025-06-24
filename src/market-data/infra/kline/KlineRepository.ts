import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { KlineEntity } from './KlineEntity';

@Injectable()
export class KlineRepository extends Repository<KlineEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(KlineEntity, dataSource.createEntityManager());
  }

  async saveOrUpdateKline(kline: KlineEntity): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(KlineEntity)
      .values(kline)
      .orUpdate(
        [
          'close_price',
          'high_price',
          'low_price',
          'base_volume',
          'quote_volume',
          'taker_buy_base_volume',
          'taker_buy_quote_volume',
        ],
        ['symbol', 'interval', 'open_timestamp'], // ON CONFLICT 조건
      )
      .execute();
  }

  async upsertMany(entities: KlineEntity[]): Promise<void> {
    if (entities.length === 0) return;

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(KlineEntity)
      .values(entities)
      .orUpdate(
        [
          'close_price',
          'high_price',
          'low_price',
          'base_volume',
          'quote_volume',
          'taker_buy_base_volume',
          'taker_buy_quote_volume',
        ],
        ['symbol', 'interval', 'open_timestamp'],
      )
      .execute();
  }

  async saveAll(entities: KlineEntity[]): Promise<void> {
    await this.save(entities, { chunk: 100 });
  }

  async saveOne(entity: KlineEntity): Promise<void> {
    await this.save(entity);
  }

  async findBySymbolAndInterval(
    symbol: string,
    interval: string,
  ): Promise<KlineEntity[]> {
    return this.find({
      where: { symbol, interval },
      order: { openTimestamp: 'DESC' },
      take: 100, // 예시: 최근 100개 가져오기
    });
  }

  async existsBySymbolIntervalTimestamp(
    symbol: string,
    interval: string,
    openTimestamp: number,
  ): Promise<boolean> {
    const count = await this.count({
      where: { symbol, interval, openTimestamp },
    });
    return count > 0;
  }
}
