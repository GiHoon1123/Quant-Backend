import { BadRequestException, Injectable } from '@nestjs/common';
import { BalanceResponse } from '../dto/BalanceResponse';
import { ExternalBalanceResponse } from '../dto/ExternalBalanceResponse';
import { ExternalPriceResponse } from '../dto/ExternalPriceResponse';
import { BinanceOrderClient } from '../infra/BinanceOrderClient';
import { BinancePriceClient } from '../infra/BinancePriceClient';

@Injectable()
export class OrderService {
  constructor(
    private readonly orderClient: BinanceOrderClient,
    private readonly priceClient: BinancePriceClient,
  ) {}

  // ------------------- ✅ 시장가 매수 -------------------
  async placeMarketBuyOrder(symbol: string, quantity: number): Promise<any> {
    this.assertPositive(quantity, '수량은 0보다 커야 합니다.');

    const rawPrice = await this.priceClient.fetchPrice(symbol);
    const price = ExternalPriceResponse.from(rawPrice);
    const notional = price.price * quantity;

    if (notional < 10) {
      throw new BadRequestException(
        `${symbol} ${quantity}개는 최소 주문 금액 10 USDT를 만족하지 않습니다. (현재 ${notional.toFixed(2)} USDT)`,
      );
    }

    const rawBalances = await this.orderClient.fetchBalances();
    const balances = ExternalBalanceResponse.fromList(rawBalances);
    const usdtBalance = balances.find((b) => b.asset === 'USDT')?.free || 0;

    if (notional > usdtBalance) {
      throw new BadRequestException(
        `현재 USDT 잔고(${usdtBalance.toFixed(2)})보다 큰 금액(${notional.toFixed(2)})을 매수할 수 없습니다.`,
      );
    }

    return this.orderClient.placeMarketOrder(symbol, 'BUY', quantity);
  }

  // ------------------- ✅ 시장가 매도 -------------------
  async placeMarketSellOrder(symbol: string, quantity: number): Promise<any> {
    this.assertPositive(quantity, '수량은 0보다 커야 합니다.');

    const coin = symbol.replace('USDT', '');
    const rawBalances = await this.orderClient.fetchBalances();
    const balances = ExternalBalanceResponse.fromList(rawBalances);
    const coinBalance = balances.find((b) => b.asset === coin)?.free || 0;

    if (quantity > coinBalance) {
      throw new BadRequestException(
        `${symbol} ${quantity}개는 보유 수량 ${coinBalance}개를 초과하여 매도할 수 없습니다.`,
      );
    }

    return this.orderClient.placeMarketOrder(symbol, 'SELL', quantity);
  }

  // ------------------- ✅ 지정가 매수 -------------------
  async placeLimitBuyOrder(
    symbol: string,
    quantity: number,
    price: number,
  ): Promise<any> {
    this.assertPositive(quantity, '수량은 0보다 커야 합니다.');
    this.assertPositive(price, '지정가는 0보다 커야 합니다.');

    const notional = price * quantity;
    if (notional < 10) {
      throw new BadRequestException(
        `${symbol} 지정가 주문은 최소 주문 금액 10 USDT를 만족해야 합니다. (현재 ${notional.toFixed(2)} USDT)`,
      );
    }

    const rawBalances = await this.orderClient.fetchBalances();
    const balances = ExternalBalanceResponse.fromList(rawBalances);
    const usdtBalance = balances.find((b) => b.asset === 'USDT')?.free || 0;

    if (notional > usdtBalance) {
      throw new BadRequestException(
        `현재 USDT 잔고(${usdtBalance.toFixed(2)})보다 큰 금액(${notional.toFixed(2)})을 매수할 수 없습니다.`,
      );
    }

    return this.orderClient.placeLimitOrder(symbol, 'BUY', quantity, price);
  }

  // ------------------- ✅ 지정가 매도 -------------------
  async placeLimitSellOrder(
    symbol: string,
    quantity: number,
    price: number,
  ): Promise<any> {
    this.assertPositive(quantity, '수량은 0보다 커야 합니다.');
    this.assertPositive(price, '지정가는 0보다 커야 합니다.');

    const coin = symbol.replace('USDT', '');
    const rawBalances = await this.orderClient.fetchBalances();
    const balances = ExternalBalanceResponse.fromList(rawBalances);
    const coinBalance = balances.find((b) => b.asset === coin)?.free || 0;

    if (quantity > coinBalance) {
      throw new BadRequestException(
        `${symbol} ${quantity}개는 보유 수량 ${coinBalance}개를 초과하여 매도할 수 없습니다.`,
      );
    }

    return this.orderClient.placeLimitOrder(symbol, 'SELL', quantity, price);
  }

  // ------------------- ✅ 주문 취소 -------------------
  async cancelOrder(symbol: string, orderId: number): Promise<any> {
    return this.orderClient.cancelOrder(symbol, orderId);
  }

  // ------------------- ✅ 잔고 조회 -------------------
  async getBalances(): Promise<BalanceResponse[]> {
    const raw = await this.orderClient.fetchBalances();

    const external = ExternalBalanceResponse.fromList(raw);
    return BalanceResponse.fromList(external);
  }

  // ------------------- ✅ 공통 유효성 검사 -------------------
  private assertPositive(value: number, message: string) {
    if (value <= 0) throw new BadRequestException(message);
  }
}
