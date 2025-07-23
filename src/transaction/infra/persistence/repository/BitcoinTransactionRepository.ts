import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import {
  BitcoinTransaction,
  TransactionPurpose,
} from '../entity/BitcoinTransactionEntity';

/**
 * 비트코인 트랜잭션 저장소
 *
 * 비트코인 온체인 트랜잭션의 CRUD 작업을 담당합니다.
 * 파싱된 트랜잭션 정보를 저장하고 거래 내역과의 연관 관계를 관리합니다.
 */
@Injectable()
export class BitcoinTransactionRepository {
  constructor(
    @InjectRepository(BitcoinTransaction)
    private readonly repository: Repository<BitcoinTransaction>,
  ) {}

  /**
   * 비트코인 트랜잭션 저장
   */
  async save(
    transaction: Partial<BitcoinTransaction>,
  ): Promise<BitcoinTransaction> {
    // accountId, userId에 string 또는 null만 할당
    if (transaction.accountId && typeof transaction.accountId !== 'string') {
      transaction.accountId = null;
    }
    if (transaction.userId && typeof transaction.userId !== 'string') {
      transaction.userId = null;
    }
    const entity = this.repository.create(transaction);
    return this.repository.save(entity);
  }

  /**
   * 트랜잭션 해시로 조회
   */
  async findByTxid(txid: string): Promise<BitcoinTransaction | null> {
    return this.repository.findOne({ where: { txid } });
  }

  /**
   * 트랜잭션 해시 존재 여부 확인
   */
  async existsByTxid(txid: string): Promise<boolean> {
    const count = await this.repository.count({ where: { txid } });
    return count > 0;
  }

  /**
   * 여러 트랜잭션 해시 존재 여부 확인
   */
  async findExistingTxids(txids: string[]): Promise<string[]> {
    const transactions = await this.repository.find({
      where: { txid: In(txids) },
      select: ['txid'],
    });
    return transactions.map((tx) => tx.txid);
  }

  /**
   * 블록 높이로 트랜잭션 조회
   */
  async findByBlockHeight(blockHeight: number): Promise<BitcoinTransaction[]> {
    return this.repository.find({
      where: { blockHeight },
      order: { timestamp: 'ASC' },
    });
  }

  /**
   * 블록 높이 범위로 트랜잭션 조회
   */
  async findByBlockHeightRange(
    startHeight: number,
    endHeight: number,
  ): Promise<BitcoinTransaction[]> {
    return this.repository.find({
      where: {
        blockHeight: Between(startHeight, endHeight),
      },
      order: { blockHeight: 'ASC', timestamp: 'ASC' },
    });
  }

