import { ExternalTradeResponse } from '../../dto/trade/ExternalTradeResponse';
import { BinanceTradeStream } from './BinanceTradeStream';

export class BinanceTradeManager {
  private streams: Map<string, BinanceTradeStream> = new Map();

  constructor(private onMessage: (data: ExternalTradeResponse) => void) {}

  subscribe(symbol: string) {
    if (this.streams.has(symbol)) return;

    const stream = new BinanceTradeStream(symbol, this.onMessage);
    stream.connect();
    this.streams.set(symbol, stream);
  }

  unsubscribe(symbol: string) {
    const stream = this.streams.get(symbol);
    if (stream) {
      stream.close();
      this.streams.delete(symbol);
    }
  }

  unsubscribeAll() {
    for (const stream of this.streams.values()) {
      stream.close();
    }
    this.streams.clear();
  }

  getSubscribedSymbols(): string[] {
    return Array.from(this.streams.keys());
  }
}
