import { ExternalCandleResponse } from '../../dto/candle/ExternalCandleResponse';
import { BinanceCandle15MStream } from './BinanceCandle15MStream';

/**
 * 바이낸스 15분봉 스트림 매니저
 *
 * 여러 심볼의 15분봉 웹소켓 스트림을 중앙 관리합니다.
 * 각 심볼별로 개별 웹소켓 연결을 생성하고 관리하며,
 * 데이터 수신 시 콜백 함수를 통해 처리합니다.
 */
export class BinanceCandle15MManager {
  private streams = new Map<string, BinanceCandle15MStream>();

  constructor(
    private readonly onMessage: (data: ExternalCandleResponse) => void,
  ) {}

  /**
   * 특정 심볼의 15분봉 스트림 구독
   *
   * @param symbol 구독할 심볼 (예: "BTCUSDT")
   */
  subscribe(symbol: string): void {
    if (this.streams.has(symbol)) {
      console.log(`[BinanceCandle15MManager] 이미 구독 중인 심볼: ${symbol}`);
      return;
    }

    console.log(`[BinanceCandle15MManager] 15분봉 스트림 구독 시작: ${symbol}`);

    const stream = new BinanceCandle15MStream(symbol, this.onMessage);
    stream.connect();
    this.streams.set(symbol, stream);
  }

  /**
   * 특정 심볼의 15분봉 스트림 구독 해제
   *
   * @param symbol 구독 해제할 심볼
   */
  unsubscribe(symbol: string): void {
    const stream = this.streams.get(symbol);
    if (stream) {
      console.log(
        `[BinanceCandle15MManager] 15분봉 스트림 구독 해제: ${symbol}`,
      );
      stream.close();
      this.streams.delete(symbol);
    } else {
      console.log(`[BinanceCandle15MManager] 구독 중이지 않은 심볼: ${symbol}`);
    }
  }

  /**
   * 모든 스트림 구독 해제
   */
  unsubscribeAll(): void {
    console.log(`[BinanceCandle15MManager] 모든 15분봉 스트림 구독 해제`);

    for (const [symbol, stream] of this.streams) {
      stream.close();
    }

    this.streams.clear();
  }

  /**
   * 현재 구독 중인 심볼 목록 반환
   *
   * @returns 구독 중인 심볼 배열
   */
  getSubscribed(): string[] {
    return Array.from(this.streams.keys());
  }

  /**
   * 특정 심볼의 연결 상태 확인
   *
   * @param symbol 확인할 심볼
   * @returns 연결 상태
   */
  isConnected(symbol: string): boolean {
    const stream = this.streams.get(symbol);
    return stream ? stream.isConnected() : false;
  }

  /**
   * 모든 스트림의 연결 상태 확인
   *
   * @returns 각 심볼의 연결 상태 맵
   */
  getConnectionStatus(): Map<string, boolean> {
    const status = new Map<string, boolean>();

    for (const [symbol, stream] of this.streams) {
      status.set(symbol, stream.isConnected());
    }

    return status;
  }

  /**
   * 스트림 통계 정보 반환
   *
   * @returns 스트림 통계
   */
  getStats(): {
    totalStreams: number;
    connectedStreams: number;
    subscribedSymbols: string[];
    connectionStatus: Map<string, boolean>;
  } {
    const connectionStatus = this.getConnectionStatus();
    const connectedCount = Array.from(connectionStatus.values()).filter(
      (connected) => connected,
    ).length;

    return {
      totalStreams: this.streams.size,
      connectedStreams: connectedCount,
      subscribedSymbols: this.getSubscribed(),
      connectionStatus,
    };
  }
}