  /**
   * 목적별 트랜잭션 조회
   */
  async findByPurpose(
    purpose: TransactionPurpose,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<BitcoinTransaction[]> {
    const queryBuilder = this.repository
      .createQueryBuilder('tx')
      .where('tx.purpose = :purpose', { purpose });

    if (options?.startDate && options?.endDate) {
      queryBuilder.andWhere('tx.timestamp BETWEEN :startDate AND :endDate', {
        startDate: options.startDate,
        endDate: options.endDate,
      });
    }

    if (options?.limit) {
      queryBuilder.limit(options.limit);
    }

    if (options?.offset) {
      queryBuilder.offset(options.offset);
    }

    return queryBuilder.orderBy('tx.timestamp', 'DESC').getMany();
  }

  /**
   * 거래소 관련 트랜잭션 조회
   */
  async findExchangeTransactions(
    exchange?: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<BitcoinTransaction[]> {
    const queryBuilder = this.repository
      .createQueryBuilder('tx')
      .where('tx.relatedExchange IS NOT NULL');

    if (exchange) {
      queryBuilder.andWhere('tx.relatedExchange = :exchange', { exchange });
    }

    if (options?.startDate && options?.endDate) {
      queryBuilder.andWhere('tx.timestamp BETWEEN :startDate AND :endDate', {
        startDate: options.startDate,
        endDate: options.endDate,
      });
    }

    if (options?.limit) {
      queryBuilder.limit(options.limit);
    }

    if (options?.offset) {
      queryBuilder.offset(options.offset);
    }

    return queryBuilder.orderBy('tx.timestamp', 'DESC').getMany();
  }

  /**
   * 거래 내역과 연결된 트랜잭션 조회
   */
  async findByRelatedTradeId(
    tradeId: number,
    tradeType: 'SPOT' | 'FUTURES',
  ): Promise<BitcoinTransaction[]> {
    const whereCondition =
      tradeType === 'SPOT'
        ? { relatedSpotTradeId: tradeId }
        : { relatedFuturesTradeId: tradeId };

    return this.repository.find({
      where: whereCondition,
      order: { timestamp: 'DESC' },
    });
  }

  /**
   * 미파싱 트랜잭션 조회
   */
  async findUnparsedTransactions(
    limit: number = 100,
  ): Promise<BitcoinTransaction[]> {
    return this.repository.find({
      where: { isParsed: false },
      order: { timestamp: 'ASC' },
      take: limit,
    });
  }

  /**
   * 컨펌 수가 부족한 트랜잭션 조회
   */
  async findPendingTransactions(
    minConfirmations: number = 6,
  ): Promise<BitcoinTransaction[]> {
    return this.repository
      .createQueryBuilder('tx')
      .where('tx.confirmations < :minConfirmations', { minConfirmations })
      .orderBy('tx.timestamp', 'DESC')
      .getMany();
  }

  /**
   * 높은 수수료 트랜잭션 조회
   */
  async findHighFeeTransactions(
    minFeeRate: number = 50,
    limit: number = 10,
  ): Promise<BitcoinTransaction[]> {
    return this.repository
      .createQueryBuilder('tx')
      .where('tx.feeRate >= :minFeeRate', { minFeeRate })
      .orderBy('tx.feeRate', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * 주소별 트랜잭션 조회
   */
  async findByAddress(
    address: string,
    type: 'input' | 'output' | 'both' = 'both',
  ): Promise<BitcoinTransaction[]> {
    const queryBuilder = this.repository.createQueryBuilder('tx');

    switch (type) {
      case 'input':
        queryBuilder.where(':address = ANY(tx.inputAddresses)', { address });
        break;
      case 'output':
        queryBuilder.where(':address = ANY(tx.outputAddresses)', { address });
        break;
      case 'both':
        queryBuilder.where(
          ':address = ANY(tx.inputAddresses) OR :address = ANY(tx.outputAddresses)',
          { address },
        );
        break;
    }

    return queryBuilder.orderBy('tx.timestamp', 'DESC').getMany();
  }

  /**
   * 트랜잭션 통계 조회
   */
  async getTransactionStatistics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalTransactions: number;
    totalVolume: number;
    totalFees: number;
    avgFeeRate: number;
    exchangeTransactions: number;
    unparsedTransactions: number;
    purposeBreakdown: Record<TransactionPurpose, number>;
  }> {
    const queryBuilder = this.repository.createQueryBuilder('tx');

    if (startDate && endDate) {
      queryBuilder.where('tx.timestamp BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const result = await queryBuilder
      .select([
        'COUNT(*) as totalTransactions',
        'SUM(ABS(tx.netAmount)) as totalVolume',
        'SUM(tx.fee) as totalFees',
        'AVG(tx.feeRate) as avgFeeRate',
        'SUM(CASE WHEN tx.relatedExchange IS NOT NULL THEN 1 ELSE 0 END) as exchangeTransactions',
        'SUM(CASE WHEN tx.isParsed = false THEN 1 ELSE 0 END) as unparsedTransactions',
      ])
      .getRawOne();

    // 목적별 분류 통계
    const purposeStats = await queryBuilder
      .select(['tx.purpose', 'COUNT(*) as count'])
      .groupBy('tx.purpose')
      .getRawMany();

    const purposeBreakdown = {} as Record<TransactionPurpose, number>;
    Object.values(TransactionPurpose).forEach((purpose) => {
      purposeBreakdown[purpose] = 0;
    });

    purposeStats.forEach((stat) => {
      purposeBreakdown[stat.tx_purpose] = parseInt(stat.count);
    });

    return {
      totalTransactions: parseInt(result.totalTransactions) || 0,
      totalVolume: parseFloat(result.totalVolume) || 0,
      totalFees: parseFloat(result.totalFees) || 0,
      avgFeeRate: parseFloat(result.avgFeeRate) || 0,
      exchangeTransactions: parseInt(result.exchangeTransactions) || 0,
      unparsedTransactions: parseInt(result.unparsedTransactions) || 0,
      purposeBreakdown,
    };
  }

  /**
   * 트랜잭션과 거래 내역 연결
   */
  async linkToSpotTrade(txid: string, spotTradeId: number): Promise<void> {
    await this.repository.update({ txid }, { relatedSpotTradeId: spotTradeId });
  }

  /**
   * 트랜잭션과 선물 거래 내역 연결
   */
  async linkToFuturesTrade(
    txid: string,
    futuresTradeId: number,
  ): Promise<void> {
    await this.repository.update(
      { txid },
      { relatedFuturesTradeId: futuresTradeId },
    );
  }

  /**
   * 파싱 완료 표시
   */
  async markAsParsed(txid: string, parsedBy: string): Promise<void> {
    await this.repository.update(
      { txid },
      {
        isParsed: true,
        parsedAt: new Date(),
        parsedBy,
      },
    );
  }

  /**
   * 컨펌 수 업데이트
   */
  async updateConfirmations(
    txid: string,
    confirmations: number,
  ): Promise<void> {
    await this.repository.update({ txid }, { confirmations });
  }

  /**
   * 최근 트랜잭션 조회
   */
  async findRecent(limit: number = 10): Promise<BitcoinTransaction[]> {
    return this.repository.find({
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * 특정 기간의 트랜잭션 개수 조회
   */
  async countByDateRange(startDate: Date, endDate: Date): Promise<number> {
    return this.repository.count({
      where: {
        timestamp: Between(startDate, endDate),
      },
    });
  }
}
