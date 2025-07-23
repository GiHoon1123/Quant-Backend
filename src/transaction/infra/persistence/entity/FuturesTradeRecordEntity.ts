import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 선물 거래 내역 엔티티
 *
 * 바이낸스 선물 거래의 모든 정보를 저장합니다.
 * 레버리지를 활용한 고위험 고수익 거래 방식의 기록입니다.
 */
@Entity('futures_trade_records')
@Index('idx_futures_symbol_executed', ['symbol', 'executedAt'])
@Index('idx_futures_source_executed', ['source', 'executedAt'])
@Index('idx_futures_orderid', ['orderId'])
@Index('idx_futures_position_executed', ['positionSide', 'executedAt'])
@Index('idx_futures_closed_executed', ['isClosed', 'executedAt'])
export class FuturesTradeRecord {
  @PrimaryGeneratedColumn()
  id: number;

  // 계정 정보 (어떤 계정의 거래인지)
  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index('idx_futures_account')
  accountId: string | null; // 계정 식별자 (API KEY 기반 또는 사용자 ID)

  @Column({ type: 'varchar', length: 100, nullable: true })
  userId: string | null; // 사용자 ID (있는 경우)

  // 거래 기본 정보
  @Column({ length: 20 })
  @Index('idx_futures_symbol')
  symbol: string; // 거래 심볼 (BTCUSDT 등)

  @Column({ type: 'bigint' })
  @Index('idx_futures_order_id')
  orderId: string; // 바이낸스 주문 ID

  @Column({ length: 100, nullable: true })
  clientOrderId: string; // 클라이언트 주문 ID

  @Column({ length: 10 })
  side: string; // BUY/SELL

  @Column({ length: 20 })
  type: string; // MARKET/LIMIT

  // 거래 수량 및 가격 정보
  @Column('decimal', { precision: 18, scale: 8 })
  quantity: number; // 거래 수량

  @Column('decimal', { precision: 18, scale: 8 })
  price: number; // 체결 가격

  @Column('decimal', { precision: 18, scale: 8 })
  totalAmount: number; // 총 거래 금액

  // 수수료 정보
  @Column('decimal', { precision: 18, scale: 8 })
  fee: number; // 수수료

  @Column({ length: 10 })
  feeAsset: string; // 수수료 자산 (USDT/BNB 등)

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  feeRate: number; // 수수료율 (%)

  // 거래 상태 및 분류
  @Column({ length: 20 })
  status: string; // FILLED/PARTIALLY_FILLED/CANCELED

  @Column({ length: 20 })
  @Index('idx_futures_source')
  source: string; // API/AUTO/MANUAL

  // === 선물 거래 전용 필드 ===

  // 레버리지 및 마진 정보
  @Column('decimal', { precision: 10, scale: 2 })
  leverage: number; // 레버리지 배수 (1~125)

  @Column({ length: 20 })
  marginType: string; // ISOLATED/CROSS

  @Column('decimal', { precision: 18, scale: 8 })
  initialMargin: number; // 초기 마진

  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  maintenanceMargin: number; // 유지 마진

  // 포지션 정보
  @Column({ length: 10 })
  @Index('idx_futures_position_side')
  positionSide: string; // LONG/SHORT

  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  liquidationPrice: number; // 청산 가격

  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  markPrice: number; // 마크 가격 (체결 시점)

  // 손익 정보 (포지션 종료 시 업데이트)
  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  pnl: number; // 실현 손익 (USDT)

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  pnlPercent: number; // 손익률 (%)

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  roe: number; // ROE (Return on Equity) %

  // 포지션 종료 정보
  @Column({ length: 20, nullable: true })
  closeType: string; // TP/SL/MANUAL/LIQUIDATION

  @Column({ type: 'timestamp', nullable: true })
  @Index('idx_futures_closed_at')
  closedAt: Date; // 포지션 종료 시간

  @Column({ type: 'bigint', nullable: true })
  closeOrderId: string; // 종료 주문 ID

  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  closePrice: number; // 종료 가격

  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  closeQuantity: number; // 종료 수량

  // 위험 관리 정보
  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  marginRatio: number; // 마진 비율 (%)

  @Column({ type: 'boolean', default: false })
  @Index('idx_futures_liquidated')
  isLiquidated: boolean; // 청산 여부

  @Column({ type: 'boolean', default: false })
  @Index('idx_futures_closed')
  isClosed: boolean; // 포지션 종료 여부

  // 거래 성과 분석용 필드
  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  maxDrawdown: number; // 최대 손실 (포지션 보유 중)

  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  maxProfit: number; // 최대 수익 (포지션 보유 중)

  @Column({ type: 'int', nullable: true })
  holdingDuration: number; // 보유 시간 (초)

  // 시간 정보
  @Column({ type: 'timestamp' })
  @Index('idx_futures_executed_at')
  executedAt: Date; // 체결 시간

  @CreateDateColumn()
  createdAt: Date; // 기록 생성 시간

  @UpdateDateColumn()
  updatedAt: Date; // 기록 수정 시간

  // 추가 정보
  @Column({ length: 100, nullable: true })
  strategyId: string; // 자동매매 전략 ID (있는 경우)

  @Column({ type: 'json', nullable: true })
  metadata: any; // 추가 정보 (바이낸스 원본 응답 등)

  // 헬퍼 메서드들
  getCoin(): string {
    return this.symbol.replace('USDT', '');
  }

  isLong(): boolean {
    return this.positionSide === 'LONG';
  }

  isShort(): boolean {
    return this.positionSide === 'SHORT';
  }

  isProfitable(): boolean {
    return this.pnl !== null && this.pnl > 0;
  }

  isLoss(): boolean {
    return this.pnl !== null && this.pnl < 0;
  }

  // 포지션 종료 처리
  closePosition(closeData: {
    closeType: string;
    closePrice: number;
    closeQuantity: number;
    pnl: number;
    pnlPercent: number;
    roe: number;
    closeOrderId: string;
  }): void {
    this.closeType = closeData.closeType;
    this.closePrice = closeData.closePrice;
    this.closeQuantity = closeData.closeQuantity;
    this.pnl = closeData.pnl;
    this.pnlPercent = closeData.pnlPercent;
    this.roe = closeData.roe;
    this.closeOrderId = closeData.closeOrderId;
    this.closedAt = new Date();
    this.isClosed = true;

    // 보유 시간 계산
    this.holdingDuration = Math.floor(
      (this.closedAt.getTime() - this.executedAt.getTime()) / 1000,
    );
  }
}
