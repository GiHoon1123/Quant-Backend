import * as WebSocket from 'ws';
import { ExternalTradeResponse } from '../../dto/trade/ExternalTradeResponse';

export class BinanceTradeStream {
  private socket!: WebSocket;

  constructor(
    private symbol: string,
    private onMessage: (data: ExternalTradeResponse) => void,
  ) {}

  connect() {
    const streamUrl = `wss://stream.binance.com:9443/ws/${this.symbol.toLowerCase()}@trade`;
    this.socket = new WebSocket(streamUrl);

    this.socket.on('open', () => {
      console.log(`✅ [TRADE] Connected: ${this.symbol}`);
    });

    this.socket.on('message', (data) => {
      const raw = JSON.parse(data.toString());
      const dto = ExternalTradeResponse.from(raw);
      this.onMessage(dto);
    });

    this.socket.on('error', (err) => {
      console.error(`❌ [TRADE] Error [${this.symbol}]`, err);
    });

    this.socket.on('close', () => {
      console.log(`🔌 [TRADE] Disconnected: ${this.symbol}`);
    });
  }

  close() {
    this.socket?.close();
  }

  getSymbol() {
    return this.symbol;
  }
}
