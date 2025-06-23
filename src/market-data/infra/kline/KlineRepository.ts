import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KlineEntity } from './KlineEntity';

@Injectable()
export class KlineRepository {
  constructor(
    @InjectRepository(KlineEntity)
    private readonly repo: Repository<KlineEntity>,
  ) {}

  async saveAll(entities: KlineEntity[]): Promise<void> {
    await this.repo.save(entities, { chunk: 100 });
  }

  async saveOne(entity: KlineEntity): Promise<void> {
    await this.repo.save(entity);
  }

  async findBySymbolAndInterval(
    symbol: string,
    interval: string,
  ): Promise<KlineEntity[]> {
    return this.repo.find({
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
    const count = await this.repo.count({
      where: { symbol, interval, openTimestamp },
    });
    return count > 0;
  }
}
