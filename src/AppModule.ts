import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BinanceModule } from './common/binance/BinanceModule';
import { CommonModule } from './common/CommonModule';
import { typeOrmConfig } from './common/config/DatabaseConfig';
import { FuturesModule } from './futures/FuturesModule';
import { MarketDataModule } from './market-data/MarketDataModule';
import { NotificationModule } from './notification/NotificationModule';
import { OrderModule } from './order/OrderModule';
import { TechnicalAnalysisModule } from './technical-analysis/TechnicalAnalysisModule';
import { TestModule } from './test/TestModule'; // 🧪 테스트 모듈 추가
import { TransactionModule } from './transaction/TransactionModule';

// 이벤트 연결을 위한 서비스 import
import { Candle15MService } from './market-data/service/candle/Candle15MService';
import { NotificationService } from './notification/service/NotificationService';
import { TechnicalAnalysisEventService } from './technical-analysis/service/TechnicalAnalysisEventService';

/**
 * 🚀 메인 애플리케이션 모듈
 *
 * 🔄 **이벤트 기반 아키텍처 구현**:
 *
 * 1️⃣ **Market-data 도메인**
 *    - 웹소켓 데이터 수신 → DB 저장 → 📡 candle.saved 이벤트 발송
 *
 * 2️⃣ **Technical-analysis 도메인**
 *    - 🎧 candle.saved 이벤트 수신 → 기술적 분석 실행 → 📡 analysis.completed 이벤트 발송
 *
 * 3️⃣ **Notification 도메인**
 *    - 🎧 analysis.completed 이벤트 수신 → 알림 발송 (텔레그램/웹소켓/카카오톡)
 *
 * 📡 **이벤트 체인**:
 * 웹소켓 → DB저장 → candle.saved → 기술적분석 → analysis.completed → 알림발송
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV}`, // NODE_ENV 기반 env 파일 우선
        '.env', // 공통 설정 (fallback)
      ],
    }),
    EventEmitterModule.forRoot(), // 글로벌 EventEmitter 모듈 등록
    TypeOrmModule.forRoot(typeOrmConfig),
    ScheduleModule.forRoot(),

    // 🏗️ 도메인 모듈들
    CommonModule, // 공통 유틸리티 모듈 (글로벌)
    BinanceModule, // 바이낸스 공통 모듈 (글로벌)
    MarketDataModule, // 📊 데이터 수집/저장
    TechnicalAnalysisModule, // 🔍 기술적 분석
    NotificationModule, // 📢 알림 발송
    TestModule, // 🧪 테스트 모듈
    OrderModule,
    FuturesModule,
    TransactionModule, // 💰 거래 내역 관리
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class AppModule implements OnModuleInit {
  constructor(
    // 🔗 이벤트 연결을 위한 서비스 주입
    private readonly candle15MService: Candle15MService,
    private readonly technicalAnalysisEventService: TechnicalAnalysisEventService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * 🔗 모듈 초기화 시 이벤트 체인 연결
   *
   * 각 도메인의 EventEmitter를 연결하여 이벤트 기반 플로우를 구성합니다.
   */
  async onModuleInit(): Promise<void> {
    console.log('🚀 [AppModule] 이벤트 기반 아키텍처 초기화 시작');

    try {
      // 📡 1단계: Market-data → Technical-analysis 연결
      const marketDataEventEmitter = this.candle15MService.getEventEmitter();
      this.technicalAnalysisEventService.connectToMarketDataEvents(
        marketDataEventEmitter,
      );

      // 📡 2단계: Technical-analysis → Notification 연결
      const technicalAnalysisEventEmitter =
        this.technicalAnalysisEventService.getEventEmitter();
      this.notificationService.connectToTechnicalAnalysisEvents(
        technicalAnalysisEventEmitter,
      );

      console.log('✅ [AppModule] 이벤트 체인 연결 완료');
      console.log(
        '🔄 [Event Flow] 웹소켓 → DB저장 → candle.saved → 기술적분석 → analysis.completed → 알림발송',
      );
    } catch (error) {
      console.error('❌ [AppModule] 이벤트 체인 연결 실패:', error);
      throw error;
    }
  }
}
