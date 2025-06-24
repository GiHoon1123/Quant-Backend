import * as WebSocket from 'ws';
import { ExternalKlineResponse } from '../../dto/kline/ExternalKlineResponse';

export class BinanceKlineStream {
  private socket!: WebSocket;

  constructor(
    private symbol: string,
    private onMessage: (data: ExternalKlineResponse) => void,
  ) {}

  connect() {
    const streamUrl = `wss://stream.binance.com:9443/ws/${this.symbol.toLowerCase()}@kline_1m`;
    this.socket = new WebSocket(streamUrl);

    this.socket.on('open', () => {
      console.log(`✅ [KLINE] Connected: ${this.symbol} `);
    });

    this.socket.on('message', (data) => {
      const raw = JSON.parse(data.toString());
      const dto = ExternalKlineResponse.from(raw);
      this.onMessage(dto);
    });

    this.socket.on('error', (err) => {
      console.error(`❌ [KLINE] Error [${this.symbol}]:`, err);
    });

    this.socket.on('close', () => {
      console.log(`🔌 [KLINE] Disconnected: ${this.symbol}`);
    });
  }

  close() {
    this.socket?.close();
  }

  getKey() {
    return `${this.symbol}`;
  }
}
