// src/modules/market-data/infra/BinanceTradeStream.ts
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
      console.log(`✅ Connected: ${this.symbol}`);
    });

    this.socket.on('message', (data) => {
      const raw = JSON.parse(data.toString());
      const dto = ExternalTradeResponse.from(raw);
      this.onMessage(dto);
    });

    this.socket.on('error', (err) => {
      console.error(`❌ Error [${this.symbol}]`, err);
    });

    this.socket.on('close', () => {
      console.log(`🔌 Disconnected: ${this.symbol}`);
    });
  }

  close() {
    this.socket?.close();
  }

  getSymbol() {
    return this.symbol;
  }
}
