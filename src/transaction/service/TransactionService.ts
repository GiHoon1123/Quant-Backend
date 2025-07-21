import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TradeClosedEvent } from '../dto/events/TradeClosedEvent';
import {
  FuturesTradeExecutedEvent,
  SpotTradeExecutedEvent,
  TradeEventUtils,
  TradeExecutedEvent,
} from '../dto/events/TradeExecutedEvent';
import { BitcoinTransactionRepository } from '../infra/BitcoinTransactionRepository';
import { FuturesTradeRecordRepository } from '../infra/FuturesTradeRecordRepository';
import { SpotTradeRecordRepository } from '../infra/SpotTradeRecordRepository';

/**
 * 거래 내역 관리 서비스
 *
 * 이벤트 기반으로 거래 내역을 저장하고 관리하는 핵심 서비스입니다.
 * 거래 실행 이벤트를 수신하여 데이터베이스에 저장하고,
 * 심볼에 따라 해당 코인의 온체인 트랜잭션 파싱을 트리거합니다.
 */
@Injectable()
export class TransactionService {
  constructor(
    private readonly spotTradeRepository: SpotTradeRecordRepository,
    private readonly futuresTradeRepository: FuturesTradeRecordRepository,
    private readonly bitcoinTransactionRepository: BitcoinTransactionRepository,
  ) {}

  /**
   * 거래 실행 이벤트 처리
   *
   * 현물 또는 선물 거래가 실행되었을 때 호출됩니다.
   * 1. 거래 내역을 데이터베이스에 저장
   * 2. 심볼에서 코인을 추출하여 해당 코인의 트랜잭션 파싱 트리거
   */
  @OnEvent('trade.executed')
  async handleTradeExecuted(event: TradeExecutedEvent): Promise<void> {
    try {
      console.log(
        `📝 거래 내역 저장 시작: ${event.symbol} ${event.side} ${event.quantity}`,
      );

      // 1. 거래 내역 저장
      await this.saveTradeRecord(event);

      // 2. 코인별 트랜잭션 파싱 트리거
      await this.triggerTransactionParsing(event);

      console.log(`✅ 거래 내역 처리 완료: ${event.orderId}`);
    } catch (error) {
      console.error(`❌ 거래 내역 처리 실패: ${event.orderId}`, error);
      // 에러가 발생해도 거래 실행에는 영향을 주지 않도록 에러를 던지지 않음
    }
  }

  /**
   * 포지션 종료 이벤트 처리
   *
   * 선물 포지션이 종료되었을 때 호출됩니다.
   * 기존 거래 내역에 종료 정보를 업데이트합니다.
   */
  @OnEvent('trade.closed')
  async handleTradeClosed(event: TradeClosedEvent): Promise<void> {
    try {
      console.log(
        `📝 포지션 종료 처리 시작: ${event.symbol} ${event.closeType}`,
      );

      // 선물 거래 내역 업데이트
      await this.futuresTradeRepository.updateFromCloseEvent(event);

      console.log(`✅ 포지션 종료 처리 완료: ${event.closeOrderId}`);
    } catch (error) {
      console.error(
        `❌ 포지션 종료 처리 실패: ${event.originalOrderId}`,
        error,
      );
    }
  }

  /**
   * 거래 내역 저장
   */
  private async saveTradeRecord(event: TradeExecutedEvent): Promise<void> {
    if (TradeEventUtils.isSpotTradeEvent(event)) {
      await this.saveSpotTradeRecord(event);
    } else if (TradeEventUtils.isFuturesTradeEvent(event)) {
      await this.saveFuturesTradeRecord(event);
    }
  }

  /**
   * 현물 거래 내역 저장
   */
  private async saveSpotTradeRecord(
    event: SpotTradeExecutedEvent,
  ): Promise<void> {
    try {
      const record = await this.spotTradeRepository.saveFromEvent(event);
      console.log(`💰 현물 거래 저장 완료: ${record.id} (${event.symbol})`);
    } catch (error) {
      console.error(`❌ 현물 거래 저장 실패: ${event.orderId}`, error);
      throw error;
    }
  }

  /**
   * 선물 거래 내역 저장
   */
  private async saveFuturesTradeRecord(
    event: FuturesTradeExecutedEvent,
  ): Promise<void> {
    try {
      const record = await this.futuresTradeRepository.saveFromEvent(event);
      console.log(
        `🚀 선물 거래 저장 완료: ${record.id} (${event.symbol} ${event.positionSide})`,
      );
    } catch (error) {
      console.error(`❌ 선물 거래 저장 실패: ${event.orderId}`, error);
      throw error;
    }
  }

