// src/market-data/infra/trade/TradeRepository.ts
import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TradeEntity } from './TradeEntity';

@Injectable()
export class TradeRepository extends Repository<TradeEntity> {
  constructor(private dataSource: DataSource) {
    super(TradeEntity, dataSource.createEntityManager());
  }

  async saveIfNotExists(trade: TradeEntity): Promise<void> {
    const exists = await this.findOneBy({ tradeId: trade.tradeId });
    if (!exists) {
      await this.save(trade);
    }
  }
}
