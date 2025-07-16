import { Module } from '@nestjs/common';
import { BinanceFuturesClient } from './infra/BinanceFuturesClient';
import { BinanceFuturesPositionClient } from './infra/BinanceFuturesPositionClient';
import { FuturesService } from './service/FuturesService';
import { FuturesController } from './web/FuturesController';

/**
 * 선물거래 모듈
 *
 * 바이낸스 선물거래 API를 통해 다음 기능들을 제공합니다:
 * - 롱/숏 포지션 진입 및 청산
 * - 레버리지 설정 및 조회
 * - 포지션 정보 조회
 * - 마진 모드 설정 (격리마진/교차마진)
 * - 선물 잔고 조회
 * - 선물 주문 취소
 */
@Module({
  imports: [],
  controllers: [FuturesController],
  providers: [
    FuturesService,
    BinanceFuturesClient,
    BinanceFuturesPositionClient,
  ],
  exports: [FuturesService],
})
export class FuturesModule {}
