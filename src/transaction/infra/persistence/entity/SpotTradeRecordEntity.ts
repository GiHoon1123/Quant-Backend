import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 현물 거래 내역 엔티티
 *
 * 바이낸스 현물 거래의 모든 정보를 저장합니다.
 * 실제 자산을 매매하는 안전한 거래 방식의 기록입니다.
 */
@Entity('spot_trade_records')
@Index('idx_spot_symbol_executed', ['symbol', 'executedAt'])
@Index('idx_spot_source_executed', ['source', 'executedAt'])
@Index('idx_spot_orderid', ['orderId'])
export class SpotTradeRecord {
  @PrimaryGeneratedColumn()
  id: number;

  // 계정 정보 (어떤 계정의 거래인지)
  @Column({ length: 100, nullable: true })
  @Index('idx_spot_account')
  accountId: string | null; // 계정 식별자 (API KEY 기반 또는 사용자 ID)

  @Column({ length: 100, nullable: true })
  userId: string | null; // 사용자 ID (있는 경우)

  // 거래 기본 정보
  @Column({ length: 20 })
  @Index('idx_spot_symbol')
  symbol: string; // 거래 심볼 (BTCUSDT 등)

  @Column({ type: 'bigint' })
  @Index('idx_spot_order_id')
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
  totalAmount: number; // 총 거래 금액 (quantity * price)

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
  @Index('idx_spot_source')
  source: string; // API/AUTO/MANUAL

  // 시간 정보
  @Column({ type: 'timestamp' })
  @Index('idx_spot_executed_at')
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

  // 계산된 필드
  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  netAmount: number; // 수수료 제외 실제 거래 금액

  // 코인 추출 헬퍼 메서드
  getCoin(): string {
    return this.symbol.replace('USDT', '');
  }

  // 거래 방향 확인 헬퍼 메서드
  isBuy(): boolean {
    return this.side === 'BUY';
  }

  isSell(): boolean {
    return this.side === 'SELL';
  }
}
