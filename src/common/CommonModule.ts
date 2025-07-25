import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TradingConfigService } from './config/TradingConfig';
import { StopLossTakeProfitCalculator } from './utils/StopLossTakeProfitCalculator';

/**
 * 공통 모듈
 *
 * @description 전체 애플리케이션에서 공통으로 사용되는 서비스들을 제공하는 글로벌 모듈입니다.
 * 손절/익절 관련 기능들과 거래 설정 관리 기능을 포함합니다.
 */
@Global()
@Module({
  imports: [ConfigModule],
  controllers: [],
  providers: [
    /**
     * 거래 설정 서비스
     *
     * @description 환경변수에서 손절/익절 기본값을 읽어오는 서비스입니다.
     * 자동매매/전략에서만 사용되며, 수동 거래에서는 사용하지 않습니다.
     */
    TradingConfigService,

    /**
     * 손절/익절 계산기
     *
     * @description 퍼센트나 절대가격 설정을 바탕으로 실제 손절/익절 가격을 계산하는 서비스입니다.
     * 현물과 선물 거래 모두에서 사용할 수 있습니다.
     */
    StopLossTakeProfitCalculator,
  ],
  exports: [
    /**
     * 다른 모듈에서 사용할 수 있도록 export
     *
     * - TradingConfigService: 자동매매/전략 모듈에서 기본값 조회용
     * - StopLossTakeProfitCalculator: order/futures 모듈에서 가격 계산용
     */
    TradingConfigService,
    StopLossTakeProfitCalculator,
  ],
})
export class CommonModule {}
