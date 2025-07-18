import * as WebSocket from 'ws';
import { ExternalCandleResponse } from '../../dto/candle/ExternalCandleResponse';

/**
 * 바이낸스 15분봉 웹소켓 스트림 클래스
 *
 * 바이낸스 선물 거래소에서 15분봉 데이터를 실시간으로 수신하는 웹소켓 연결을 관리합니다.
 * 각 심볼마다 개별 스트림을 생성하여 데이터를 수신하고 콜백 함수를 통해 전달합니다.
 */
export class BinanceCandle15MStream {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 5000; // 5초
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;

  constructor(
    private readonly symbol: string,
    private readonly onMessage: (data: ExternalCandleResponse) => void,
  ) {}

  /**
   * 웹소켓 연결 시작
   *
   * 바이낸스 선물 웹소켓 API에 연결하여 15분봉 데이터 스트림을 구독합니다.
   * 연결 실패 시 자동으로 재연결을 시도합니다.
   */
  connect(): void {
    if (
      this.isConnecting ||
      (this.ws && this.ws.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    this.isConnecting = true;

    // 바이낸스 선물 웹소켓 URL (15분봉)
    const streamName = `${this.symbol.toLowerCase()}@kline_15m`;
    const wsUrl = `wss://fstream.binance.com/ws/${streamName}`;

    console.log(
      `[BinanceCandle15MStream] 연결 시도 중: ${this.symbol} (${streamName})`,
    );

    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log(`[BinanceCandle15MStream] 연결 성공: ${this.symbol}`);
      this.reconnectAttempts = 0;
      this.isConnecting = false;

      // 재연결 타이머 취소
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        // 바이낸스 Kline 데이터 구조 확인
        if (message.e === 'kline' && message.k) {
          // ExternalCandleResponse 형태로 변환
          const externalResponse = ExternalCandleResponse.from(message);
          this.onMessage(externalResponse);
        }
      } catch (error) {
        console.error(
          `[BinanceCandle15MStream] 메시지 파싱 오류 (${this.symbol}):`,
          error,
        );
      }
    });

    this.ws.on('error', (error) => {
      console.error(
        `[BinanceCandle15MStream] 연결 오류 (${this.symbol}):`,
        error,
      );
      this.isConnecting = false;
      this.handleReconnect();
    });

    this.ws.on('close', (code, reason) => {
      console.log(
        `[BinanceCandle15MStream] 연결 종료 (${this.symbol}): ${code} - ${reason}`,
      );
      this.isConnecting = false;

      // 정상 종료가 아닌 경우 재연결 시도
      if (code !== 1000) {
        this.handleReconnect();
      }
    });
  }

  /**
   * 재연결 처리
   *
   * 연결이 끊어진 경우 지수 백오프 방식으로 재연결을 시도합니다.
   * 최대 재연결 횟수에 도달하면 재연결을 중단합니다.
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        `[BinanceCandle15MStream] 최대 재연결 시도 횟수 초과 (${this.symbol})`,
      );
      return;
    }

    if (this.reconnectTimer) {
      return; // 이미 재연결 스케줄링됨
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      60000,
    );

    console.log(
      `[BinanceCandle15MStream] ${delay}ms 후 재연결 시도 (${this.reconnectAttempts}/${this.maxReconnectAttempts}) - ${this.symbol}`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /**
   * 웹소켓 연결 종료
   *
   * 웹소켓 연결을 안전하게 종료하고 재연결 타이머를 정리합니다.
   */
  close(): void {
    console.log(`[BinanceCandle15MStream] 연결 종료 요청: ${this.symbol}`);

    // 재연결 타이머 취소
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // 웹소켓 연결 종료
    if (this.ws) {
      this.ws.close(1000, 'Manual close');
      this.ws = null;
    }

    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  /**
   * 연결 상태 확인
   *
   * @returns 웹소켓이 연결되어 있는지 여부
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 심볼 반환
   *
   * @returns 현재 구독 중인 심볼
   */
  getSymbol(): string {
    return this.symbol;
  }
}
