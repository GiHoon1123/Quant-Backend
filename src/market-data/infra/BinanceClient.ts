// src/modules/market-data/infra/binance.client.ts
import * as WebSocket from 'ws';
import { ExternalBinanceTradeResponse } from '../dto/ExternalBinanceTradeResponse';

export class BinanceClient {
  private socket!: WebSocket;

  constructor(
    private symbol: string,
    private onMessage: (data: any) => void,
  ) {}

  connect() {
    const streamUrl = `wss://stream.binance.com:9443/ws/${this.symbol.toLowerCase()}@trade`;

    this.socket = new WebSocket(streamUrl) as WebSocket;

    // 콜백은 "이벤트가 발생할 때마다 계속 실행"되지만, await은 "단 한 번만 발생하는 비동기 작업을 기다릴 때" 사용한다.
    // 따라서 콜백을 사용하여 이벤트를 처리하는 것이 더 적합합니다.
    this.socket.on('open', () =>
      console.log(`✅ Connected to Binance: ${this.symbol}`),
    );
    // 외부 응답은 dto 객체로 변환하여 onMessage 콜백으로 전달
    this.socket.on('message', (data) => {
      const raw = JSON.parse(data.toString());
      const dto = ExternalBinanceTradeResponse.from(raw);
      this.onMessage(dto);
    });
    this.socket.on('error', (err) =>
      console.error('❌ Binance socket error', err),
    );
    this.socket.on('close', () => console.log(`🔌 Binance socket closed`));
  }

  close() {
    this.socket?.close();
  }
}
