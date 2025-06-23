import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { KlineService } from 'src/market-data/service/kline/KlineService';
@Injectable()
export class KlineScheduler {
  constructor(private readonly klineService: KlineService) {}

  //   @Cron('*/2 * * * *')
  @Cron('*/1 * * * *')
  async poll3m() {
    await this.poll('3m');
  }

  //   @Cron('*/4 * * * *')
  @Cron('*/1 * * * *')
  async poll5m() {
    await this.poll('5m');
  }

  //   @Cron('*/14 * * * *')
  @Cron('*/1 * * * *')
  async poll15m() {
    await this.poll('15m');
  }

  //   @Cron('*/29 * * * *')
  @Cron('*/1 * * * *')
  async poll30m() {
    await this.poll('30m');
  }

  //   @Cron('0,30 * * * *')
  @Cron('*/1 * * * *')
  async pollLongIntervals() {
    const intervals = [
      '1h',
      '2h',
      '4h',
      '6h',
      '8h',
      '12h',
      '1d',
      '3d',
      '1w',
      '1M',
    ];
    for (const interval of intervals) {
      await this.poll(interval);
    }
  }

  private async poll(interval: string) {
    const symbols = this.klineService.getSubscribed();
    for (const symbol of symbols) {
      await this.klineService.fetchCandles(symbol, interval);
    }
  }
}
