import { BadRequestException, Injectable } from '@nestjs/common';
import { calculateMaxSellableQuantity } from '../../common/utils/binance/CalculateMaxSellableQuantity';
import { ExternalBalanceResponse } from '../dto/external/ExternalBalanceResponse';
import { ExternalCancelOrderResponse } from '../dto/external/ExternalCancelOrderResponse';
import { ExternalLimitOrderResponse } from '../dto/external/ExternalLimitOrderResponse';
import { ExternalMarketBuyResponse } from '../dto/external/ExternalMarketBuyResponse';
import { ExternalMarketSellResponse } from '../dto/external/ExternalMarketSellResponse';
import { BalanceResponse } from '../dto/response/BalanceResponse';
import { CancelOrderResponse } from '../dto/response/CancelOrderResponse';
import { LimitOrderResponse } from '../dto/response/LimitOrderResponse';
import { MarketBuyOrderResponse } from '../dto/response/MarketBuyOrderResponse';
import { MarketSellOrderResponse } from '../dto/response/MarketSellOrderResponse';
import { BinanceOrderClient } from '../infra/BinanceOrderClient';

@Injectable()
export class OrderService {
  constructor(private readonly orderClient: BinanceOrderClient) {}

  // ✅ 시장가 매수
  async placeMarketBuyOrder(
    symbol: string,
    usdtAmount: number,
  ): Promise<MarketBuyOrderResponse> {
    this.assertPositive(usdtAmount, '매수 금액은 0보다 커야 합니다.');

    if (usdtAmount < 10) {
      throw new BadRequestException(
        `Binance는 최소 10 USDT 이상부터 시장가 매수가 가능합니다. (현재: ${usdtAmount})`,
      );
    }

    const rawBalances = await this.orderClient.fetchBalances();
    const balances = ExternalBalanceResponse.fromList(rawBalances);
    const usdtBalance = balances.find((b) => b.asset === 'USDT')?.free || 0;

    if (usdtAmount > usdtBalance) {
      throw new BadRequestException(
        `현재 USDT 잔고(${usdtBalance.toFixed(2)})보다 큰 금액(${usdtAmount})을 매수할 수 없습니다.`,
      );
    }

    const raw = await this.orderClient.placeMarketOrder(
      symbol,
      'BUY',
      usdtAmount,
    );
    const external = ExternalMarketBuyResponse.from(raw);
    return MarketBuyOrderResponse.from(external);
  }

  // ✅ 시장가 매도
  async placeMarketSellOrder(
    symbol: string,
    quantity: number,
  ): Promise<MarketSellOrderResponse> {
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

    const raw = await this.orderClient.placeMarketOrder(
      symbol,
      'SELL',
      quantity,
    );
    const external = ExternalMarketSellResponse.from(raw);
    return MarketSellOrderResponse.from(external);
  }

  // ✅ 지정가 매수
  async placeLimitBuyOrder(
    symbol: string,
    quantity: number,
    price: number,
  ): Promise<LimitOrderResponse> {
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

    const maxQty = calculateMaxSellableQuantity(symbol, usdtBalance, price);
    if (quantity > maxQty) {
      throw new BadRequestException(
        `현재 USDT 잔고(${usdtBalance.toFixed(2)})와 수수료를 고려했을 때 ${quantity} ${symbol.replace('USDT', '')}를 매수할 수 없습니다. 최대 가능 수량: ${maxQty}`,
      );
    }

    const raw = await this.orderClient.placeLimitOrder(
      symbol,
      'BUY',
      quantity,
      price,
    );
    const external = ExternalLimitOrderResponse.from(raw);
    return LimitOrderResponse.from(external);
  }

  // ✅ 지정가 매도
  async placeLimitSellOrder(
    symbol: string,
    quantity: number,
    price: number,
  ): Promise<LimitOrderResponse> {
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

    const raw = await this.orderClient.placeLimitOrder(
      symbol,
      'SELL',
      quantity,
      price,
    );
    const external = ExternalLimitOrderResponse.from(raw);
    return LimitOrderResponse.from(external);
  }

  // ✅ 주문 취소
  async cancelOrder(
    symbol: string,
    orderId: number,
  ): Promise<CancelOrderResponse> {
    const raw = await this.orderClient.cancelOrder(symbol, orderId);
    const external = ExternalCancelOrderResponse.from(raw);
    return CancelOrderResponse.from(external);
  }

  // ✅ 잔고 조회
  async getBalances(): Promise<BalanceResponse[]> {
    const raw = await this.orderClient.fetchBalances();
    const external = ExternalBalanceResponse.fromList(raw);
    return BalanceResponse.fromList(external);
  }

  // ✅ 공통 유효성 검사
  private assertPositive(value: number, message: string) {
    if (value <= 0) throw new BadRequestException(message);
  }
}
