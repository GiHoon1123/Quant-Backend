import { Module } from '@nestjs/common';
import { MarketDataModule } from '../market-data/MarketDataModule';
import { NotificationModule } from '../notification/NotificationModule';
import { TechnicalAnalysisModule } from '../technical-analysis/TechnicalAnalysisModule';
import { TestService } from './service/TestService';
import { IntegratedTestController } from './web/IntegratedTestController';
import { TestController } from './web/TestController';

/**
 * 🧪 테스트 모듈
 *
 * 🎯 **목적**: 이벤트 기반 아키텍처 통합 테스트
 * - 전체 도메인 간 이벤트 체인 검증
 * - 개별 기능 단위 테스트
 * - 성능 측정 및 모니터링
 * - 시스템 상태 확인
 *
 * 📡 **테스트 범위**:
 * - Market-data: 캔들 생성 및 저장
 * - Technical-analysis: 기술적 분석 실행
 * - Notification: 알림 발송
 * - Event-chain: 전체 플로우 검증
 */
@Module({
  imports: [MarketDataModule, TechnicalAnalysisModule, NotificationModule],
  controllers: [
    TestController, // 기존 레거시 테스트
    IntegratedTestController, // 통합 테스트 (손절/익절 등)
  ],
  providers: [TestService],
  exports: [TestService],
})
export class TestModule {}
