import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradeClosedEvent } from '../dto/events/TradeClosedEvent';
import { FuturesTradeExecutedEvent } from '../dto/events/TradeExecutedEvent';
import { FuturesTradeRecord } from '../entity/FuturesTradeRecord';

/**
 * 선물 거래 내역 저장소
 *
 * 선물 거래 내역의 CRUD 작업을 담당합니다.
 * 포지션 진입과 종료 이벤트를 처리하여 완전한 거래 기록을 관리합니다.
 */
@Injectable()
export class FuturesTradeRecordRepository {
  constructor(
    @InjectRepository(FuturesTradeRecord)
    private readonly repository: Repository<FuturesTradeRecord>,
  ) {}

  /**
   * 선물 거래 이벤트를 엔티티로 변환하여 저장
   */
  async saveFromEvent(
    event: FuturesTradeExecutedEvent,
  ): Promise<FuturesTradeRecord> {
    const record = new FuturesTradeRecord();

    // 기본 거래 정보
    record.symbol = event.symbol;
    record.orderId = event.orderId;
    record.clientOrderId = event.clientOrderId;
    record.side = event.side;
    record.type = event.type;

    // 수량 및 가격 정보
    record.quantity = event.quantity;
    record.price = event.price;
    record.totalAmount = event.totalAmount;

    // 수수료 정보
    record.fee = event.fee;
    record.feeAsset = event.feeAsset;
    record.feeRate = event.feeRate;

    // 상태 및 분류
    record.status = event.status;
    record.source = event.source;
    record.executedAt = event.executedAt;

    // 선물 거래 전용 정보
    record.leverage = event.leverage;
    record.marginType = event.marginType;
    record.initialMargin = event.initialMargin;
    record.maintenanceMargin = event.maintenanceMargin;
    record.positionSide = event.positionSide;
    record.liquidationPrice = event.liquidationPrice;
    record.markPrice = event.markPrice;
    record.marginRatio = event.marginRatio;

    // 추가 정보
    record.strategyId = event.strategyId;
    record.metadata = event.metadata;

    // 초기 상태 설정
    record.isClosed = false;
    record.isLiquidated = false;

    return this.repository.save(record);
  }

  /**
   * 포지션 종료 이벤트로 거래 내역 업데이트
   */
  async updateFromCloseEvent(
    event: TradeClosedEvent,
  ): Promise<FuturesTradeRecord> {
    const record = await this.repository.findOne({
      where: { orderId: event.originalOrderId },
    });

    if (!record) {
      throw new Error(`포지션을 찾을 수 없습니다: ${event.originalOrderId}`);
    }

    // 종료 정보 업데이트
    record.closePosition({
      closeType: event.closeType,
      closePrice: event.closePrice,
      closeQuantity: event.closeQuantity,
      pnl: event.pnl,
      pnlPercent: event.pnlPercent,
      roe: event.roe,
      closeOrderId: event.closeOrderId,
    });

    // 청산 여부 확인
    if (event.closeType === 'LIQUIDATION') {
      record.isLiquidated = true;
    }

    return this.repository.save(record);
  }

