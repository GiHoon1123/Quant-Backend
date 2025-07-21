import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { SpotTradeExecutedEvent } from '../../../dto/events/TradeExecutedEvent';
import { SpotTradeRecord } from '../entity/SpotTradeRecordEntity';

/**
 * 현물 거래 내역 저장소
 *
 * 현물 거래 내역의 CRUD 작업을 담당합니다.
 * 이벤트 데이터를 엔티티로 변환하여 저장하고 조회 기능을 제공합니다.
 */
@Injectable()
export class SpotTradeRecordRepository {
  constructor(
    @InjectRepository(SpotTradeRecord)
    private readonly repository: Repository<SpotTradeRecord>,
  ) {}

  /**
   * 현물 거래 이벤트를 엔티티로 변환하여 저장
   */
  async saveFromEvent(event: SpotTradeExecutedEvent): Promise<SpotTradeRecord> {
    const record = new SpotTradeRecord();

    // 기본 거래 정보
    record.symbol = event.symbol;
    record.orderId = event.orderId;
    record.clientOrderId = event.clientOrderId || '';
    record.side = event.side;
    record.type = event.type;

    // 수량 및 가격 정보
    record.quantity = event.quantity;
    record.price = event.price;
    record.totalAmount = event.totalAmount;

    // 수수료 정보
    record.fee = event.fee;
    record.feeAsset = event.feeAsset;
    record.feeRate = event.feeRate || 0;

    // 상태 및 분류
    record.status = event.status;
    record.source = event.source;
    record.executedAt = event.executedAt;

    // 추가 정보
    record.strategyId = event.strategyId || '';
    record.metadata = event.metadata;

    // 계산된 필드
    record.netAmount = event.totalAmount - event.fee;

    return this.repository.save(record);
  }

  /**
   * ID로 거래 내역 조회
   */
  async findById(id: string): Promise<SpotTradeRecord | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * 주문 ID로 거래 내역 조회
   */
  async findByOrderId(orderId: string): Promise<SpotTradeRecord | null> {
    return this.repository.findOne({ where: { orderId } });
  }

  /**
   * 심볼별 거래 내역 조회
   */
  async findBySymbol(
    symbol: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<SpotTradeRecord[]> {
    const queryBuilder = this.repository
      .createQueryBuilder('trade')
      .where('trade.symbol = :symbol', { symbol });

    if (options?.startDate && options?.endDate) {
      queryBuilder.andWhere(
        'trade.executedAt BETWEEN :startDate AND :endDate',
        {
          startDate: options.startDate,
          endDate: options.endDate,
        },
      );
    }

    if (options?.limit) {
      queryBuilder.limit(options.limit);
    }

    if (options?.offset) {
      queryBuilder.offset(options.offset);
    }

    return queryBuilder.orderBy('trade.executedAt', 'DESC').getMany();
  }

  /**
   * 전체 거래 내역 조회 (페이징)
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
    source?: string;
  }): Promise<SpotTradeRecord[]> {
    const queryBuilder = this.repository.createQueryBuilder('trade');

    if (options?.startDate && options?.endDate) {
      queryBuilder.where('trade.executedAt BETWEEN :startDate AND :endDate', {
        startDate: options.startDate,
        endDate: options.endDate,
      });
    }

    if (options?.source) {
      queryBuilder.andWhere('trade.source = :source', {
        source: options.source,
      });
    }

    if (options?.limit) {
      queryBuilder.limit(options.limit);
    }

    if (options?.offset) {
      queryBuilder.offset(options.offset);
    }

    return queryBuilder.orderBy('trade.executedAt', 'DESC').getMany();
  }

  /**
   * 거래 통계 조회
   */
  async getTradeStatistics(
    symbol?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalTrades: number;
    totalVolume: number;
    totalFees: number;
    buyTrades: number;
    sellTrades: number;
    avgTradeSize: number;
  }> {
    const queryBuilder = this.repository.createQueryBuilder('trade');

    if (symbol) {
      queryBuilder.where('trade.symbol = :symbol', { symbol });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere(
        'trade.executedAt BETWEEN :startDate AND :endDate',
        {
          startDate,
          endDate,
        },
      );
    }

    const result = await queryBuilder
      .select([
        'COUNT(*) as totalTrades',
        'SUM(trade.totalAmount) as totalVolume',
        'SUM(trade.fee) as totalFees',
        "SUM(CASE WHEN trade.side = 'BUY' THEN 1 ELSE 0 END) as buyTrades",
        "SUM(CASE WHEN trade.side = 'SELL' THEN 1 ELSE 0 END) as sellTrades",
        'AVG(trade.totalAmount) as avgTradeSize',
      ])
      .getRawOne();

    return {
      totalTrades: parseInt(result.totalTrades) || 0,
      totalVolume: parseFloat(result.totalVolume) || 0,
      totalFees: parseFloat(result.totalFees) || 0,
      buyTrades: parseInt(result.buyTrades) || 0,
      sellTrades: parseInt(result.sellTrades) || 0,
      avgTradeSize: parseFloat(result.avgTradeSize) || 0,
    };
  }

  /**
   * 최근 거래 내역 조회
   */
  async findRecent(limit: number = 10): Promise<SpotTradeRecord[]> {
    return this.repository.find({
      order: { executedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * 특정 기간의 거래 내역 개수 조회
   */
  async countByDateRange(startDate: Date, endDate: Date): Promise<number> {
    return this.repository.count({
      where: {
        executedAt: Between(startDate, endDate),
      },
    });
  }

  /**
   * 심볼별 총 거래량 조회
   */
  async getTotalVolumeBySymbol(symbol: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('trade')
      .select('SUM(trade.totalAmount)', 'totalVolume')
      .where('trade.symbol = :symbol', { symbol })
      .getRawOne();

    return parseFloat(result.totalVolume) || 0;
  }
}
