import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { BitcoinTransaction } from './infra/persistence/entity/BitcoinTransaction';
import { FuturesTradeRecord } from './infra/persistence/entity/FuturesTradeRecord';
import { SpotTradeRecord } from './infra/persistence/entity/SpotTradeRecord';

// Repositories
import { BitcoinTransactionRepository } from './infra/persistence/repository/BitcoinTransactionRepository';
import { FuturesTradeRecordRepository } from './infra/persistence/repository/FuturesTradeRecordRepository';
import { SpotTradeRecordRepository } from './infra/persistence/repository/SpotTradeRecordRepository';

// Services
import { TransactionService } from './service/TransactionService';

/**
 * 거래 내역 및 트랜잭션 관리 모듈
 *
 * 이 모듈은 다음 기능들을 제공합니다:
 *
 * 📊 거래 내역 관리:
 * - 현물 거래 내역 저장 및 조회
 * - 선물 거래 내역 저장 및 조회
 * - 포지션 종료 정보 업데이트
 *
 * 🔗 온체인 트랜잭션 관리:
 * - 비트코인 트랜잭션 파싱 및 저장
 * - 거래 내역과 온체인 트랜잭션 연결
 * - 트랜잭션 목적 분석 및 분류
 *
 * 🎯 이벤트 기반 아키텍처:
 * - 거래 실행 이벤트 수신 및 처리
 * - 포지션 종료 이벤트 수신 및 처리
 * - 비동기 트랜잭션 파싱 트리거
 *
 * 📈 통계 및 분석:
 * - 거래 성과 통계
 * - 포트폴리오 분석
 * - 위험 관리 지표
 */
@Module({
  imports: [
    // TypeORM 엔티티 등록
    TypeOrmModule.forFeature([
      SpotTradeRecord,
      FuturesTradeRecord,
      BitcoinTransaction,
    ]),

    // 이벤트 시스템 (이미 AppModule에서 설정되어 있다면 생략 가능)
    EventEmitterModule.forRoot(),
  ],

  providers: [
    // 저장소들
    SpotTradeRecordRepository,
    FuturesTradeRecordRepository,
    BitcoinTransactionRepository,

    // 서비스들
    TransactionService,

    // TODO: 나중에 추가할 서비스들
    // BitcoinTransactionCollectorService,
    // BitcoinTransactionParserService,
    // TransactionAnalysisService,
  ],

  exports: [
    // 다른 모듈에서 사용할 수 있도록 export
    TransactionService,
    SpotTradeRecordRepository,
    FuturesTradeRecordRepository,
    BitcoinTransactionRepository,
  ],
})
export class TransactionModule {
  constructor() {
    console.log('🏗️  TransactionModule 초기화 완료');
    console.log('📊 거래 내역 관리 시스템이 준비되었습니다');
    console.log('🎯 이벤트 리스너가 활성화되었습니다');
  }
}
