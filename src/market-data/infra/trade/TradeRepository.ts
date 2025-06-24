import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TradeEntity } from './TradeEntity';

@Injectable()
export class TradeRepository extends Repository<TradeEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(TradeEntity, dataSource.createEntityManager());
  }

  /**
   * 이미 존재하지 않으면 저장 (tradeId 기준)
   */
  async saveIfNotExists(trade: TradeEntity): Promise<void> {
    const exists = await this.findOneBy({ tradeId: trade.tradeId });
    if (!exists) {
      await this.save(trade);
    }
  }

  /**
   * 단일 ID로 조회
   */
  async findById(id: number): Promise<TradeEntity | null> {
    return await this.findOneBy({ id });
  }

  /**
   * 심볼 기준으로 최근 거래 조회 (limit 가능)
   */
  async findRecentBySymbol(symbol: string, limit = 50): Promise<TradeEntity[]> {
    return await this.find({
      where: { symbol },
      order: { tradeTime: 'DESC' },
      take: limit,
    });
  }

  /**
   * tradeId 기준 삭제
   */
  async deleteByTradeId(tradeId: number): Promise<void> {
    await this.delete({ tradeId });
  }

  /**
   * 전체 삭제 (주의: 개발용 또는 테스트용)
   */
  async clearAll(): Promise<void> {
    await this.clear();
  }
}
