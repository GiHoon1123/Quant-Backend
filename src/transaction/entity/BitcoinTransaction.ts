import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 비트코인 온체인 트랜잭션 엔티티
 *
 * 비트코인 네트워크에서 발생한 트랜잭션을 파싱하여 저장합니다.
 * 바이낸스 거래와 연관된 온체인 움직임을 추적할 수 있습니다.
 */

export enum TransactionPurpose {
  EXCHANGE_DEPOSIT = 'exchange_deposit', // 거래소 입금
  EXCHANGE_WITHDRAW = 'exchange_withdraw', // 거래소 출금
  WALLET_TRANSFER = 'wallet_transfer', // 지갑간 이동
  PAYMENT = 'payment', // 결제
  CONSOLIDATION = 'consolidation', // UTXO 정리
  DCA_PURCHASE = 'dca_purchase', // 정기 구매
  UNKNOWN = 'unknown', // 알 수 없음
}

@Entity('bitcoin_transactions')
@Index(['txid'])
@Index(['blockHeight'])
@Index(['purpose', 'timestamp'])
@Index(['relatedSpotTradeId'])
@Index(['relatedFuturesTradeId'])
export class BitcoinTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 비트코인 트랜잭션 기본 정보
  @Column({ length: 64, unique: true })
  @Index()
  txid: string; // 트랜잭션 해시

  @Column({ type: 'int', nullable: true })
  @Index()
  blockHeight: number; // 블록 높이

  @Column({ length: 64, nullable: true })
  blockHash: string; // 블록 해시

  @Column({ type: 'int', default: 0 })
  confirmations: number; // 컨펌 수

  @Column({ type: 'timestamp' })
  @Index()
  timestamp: Date; // 트랜잭션 시간

  // 트랜잭션 크기 및 수수료 정보
  @Column({ type: 'int' })
  size: number; // 트랜잭션 크기 (bytes)

  @Column({ type: 'int' })
  vsize: number; // Virtual size

  @Column({ type: 'int' })
  weight: number; // 트랜잭션 weight

  @Column('decimal', { precision: 18, scale: 8 })
  fee: number; // 수수료 (BTC)

  @Column('decimal', { precision: 10, scale: 2 })
  feeRate: number; // 수수료율 (sat/vB)

  // 파싱된 정보
  @Column({
    type: 'enum',
    enum: TransactionPurpose,
    default: TransactionPurpose.UNKNOWN,
  })
  @Index()
  purpose: TransactionPurpose; // 트랜잭션 목적

  @Column('decimal', { precision: 18, scale: 8 })
  netAmount: number; // 순 이동량 (BTC)

  @Column({ type: 'boolean', default: false })
  isIncoming: boolean; // 입금 여부

  @Column({ type: 'boolean', default: false })
  isOutgoing: boolean; // 출금 여부

  // 연관 거래 정보
  @Column({ type: 'uuid', nullable: true })
  @Index()
  relatedSpotTradeId: string; // 연관된 현물 거래 ID

  @Column({ type: 'uuid', nullable: true })
  @Index()
  relatedFuturesTradeId: string; // 연관된 선물 거래 ID

  @Column({ length: 50, nullable: true })
  relatedExchange: string; // 연관된 거래소 (binance, coinbase 등)

  // 분석 결과
  @Column('decimal', { precision: 5, scale: 4, default: 0 })
  confidence: number; // 분석 신뢰도 (0~1)

  @Column({ type: 'json', nullable: true })
  tags: string[]; // 태그들 (dca, consolidation, mixing 등)

  // 주소 정보
  @Column({ type: 'json' })
  inputAddresses: string[]; // 입력 주소들

  @Column({ type: 'json' })
  outputAddresses: string[]; // 출력 주소들

  @Column({ length: 100, nullable: true })
  primaryInputAddress: string; // 주요 입력 주소

  @Column({ length: 100, nullable: true })
  primaryOutputAddress: string; // 주요 출력 주소

  // 원본 데이터 (UTXO 정보)
  @Column({ type: 'json' })
  inputs: any[]; // 입력 UTXO들

  @Column({ type: 'json' })
  outputs: any[]; // 출력 UTXO들

  @Column({ type: 'json', nullable: true })
  rawData: any; // 전체 원본 데이터

  // 파싱 정보
  @Column({ type: 'boolean', default: false })
  @Index()
  isParsed: boolean; // 파싱 완료 여부

  @Column({ type: 'timestamp', nullable: true })
  parsedAt: Date; // 파싱 완료 시간

  @Column({ length: 50, nullable: true })
  parsedBy: string; // 파싱 규칙 버전

  // 시간 정보
  @CreateDateColumn()
  createdAt: Date; // 기록 생성 시간

  @UpdateDateColumn()
  updatedAt: Date; // 기록 수정 시간

  // 헬퍼 메서드들
  isConfirmed(): boolean {
    return this.confirmations >= 6; // 6컨펌 이상을 확정으로 간주
  }

  isPending(): boolean {
    return this.confirmations < 6;
  }

  isHighFee(): boolean {
    return this.feeRate > 50; // 50 sat/vB 이상을 고수수료로 간주
  }

  isLowFee(): boolean {
    return this.feeRate < 10; // 10 sat/vB 이하를 저수수료로 간주
  }

  // 거래소 관련 여부 확인
  isExchangeRelated(): boolean {
    return this.relatedExchange !== null;
  }

  // 바이낸스 관련 여부 확인
  isBinanceRelated(): boolean {
    return this.relatedExchange === 'binance';
  }

  // 거래 내역과 연결 여부 확인
  hasRelatedTrade(): boolean {
    return (
      this.relatedSpotTradeId !== null || this.relatedFuturesTradeId !== null
    );
  }

  // 트랜잭션 패턴 분석
  getTransactionPattern(): string {
    const inputCount = this.inputs.length;
    const outputCount = this.outputs.length;

    if (inputCount === 1 && outputCount === 2) {
      return 'simple_send'; // 일반적인 송금 (송금 + 잔돈)
    } else if (inputCount > 5 && outputCount === 1) {
      return 'consolidation'; // UTXO 통합
    } else if (inputCount === 1 && outputCount > 5) {
      return 'distribution'; // 분산 송금
    } else if (inputCount > 2 && outputCount > 2) {
      return 'complex'; // 복잡한 패턴 (믹싱 등)
    }

    return 'unknown';
  }

  // 파싱 완료 처리
  markAsParsed(parsedBy: string): void {
    this.isParsed = true;
    this.parsedAt = new Date();
    this.parsedBy = parsedBy;
  }

  // 거래 내역과 연결
  linkToSpotTrade(spotTradeId: string): void {
    this.relatedSpotTradeId = spotTradeId;
  }

  linkToFuturesTrade(futuresTradeId: string): void {
    this.relatedFuturesTradeId = futuresTradeId;
  }
}
