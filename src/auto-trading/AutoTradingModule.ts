import { Module } from '@nestjs/common';
import { CommonModule } from '../common/CommonModule';
import { FuturesModule } from '../futures/FuturesModule';
import { TechnicalAnalysisModule } from '../technical-analysis/TechnicalAnalysisModule';
import { AutoTradingService } from './service/AutoTradingService';
import { AutoTradingController } from './web/AutoTradingController';

/**
 * 자동 매매 도메인 모듈
 *
 * 기술적 분석 결과를 받아서 자동으로 매매 신호를 생성하고 포지션을 관리하는 도메인입니다.
 *
 * 🔄 의존성:
 * - TechnicalAnalysisModule: 기술적 분석 결과 수신
 * - FuturesModule: 실제 거래 실행
 *
 * 📊 주요 기능:
 * - 매매 신호 해석 및 판단
 * - 포지션 진입/청산 결정
 * - 리스크 관리
 * - 거래 실행
 */
@Module({
  imports: [TechnicalAnalysisModule, FuturesModule, CommonModule],
  controllers: [AutoTradingController],
  providers: [AutoTradingService],
  exports: [AutoTradingService],
})
export class AutoTradingModule {}