  /**
   * ID로 거래 내역 조회
   */
  async findById(id: string): Promise<FuturesTradeRecord | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * 주문 ID로 거래 내역 조회
   */
  async findByOrderId(orderId: string): Promise<FuturesTradeRecord | null> {
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
      positionSide?: string;
      isClosed?: boolean;
    },
  ): Promise<FuturesTradeRecord[]> {
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

    if (options?.positionSide) {
      queryBuilder.andWhere('trade.positionSide = :positionSide', {
        positionSide: options.positionSide,
      });
    }

    if (options?.isClosed !== undefined) {
      queryBuilder.andWhere('trade.isClosed = :isClosed', {
        isClosed: options.isClosed,
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
   * 활성 포지션 조회 (종료되지 않은 포지션)
   */
  async findActivePositions(symbol?: string): Promise<FuturesTradeRecord[]> {
    const queryBuilder = this.repository
      .createQueryBuilder('trade')
      .where('trade.isClosed = :isClosed', { isClosed: false });

    if (symbol) {
      queryBuilder.andWhere('trade.symbol = :symbol', { symbol });
    }

    return queryBuilder.orderBy('trade.executedAt', 'DESC').getMany();
  }

  /**
   * 종료된 포지션 조회
   */
  async findClosedPositions(
    symbol?: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<FuturesTradeRecord[]> {
    const queryBuilder = this.repository
      .createQueryBuilder('trade')
      .where('trade.isClosed = :isClosed', { isClosed: true });

    if (symbol) {
      queryBuilder.andWhere('trade.symbol = :symbol', { symbol });
    }

    if (options?.startDate && options?.endDate) {
      queryBuilder.andWhere('trade.closedAt BETWEEN :startDate AND :endDate', {
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

    return queryBuilder.orderBy('trade.closedAt', 'DESC').getMany();
  }

  /**
   * 선물 거래 통계 조회
   */
  async getFuturesStatistics(
    symbol?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalTrades: number;
    activeTrades: number;
    closedTrades: number;
    totalVolume: number;
    totalPnl: number;
    totalFees: number;
    winRate: number;
    avgHoldingTime: number;
    liquidationCount: number;
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
        'SUM(CASE WHEN trade.isClosed = false THEN 1 ELSE 0 END) as activeTrades',
        'SUM(CASE WHEN trade.isClosed = true THEN 1 ELSE 0 END) as closedTrades',
        'SUM(trade.totalAmount) as totalVolume',
        'SUM(CASE WHEN trade.pnl IS NOT NULL THEN trade.pnl ELSE 0 END) as totalPnl',
        'SUM(trade.fee) as totalFees',
        'SUM(CASE WHEN trade.pnl > 0 THEN 1 ELSE 0 END) as winTrades',
        'AVG(CASE WHEN trade.holdingDuration IS NOT NULL THEN trade.holdingDuration ELSE 0 END) as avgHoldingTime',
        'SUM(CASE WHEN trade.isLiquidated = true THEN 1 ELSE 0 END) as liquidationCount',
      ])
      .getRawOne();

    const totalTrades = parseInt(result.totalTrades) || 0;
    const closedTrades = parseInt(result.closedTrades) || 0;
    const winTrades = parseInt(result.winTrades) || 0;

    return {
      totalTrades,
      activeTrades: parseInt(result.activeTrades) || 0,
      closedTrades,
      totalVolume: parseFloat(result.totalVolume) || 0,
      totalPnl: parseFloat(result.totalPnl) || 0,
      totalFees: parseFloat(result.totalFees) || 0,
      winRate: closedTrades > 0 ? (winTrades / closedTrades) * 100 : 0,
      avgHoldingTime: parseFloat(result.avgHoldingTime) || 0,
      liquidationCount: parseInt(result.liquidationCount) || 0,
    };
  }

  /**
   * 위험 포지션 조회 (높은 마진 비율)
   */
  async findHighRiskPositions(
    marginThreshold: number = 80,
  ): Promise<FuturesTradeRecord[]> {
    return this.repository
      .createQueryBuilder('trade')
      .where('trade.isClosed = :isClosed', { isClosed: false })
      .andWhere('trade.marginRatio >= :threshold', {
        threshold: marginThreshold,
      })
      .orderBy('trade.marginRatio', 'DESC')
      .getMany();
  }

  /**
   * 수익성 높은 거래 조회
   */
  async findProfitableTrades(
    minPnlPercent: number = 10,
    limit: number = 10,
  ): Promise<FuturesTradeRecord[]> {
    return this.repository
      .createQueryBuilder('trade')
      .where('trade.isClosed = :isClosed', { isClosed: true })
      .andWhere('trade.pnlPercent >= :minPnlPercent', { minPnlPercent })
      .orderBy('trade.pnlPercent', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * 손실 거래 조회
   */
  async findLossTrades(
    maxPnlPercent: number = -10,
    limit: number = 10,
  ): Promise<FuturesTradeRecord[]> {
    return this.repository
      .createQueryBuilder('trade')
      .where('trade.isClosed = :isClosed', { isClosed: true })
      .andWhere('trade.pnlPercent <= :maxPnlPercent', { maxPnlPercent })
      .orderBy('trade.pnlPercent', 'ASC')
      .limit(limit)
      .getMany();
  }
}
