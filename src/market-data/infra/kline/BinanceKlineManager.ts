import { ExternalKlineResponse } from '../../dto/kline/ExternalKlineResponse';
import { BinanceKlineStream } from './BinanceKlineStream';

export class BinanceKlineManager {
  private streams = new Map<string, BinanceKlineStream>();

  constructor(
    private readonly onMessage: (data: ExternalKlineResponse) => void,
  ) {}

  subscribe(symbol: string) {
    if (this.streams.has(symbol)) return;

    const stream = new BinanceKlineStream(symbol, this.onMessage);
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

  getSubscribed(): string[] {
    return Array.from(this.streams.keys());
  }
}