  /**
   * 코인별 트랜잭션 파싱 트리거
   *
   * 심볼에서 코인을 추출하여 해당 코인의 온체인 트랜잭션 파싱을 시작합니다.
   * 현재는 비트코인만 지원하며, 나중에 다른 코인들을 추가할 예정입니다.
   */
  private async triggerTransactionParsing(
    event: TradeExecutedEvent,
  ): Promise<void> {
    const coin = this.extractCoinFromSymbol(event.symbol);

    console.log(`🔍 ${coin} 트랜잭션 파싱 트리거: ${event.symbol}`);

    switch (coin) {
      case 'BTC':
        await this.triggerBitcoinTransactionParsing(event);
        break;
      case 'ETH':
        // TODO: 이더리움 트랜잭션 파싱 구현
        console.log(`⏳ ETH 트랜잭션 파싱은 아직 구현되지 않았습니다`);
        break;
      case 'SOL':
        // TODO: 솔라나 트랜잭션 파싱 구현
        console.log(`⏳ SOL 트랜잭션 파싱은 아직 구현되지 않았습니다`);
        break;
      default:
        console.log(`⚠️ 지원하지 않는 코인입니다: ${coin}`);
    }
  }

  /**
   * 비트코인 트랜잭션 파싱 트리거
   *
   * 비트코인 거래가 발생했을 때 관련 온체인 트랜잭션을 수집하고 파싱하는 작업을 시작합니다.
   * 실제 파싱 작업은 별도의 서비스에서 비동기로 처리됩니다.
   */
  private async triggerBitcoinTransactionParsing(
    event: TradeExecutedEvent,
  ): Promise<void> {
    try {
      console.log(`₿ 비트코인 트랜잭션 파싱 예약: ${event.symbol}`);

      // TODO: 실제 구현에서는 큐나 스케줄러를 사용하여 비동기 처리
      // 예시:
      // await this.bitcoinTransactionCollector.scheduleCollection({
      //   relatedTradeId: event.orderId,
      //   tradeType: event.tradeType,
      //   symbol: event.symbol,
      //   expectedAmount: event.quantity,
      //   timestamp: event.executedAt,
      //   source: event.source
      // });

      console.log(`✅ 비트코인 트랜잭션 파싱 예약 완료`);
    } catch (error) {
      console.error(`❌ 비트코인 트랜잭션 파싱 예약 실패:`, error);
    }
  }

  /**
   * 심볼에서 코인 추출
   *
   * 거래 심볼에서 기본 코인을 추출합니다.
   * 예: BTCUSDT → BTC, ETHUSDT → ETH
   */
  private extractCoinFromSymbol(symbol: string): string {
    // USDT, BUSD 등의 페어 제거
    return symbol
      .replace(/USDT$/, '')
      .replace(/BUSD$/, '')
      .replace(/USDC$/, '')
      .replace(/BNB$/, '');
  }

  // === 조회 메서드들 ===

  /**
   * 현물 거래 내역 조회
   */
  async getSpotTradeHistory(
    symbol?: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    if (symbol) {
      return this.spotTradeRepository.findBySymbol(symbol, options);
    }
    return this.spotTradeRepository.findAll(options);
  }

  /**
   * 선물 거래 내역 조회
   */
  async getFuturesTradeHistory(
    symbol?: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      positionSide?: string;
      isClosed?: boolean;
    },
  ) {
    if (symbol) {
      return this.futuresTradeRepository.findBySymbol(symbol, options);
    }
    return this.futuresTradeRepository.findActivePositions(symbol);
  }

  /**
   * 활성 포지션 조회
   */
  async getActivePositions(symbol?: string) {
    return this.futuresTradeRepository.findActivePositions(symbol);
  }

  /**
   * 종료된 포지션 조회
   */
  async getClosedPositions(
    symbol?: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    return this.futuresTradeRepository.findClosedPositions(symbol, options);
  }

  /**
   * 거래 통계 조회
   */
  async getTradeStatistics(symbol?: string, startDate?: Date, endDate?: Date) {
    const spotStats = await this.spotTradeRepository.getTradeStatistics(
      symbol,
      startDate,
      endDate,
    );

    const futuresStats = await this.futuresTradeRepository.getFuturesStatistics(
      symbol,
      startDate,
      endDate,
    );

    return {
      spot: spotStats,
      futures: futuresStats,
      combined: {
        totalTrades: spotStats.totalTrades + futuresStats.totalTrades,
        totalVolume: spotStats.totalVolume + futuresStats.totalVolume,
        totalFees: spotStats.totalFees + futuresStats.totalFees,
      },
    };
  }

  /**
   * 비트코인 트랜잭션 조회
   */
  async getBitcoinTransactions(options?: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
    purpose?: string;
  }) {
    // TODO: 비트코인 트랜잭션 조회 로직 구현
    return [];
  }
}
