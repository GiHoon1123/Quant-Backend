import { Module, Global } from '@nestjs/common';
import { BinanceRestClient } from './BinanceRestClient';
import { BinanceWebSocketClient } from './BinanceWebSocketClient';

/**
 * 바이낸스 공통 모듈
 *
 * 바이낸스 API 클라이언트들을 제공하는 글로벌 모듈입니다.
 * 모든 도메인(현물, 선물, 기술적 분석 등)에서 공통으로 사용할 수 있습니다.
 *
 * 🎯 제공 서비스:
 * - BinanceRestClient: REST API 클라이언트
 * - BinanceWebSocketClient: 웹소켓 스트림 클라이언트
 *
 * 🚀 사용법:
 * ```typescript
 * // 다른 모듈에서 사용
 * constructor(
 *   private readonly binanceRestClient: BinanceRestClient,
 *   private readonly binanceWsClient: BinanceWebSocketClient,
 * ) {}
 * ```
 *
 * 💡 글로벌 모듈로 설정되어 있어 별도로 import 할 필요가 없습니다.
 */
@Global()
@Module({
  providers: [BinanceRestClient, BinanceWebSocketClient],
  exports: [BinanceRestClient, BinanceWebSocketClient],
})
export class BinanceModule {}
