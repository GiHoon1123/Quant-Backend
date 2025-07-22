import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TradeExecutedEvent } from 'src/common/dto/event/TradeExecutedEvent';
import { v4 as uuidv4 } from 'uuid';
import { calculateMaxSellableQuantity } from '../../common/utils/binance/CalculateMaxSellableQuantity';
import orderConfig from '../../config/OrderConfig';
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
import { BinanceOrderClient } from '../infra/client/BinanceOrderClient';

/**
 * 📈 현물 거래 서비스 (일반 거래)
 *
 * 바이낸스 현물 거래의 모든 비즈니스 로직을 담당하는 핵심 서비스입니다.
 * 선물 거래와 달리 레버리지 없이 실제 자산을 매매하는 안전한 거래 방식입니다.
 *
 * 📖 현물 거래 vs 선물 거래:
 * - 현물: 실제 코인을 소유, 레버리지 없음, 안전하지만 수익률 제한적
 * - 선물: 계약 거래, 레버리지 가능, 높은 수익률 가능하지만 위험도 높음
 *
 * 💡 현물 거래 특징:
 * - 보유한 USDT로만 매수 가능 (빌려서 거래 불가)
 * - 보유한 코인으로만 매도 가능 (공매도 불가)
 * - 손실이 투자 원금을 초과할 수 없음 (안전)
 * - 장기 보유에 적합 (지갑에 실제 코인 보관)
 *
 * 🔒 안전 장치:
 * - 잔고 부족 시 거래 차단
 * - 최소 주문 금액 검증 (10 USDT)
 * - 수수료 고려한 실제 거래 가능 수량 계산
 * - 모든 입력값 유효성 검사
 */
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private readonly MIN_ORDER_NOTIONAL: number;
  private readonly FEE_RATE: number;
  private readonly MAJOR_ASSETS: string[];

  constructor(
    private readonly orderClient: BinanceOrderClient,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    const config = orderConfig;
    this.MIN_ORDER_NOTIONAL = this.configService.get<number>(
      'order.minOrderNotional',
      config.minOrderNotional,
    );
    this.FEE_RATE = this.configService.get<number>(
      'order.feeRate',
      config.feeRate,
    );
    this.MAJOR_ASSETS =
      this.configService.get<string[]>(
        'order.majorAssets',
        config.majorAssets,
      ) || config.majorAssets;
  }

  /**
   * 📈 시장가 매수 (Market Buy Order)
   *
   * 📖 개념: 현재 시장 최저가에 즉시 매수하는 주문 방식
   *
   * 🧮 계산 방법:
   * 1. 사용자가 USDT 금액 지정 (예: 100 USDT)
   * 2. 현재 시장가에서 해당 금액만큼 코인 매수
   * 3. 실제 체결 가격은 시장 상황에 따라 변동
   *
   * 💡 장점:
   * - 즉시 체결 보장 (슬리피지 있을 수 있음)
   * - 빠른 진입 가능
   *
   * ⚠️ 단점:
   * - 정확한 체결 가격 예측 불가
   * - 급등 시 예상보다 높은 가격에 체결 가능
   *
   * 🎯 사용 시나리오:
   * - 급등 초기 빠른 진입
   * - 기술적 분석 신호 발생 시 즉시 매수
   * - 정확한 가격보다 진입 타이밍이 중요한 경우
   *
   * @param symbol 매수할 심볼 (예: BTCUSDT, ETHUSDT)
   * @param usdtAmount 매수에 사용할 USDT 금액
   * @returns 매수 주문 체결 결과
   */
  async placeMarketBuyOrder(
    symbol: string,
    usdtAmount: number,
  ): Promise<MarketBuyOrderResponse> {
    // 🔍 1단계: 입력값 유효성 검사
    this.assertPositive(usdtAmount, '매수 금액은 0보다 커야 합니다.');

    // 🔍 2단계: 바이낸스 최소 주문 금액 검증
    // 바이낸스는 시장가 매수 시 최소 10 USDT 이상 요구
    if (usdtAmount < this.MIN_ORDER_NOTIONAL) {
      throw new BadRequestException(
        `❌ 바이낸스 현물 거래 최소 금액: ${this.MIN_ORDER_NOTIONAL} USDT (입력값: ${usdtAmount} USDT)\n` +
          `💡 팁: ${this.MIN_ORDER_NOTIONAL} USDT 이상으로 주문해주세요.`,
      );
    }

    // 🔍 3단계: 현재 USDT 잔고 조회
    const rawBalances = await this.orderClient.fetchBalances();
    const balances = ExternalBalanceResponse.fromList(rawBalances);
    const usdtBalance = balances.find((b) => b.asset === 'USDT')?.free || 0;

    // 🔍 4단계: 잔고 충분성 검사
    if (usdtAmount > usdtBalance) {
      throw new BadRequestException(
        `❌ USDT 잔고 부족\n` +
          `💰 현재 잔고: ${usdtBalance.toFixed(2)} USDT\n` +
          `💸 주문 금액: ${usdtAmount} USDT\n` +
          `📊 부족 금액: ${(usdtAmount - usdtBalance).toFixed(2)} USDT\n\n` +
          `💡 해결 방법:\n` +
          `1. 주문 금액을 ${usdtBalance.toFixed(2)} USDT 이하로 조정\n` +
          `2. USDT 입금 후 재시도`,
      );
    }

    try {
      // 🚀 5단계: 시장가 매수 주문 실행
      this.logger.log(`📈 시장가 매수 시작: ${symbol} ${usdtAmount} USDT`);

      const raw = await this.orderClient.placeMarketOrder(
        symbol,
        'BUY',
        usdtAmount,
      );

      // 📊 6단계: 응답 데이터 변환
      const external = ExternalMarketBuyResponse.from(raw);
      const response = MarketBuyOrderResponse.from(external);

      this.logger.log(`✅ 시장가 매수 완료: ${symbol} ${usdtAmount} USDT`);
      this.logger.log(
        `📊 체결 정보: ${response.executedQty}개 @ 평균가 ${response.avgPrice}`,
      );

      // 🎯 이벤트 발행: 현물 거래 실행 이벤트
      const tradeEvent: TradeExecutedEvent = {
        eventId: uuidv4(),
        timestamp: new Date(),
        service: 'OrderService',
        symbol,
        orderId: response.orderId.toString(),
        clientOrderId: response.clientOrderId,
        side: 'BUY',
        type: 'MARKET',
        quantity: parseFloat(response.executedQty),
        price: parseFloat(response.avgPrice || '0'),
        totalAmount:
          parseFloat(response.executedQty) *
          parseFloat(response.avgPrice || '0'),
        fee:
          response.fills?.reduce(
            (sum, fill) => sum + parseFloat(fill.commission || '0'),
            0,
          ) || 0,
        feeAsset: response.fills?.[0]?.commissionAsset || 'USDT',
        feeRate: this.FEE_RATE, // 바이낸스 기본 수수료율 0.1%
        status: response.status,
        executedAt: new Date(),
        source: 'API',
        metadata: {
          rawResponse: raw,
          fills: response.fills,
        },
      };
      // 이벤트 발행 (공통 DTO 적용)
      const tradeExecutedEvent: TradeExecutedEvent = {
        eventId: tradeEvent.eventId,
        service: 'OrderService',
        symbol: tradeEvent.symbol,
        orderId: tradeEvent.orderId,
        clientOrderId: tradeEvent.clientOrderId,
        side: tradeEvent.side,
        type: tradeEvent.type,
        quantity: tradeEvent.quantity,
        price: tradeEvent.price,
        totalAmount: tradeEvent.totalAmount,
        fee: tradeEvent.fee,
        feeAsset: tradeEvent.feeAsset,
        feeRate: tradeEvent.feeRate,
        status: tradeEvent.status,
        executedAt: tradeEvent.executedAt,
        source: tradeEvent.source,
        metadata: tradeEvent.metadata,
        timestamp: new Date(),
      };
      this.eventEmitter.emit('trade.executed', tradeExecutedEvent);
      this.logger.log(`🎯 현물 매수 이벤트 발행 완료: ${tradeEvent.eventId}`);

      return response;
    } catch (error) {
      this.logger.error(
        `❌ 시장가 매수 실패: ${symbol} ${usdtAmount} USDT`,
        error.stack,
      );
      throw new BadRequestException(
        `시장가 매수 실패: ${error.message}\n\n` +
          `🔍 가능한 원인:\n` +
          `1. 네트워크 연결 문제\n` +
          `2. 바이낸스 서버 일시적 오류\n` +
          `3. 해당 심볼 거래 일시 중단\n` +
          `4. API 키 권한 문제`,
      );
    }
  }

  /**
   * 📉 시장가 매도 (Market Sell Order)
   *
   * 📖 개념: 현재 시장 최고가에 즉시 매도하는 주문 방식
   *
   * 🧮 계산 방법:
   * 1. 사용자가 매도할 코인 수량 지정 (예: 0.1 BTC)
   * 2. 현재 시장가에서 해당 수량만큼 코인 매도
   * 3. 실제 체결 가격은 시장 상황에 따라 변동
   *
   * 💡 장점:
   * - 즉시 체결 보장 (현금화 빠름)
   * - 급락 시 빠른 손절 가능
   *
   * ⚠️ 단점:
   * - 정확한 체결 가격 예측 불가
   * - 급락 시 예상보다 낮은 가격에 체결 가능
   *
   * 🎯 사용 시나리오:
   * - 급락 시 빠른 손절
   * - 수익 실현 (이익 확정)
   * - 기술적 분석 매도 신호 발생 시
   * - 정확한 가격보다 매도 타이밍이 중요한 경우
   *
   * @param symbol 매도할 심볼 (예: BTCUSDT, ETHUSDT)
   * @param quantity 매도할 코인 수량
   * @returns 매도 주문 체결 결과
   */
  async placeMarketSellOrder(
    symbol: string,
    quantity: number,
  ): Promise<MarketSellOrderResponse> {
    // 🔍 1단계: 입력값 유효성 검사
    this.assertPositive(quantity, '매도 수량은 0보다 커야 합니다.');

    // 🔍 2단계: 매도할 코인 심볼 추출
    // 예: BTCUSDT → BTC, ETHUSDT → ETH
    const coin = symbol.replace('USDT', '');

    // 🔍 3단계: 현재 코인 잔고 조회
    const rawBalances = await this.orderClient.fetchBalances();
    const balances = ExternalBalanceResponse.fromList(rawBalances);
    const coinBalance = balances.find((b) => b.asset === coin)?.free || 0;

    // 🔍 4단계: 보유 수량 충분성 검사
    if (quantity > coinBalance) {
      throw new BadRequestException(
        `❌ ${coin} 보유 수량 부족\n` +
          `💰 현재 보유: ${coinBalance} ${coin}\n` +
          `💸 매도 요청: ${quantity} ${coin}\n` +
          `📊 부족 수량: ${(quantity - coinBalance).toFixed(8)} ${coin}\n\n` +
          `💡 해결 방법:\n` +
          `1. 매도 수량을 ${coinBalance} ${coin} 이하로 조정\n` +
          `2. ${coin} 추가 매수 후 재시도\n` +
          `3. 전체 보유량 매도: ${coinBalance} ${coin}`,
      );
    }

    // 🔍 5단계: 최소 주문 금액 예상 검사
    // 현물 매도도 최소 10 USDT 상당의 가치가 있어야 함
    // 정확한 검사는 바이낸스에서 하지만, 사전 경고 제공
    this.logger.log(`📉 시장가 매도 준비: ${symbol} ${quantity}개`);
    this.logger.log(`💰 현재 ${coin} 보유량: ${coinBalance}개`);

    try {
      // 🚀 6단계: 시장가 매도 주문 실행
      this.logger.log(`📉 시장가 매도 시작: ${symbol} ${quantity}개`);

      const raw = await this.orderClient.placeMarketOrder(
        symbol,
        'SELL',
        quantity,
      );

      // 📊 7단계: 응답 데이터 변환
      const external = ExternalMarketSellResponse.from(raw);
      const response = MarketSellOrderResponse.from(external);

      this.logger.log(`✅ 시장가 매도 완료: ${symbol} ${quantity}개`);
      this.logger.log(
        `📊 체결 정보: ${response.executedQty}개 @ 평균가 ${response.avgPrice}`,
      );
      this.logger.log(
        `💰 매도 대금: ${(parseFloat(response.executedQty) * parseFloat(response.avgPrice)).toFixed(2)} USDT`,
      );

      // 🎯 이벤트 발행: 현물 거래 실행 이벤트
      const tradeEvent: TradeExecutedEvent = {
        eventId: uuidv4(),
        timestamp: new Date(),
        service: 'OrderService',
        symbol,
        orderId: response.orderId.toString(),
        clientOrderId: response.clientOrderId,
        side: 'SELL',
        type: 'MARKET',
        quantity: parseFloat(response.executedQty),
        price: parseFloat(response.avgPrice || '0'),
        totalAmount:
          parseFloat(response.executedQty) *
          parseFloat(response.avgPrice || '0'),
        fee:
          response.fills?.reduce(
            (sum, fill) => sum + parseFloat(fill.commission || '0'),
            0,
          ) || 0,
        feeAsset: response.fills?.[0]?.commissionAsset || 'USDT',
        feeRate: this.FEE_RATE,
        status: response.status,
        executedAt: new Date(),
        source: 'API',
        metadata: {
          rawResponse: raw,
          fills: response.fills,
        },
      };
      // 이벤트 발행 (공통 DTO 적용)
      const tradeExecutedEvent: TradeExecutedEvent = {
        eventId: tradeEvent.eventId,
        service: 'OrderService',
        symbol: tradeEvent.symbol,
        orderId: tradeEvent.orderId,
        clientOrderId: tradeEvent.clientOrderId,
        side: tradeEvent.side,
        type: tradeEvent.type,
        quantity: tradeEvent.quantity,
        price: tradeEvent.price,
        totalAmount: tradeEvent.totalAmount,
        fee: tradeEvent.fee,
        feeAsset: tradeEvent.feeAsset,
        feeRate: tradeEvent.feeRate,
        status: tradeEvent.status,
        executedAt: tradeEvent.executedAt,
        source: tradeEvent.source,
        metadata: tradeEvent.metadata,
        timestamp: new Date(),
      };
      this.eventEmitter.emit('trade.executed', tradeExecutedEvent);
      this.logger.log(`🎯 현물 매도 이벤트 발행 완료: ${tradeEvent.eventId}`);

      return response;
    } catch (error) {
      this.logger.error(
        `❌ 시장가 매도 실패: ${symbol} ${quantity}개`,
        error.stack,
      );
      throw new BadRequestException(
        `시장가 매도 실패: ${error.message}\n\n` +
          `🔍 가능한 원인:\n` +
          `1. 최소 주문 금액 미달 (${this.MIN_ORDER_NOTIONAL} USDT 미만)\n` +
          `2. 네트워크 연결 문제\n` +
          `3. 바이낸스 서버 일시적 오류\n` +
          `4. 해당 심볼 거래 일시 중단\n` +
          `5. API 키 권한 문제`,
      );
    }
  }

  /**
   * 📊 지정가 매수 (Limit Buy Order)
   *
   * 📖 개념: 사용자가 원하는 특정 가격에 매수 주문을 걸어두는 방식
   *
   * 🧮 계산 방법:
   * 1. 사용자가 매수 수량과 희망 가격 지정 (예: 0.1 BTC @ 40,000 USDT)
   * 2. 시장가가 지정가에 도달하면 자동 체결
   * 3. 총 주문 금액 = 수량 × 지정가 + 수수료
   *
   * 💡 장점:
   * - 정확한 가격에 매수 가능
   * - 급락 시 저점 매수 기회 포착
   * - 감정적 거래 방지 (미리 계획된 가격)
   *
   * ⚠️ 단점:
   * - 체결 보장 없음 (가격이 안 오면 미체결)
   * - 급등 시 매수 기회 놓칠 수 있음
   *
   * 🎯 사용 시나리오:
   * - 지지선 근처에서 매수 대기
   * - 급락 후 반등 구간 매수
   * - 정확한 진입가 원할 때
   * - 장기 투자 시 분할 매수
   *
   * 💰 수수료 계산:
   * - 바이낸스 현물 거래 수수료: 0.1% (기본)
   * - VIP 레벨에 따라 할인 적용
   * - BNB 수수료 할인: 25% 추가 할인
   *
   * @param symbol 매수할 심볼 (예: BTCUSDT, ETHUSDT)
   * @param quantity 매수할 코인 수량
   * @param price 희망 매수 가격 (USDT)
   * @returns 지정가 매수 주문 결과
   */
  async placeLimitBuyOrder(
    symbol: string,
    quantity: number,
    price: number,
  ): Promise<LimitOrderResponse> {
    // 🔍 1단계: 입력값 유효성 검사
    this.assertPositive(quantity, '매수 수량은 0보다 커야 합니다.');
    this.assertPositive(price, '지정가는 0보다 커야 합니다.');

    // 🔍 2단계: 최소 주문 금액 검증
    // 총 주문 금액 = 수량 × 가격
    const notional = price * quantity;
    if (notional < this.MIN_ORDER_NOTIONAL) {
      throw new BadRequestException(
        `❌ 최소 주문 금액 미달\n` +
          `📊 현재 주문 금액: ${notional.toFixed(2)} USDT\n` +
          `📏 최소 주문 금액: ${this.MIN_ORDER_NOTIONAL} USDT\n` +
          `💡 해결 방법:\n` +
          `1. 수량 증가: ${(this.MIN_ORDER_NOTIONAL / price).toFixed(8)} ${symbol.replace(
            'USDT',
            '',
          )} 이상\n` +
          `2. 가격 상향: ${(this.MIN_ORDER_NOTIONAL / quantity).toFixed(
            2,
          )} USDT 이상`,
      );
    }

    // 🔍 3단계: 현재 USDT 잔고 조회
    const rawBalances = await this.orderClient.fetchBalances();
    const balances = ExternalBalanceResponse.fromList(rawBalances);
    const usdtBalance = balances.find((b) => b.asset === 'USDT')?.free || 0;

    // 🔍 4단계: 수수료 포함 실제 거래 가능 수량 계산
    // calculateMaxSellableQuantity: 수수료(0.1%)를 고려한 최대 매수 가능 수량
    const maxQty = calculateMaxSellableQuantity(symbol, usdtBalance, price);
    if (quantity > maxQty) {
      const requiredUsdt = quantity * price * 1.001; // 수수료 0.1% 포함
      throw new BadRequestException(
        `❌ USDT 잔고 부족 (수수료 포함)\n` +
          `💰 현재 USDT 잔고: ${usdtBalance.toFixed(2)} USDT\n` +
          `💸 필요 금액: ${requiredUsdt.toFixed(2)} USDT (수수료 포함)\n` +
          `📊 최대 매수 가능: ${maxQty.toFixed(8)} ${symbol.replace('USDT', '')}\n\n` +
          `💡 해결 방법:\n` +
          `1. 수량을 ${maxQty.toFixed(8)} 이하로 조정\n` +
          `2. USDT 추가 입금 후 재시도\n` +
          `3. 더 낮은 가격으로 주문`,
      );
    }

    try {
      // 🚀 5단계: 지정가 매수 주문 실행
      this.logger.log(
        `📊 지정가 매수 주문: ${symbol} ${quantity}개 @ ${price} USDT`,
      );
      this.logger.log(
        `💰 총 주문 금액: ${notional.toFixed(2)} USDT (수수료 별도)`,
      );

      const raw = await this.orderClient.placeLimitOrder(
        symbol,
        'BUY',
        quantity,
        price,
      );

      // 📊 6단계: 응답 데이터 변환
      const external = ExternalLimitOrderResponse.from(raw);
      const response = LimitOrderResponse.from(external);

      this.logger.log(`✅ 지정가 매수 주문 완료: ${symbol}`);
      this.logger.log(`📋 주문 ID: ${response.orderId}`);
      this.logger.log(`⏰ 주문 상태: ${response.status} (체결 대기 중)`);
      this.logger.log(
        `💡 팁: 시장가가 ${price} USDT에 도달하면 자동 체결됩니다`,
      );

      return response;
    } catch (error) {
      this.logger.error(`❌ 지정가 매수 주문 실패: ${symbol}`, error.stack);
      throw new BadRequestException(
        `지정가 매수 주문 실패: ${error.message}\n\n` +
          `🔍 가능한 원인:\n` +
          `1. 가격 정밀도 오류 (소수점 자릿수 확인)\n` +
          `2. 수량 정밀도 오류 (최소 단위 확인)\n` +
          `3. 시장 시간 외 거래 시도\n` +
          `4. 네트워크 연결 문제\n` +
          `5. API 키 권한 문제`,
      );
    }
  }

  /**
   * 📊 지정가 매도 (Limit Sell Order)
   *
   * 📖 개념: 사용자가 원하는 특정 가격에 매도 주문을 걸어두는 방식
   *
   * 🧮 계산 방법:
   * 1. 사용자가 매도 수량과 희망 가격 지정 (예: 0.1 BTC @ 45,000 USDT)
   * 2. 시장가가 지정가에 도달하면 자동 체결
   * 3. 예상 수익 = 수량 × 지정가 - 수수료
   *
   * 💡 장점:
   * - 정확한 가격에 매도 가능
   * - 목표 수익률 달성 시 자동 매도
   * - 감정적 거래 방지 (미리 계획된 가격)
   * - 급등 시 고점 매도 기회 포착
   *
   * ⚠️ 단점:
   * - 체결 보장 없음 (가격이 안 오면 미체결)
   * - 급락 시 손절 기회 놓칠 수 있음
   *
   * 🎯 사용 시나리오:
   * - 저항선 근처에서 매도 대기
   * - 목표 수익률 달성 시 이익 실현
   * - 정확한 매도가 원할 때
   * - 장기 보유 중 분할 매도
   *
   * 💰 수익 계산 예시:
   * - 매도 수량: 0.1 BTC
   * - 지정가: 45,000 USDT
   * - 총 매도 대금: 4,500 USDT
   * - 수수료 (0.1%): 4.5 USDT
   * - 실제 수익: 4,495.5 USDT
   *
   * @param symbol 매도할 심볼 (예: BTCUSDT, ETHUSDT)
   * @param quantity 매도할 코인 수량
   * @param price 희망 매도 가격 (USDT)
   * @returns 지정가 매도 주문 결과
   */
  async placeLimitSellOrder(
    symbol: string,
    quantity: number,
    price: number,
  ): Promise<LimitOrderResponse> {
    // 🔍 1단계: 입력값 유효성 검사
    this.assertPositive(quantity, '매도 수량은 0보다 커야 합니다.');
    this.assertPositive(price, '지정가는 0보다 커야 합니다.');

    // 🔍 2단계: 최소 주문 금액 검증
    const notional = price * quantity;
    if (notional < this.MIN_ORDER_NOTIONAL) {
      throw new BadRequestException(
        `❌ 최소 주문 금액 미달\n` +
          `📊 현재 주문 금액: ${notional.toFixed(2)} USDT\n` +
          `📏 최소 주문 금액: ${this.MIN_ORDER_NOTIONAL} USDT\n` +
          `💡 해결 방법:\n` +
          `1. 수량 증가: ${(this.MIN_ORDER_NOTIONAL / price).toFixed(8)} ${symbol.replace(
            'USDT',
            '',
          )} 이상\n` +
          `2. 가격 상향: ${(this.MIN_ORDER_NOTIONAL / quantity).toFixed(
            2,
          )} USDT 이상`,
      );
    }

    // 🔍 3단계: 매도할 코인 심볼 추출
    const coin = symbol.replace('USDT', '');

    // 🔍 4단계: 현재 코인 잔고 조회
    const rawBalances = await this.orderClient.fetchBalances();
    const balances = ExternalBalanceResponse.fromList(rawBalances);
    const coinBalance = balances.find((b) => b.asset === coin)?.free || 0;

    // 🔍 5단계: 보유 수량 충분성 검사
    if (quantity > coinBalance) {
      throw new BadRequestException(
        `❌ ${coin} 보유 수량 부족\n` +
          `💰 현재 보유: ${coinBalance} ${coin}\n` +
          `💸 매도 요청: ${quantity} ${coin}\n` +
          `📊 부족 수량: ${(quantity - coinBalance).toFixed(8)} ${coin}\n\n` +
          `💡 해결 방법:\n` +
          `1. 매도 수량을 ${coinBalance} ${coin} 이하로 조정\n` +
          `2. ${coin} 추가 매수 후 재시도\n` +
          `3. 전체 보유량 매도: ${coinBalance} ${coin}`,
      );
    }

    try {
      // 🚀 6단계: 지정가 매도 주문 실행
      this.logger.log(
        `📊 지정가 매도 주문: ${symbol} ${quantity}개 @ ${price} USDT`,
      );
      this.logger.log(
        `💰 예상 매도 대금: ${notional.toFixed(2)} USDT (수수료 별도)`,
      );
      this.logger.log(
        `💵 예상 수수료: ${(notional * 0.001).toFixed(2)} USDT (0.1%)`,
      );
      this.logger.log(
        `💎 예상 실수령액: ${(notional * 0.999).toFixed(2)} USDT`,
      );

      const raw = await this.orderClient.placeLimitOrder(
        symbol,
        'SELL',
        quantity,
        price,
      );

      // 📊 7단계: 응답 데이터 변환
      const external = ExternalLimitOrderResponse.from(raw);
      const response = LimitOrderResponse.from(external);

      this.logger.log(`✅ 지정가 매도 주문 완료: ${symbol}`);
      this.logger.log(`📋 주문 ID: ${response.orderId}`);
      this.logger.log(`⏰ 주문 상태: ${response.status} (체결 대기 중)`);
      this.logger.log(
        `💡 팁: 시장가가 ${price} USDT에 도달하면 자동 체결됩니다`,
      );

      return response;
    } catch (error) {
      this.logger.error(`❌ 지정가 매도 주문 실패: ${symbol}`, error.stack);
      throw new BadRequestException(
        `지정가 매도 주문 실패: ${error.message}\n\n` +
          `🔍 가능한 원인:\n` +
          `1. 가격 정밀도 오류 (소수점 자릿수 확인)\n` +
          `2. 수량 정밀도 오류 (최소 단위 확인)\n` +
          `3. 시장 시간 외 거래 시도\n` +
          `4. 네트워크 연결 문제\n` +
          `5. API 키 권한 문제`,
      );
    }
  }

  /**
   * ❌ 주문 취소 (Cancel Order)
   *
   * 📖 개념: 아직 체결되지 않은 지정가 주문을 취소하는 기능
   *
   * 🧮 취소 가능 조건:
   * 1. 주문 상태가 'NEW' 또는 'PARTIALLY_FILLED'
   * 2. 완전 체결('FILLED') 또는 이미 취소된 주문은 취소 불가
   * 3. 시장가 주문은 즉시 체결되므로 취소 불가
   *
   * 💡 사용 시나리오:
   * - 지정가 주문 후 시장 상황 변화
   * - 더 좋은 가격에 재주문하고 싶을 때
   * - 투자 전략 변경 시
   * - 실수로 잘못 주문했을 때
   *
   * ⚠️ 주의사항:
   * - 부분 체결된 주문 취소 시 체결된 부분은 그대로 유지
   * - 취소 수수료는 없음 (바이낸스 기준)
   * - 네트워크 지연으로 취소 중 체결될 수 있음
   *
   * @param symbol 취소할 주문의 심볼 (예: BTCUSDT)
   * @param orderId 취소할 주문 ID (주문 시 받은 ID)
   * @returns 주문 취소 결과
   */
  async cancelOrder(
    symbol: string,
    orderId: number,
  ): Promise<CancelOrderResponse> {
    // 🔍 입력값 검증
    if (!symbol || symbol.trim().length === 0) {
      throw new BadRequestException('거래 심볼을 입력해주세요.');
    }

    if (!orderId || orderId <= 0) {
      throw new BadRequestException('유효한 주문 ID를 입력해주세요.');
    }

    try {
      this.logger.log(`❌ 주문 취소 시작: ${symbol} 주문 ID ${orderId}`);

      // 🚀 주문 취소 실행
      const raw = await this.orderClient.cancelOrder(symbol, orderId);
      const external = ExternalCancelOrderResponse.from(raw);
      const response = CancelOrderResponse.from(external);

      this.logger.log(`✅ 주문 취소 완료: ${symbol} 주문 ID ${orderId}`);
      this.logger.log(`📊 취소된 주문 상태: ${response.status}`);

      // 부분 체결 여부 확인
      if (response.executedQty && parseFloat(response.executedQty) > 0) {
        this.logger.warn(`⚠️ 부분 체결됨: ${response.executedQty}개 이미 체결`);
        this.logger.log(`💡 체결된 부분은 취소되지 않고 그대로 유지됩니다`);
      }

      return response;
    } catch (error) {
      this.logger.error(
        `❌ 주문 취소 실패: ${symbol} 주문 ID ${orderId}`,
        error,
      );
      throw new BadRequestException(
        `주문 취소 실패: ${error.message}\n\n` +
          `🔍 가능한 원인:\n` +
          `1. 주문이 이미 체결됨 (FILLED)\n` +
          `2. 주문이 이미 취소됨 (CANCELED)\n` +
          `3. 존재하지 않는 주문 ID\n` +
          `4. 네트워크 연결 문제\n` +
          `5. API 키 권한 문제\n\n` +
          `💡 해결 방법:\n` +
          `1. 주문 상태를 먼저 확인\n` +
          `2. 올바른 주문 ID 사용\n` +
          `3. 잠시 후 재시도`,
      );
    }
  }

  /**
   * 💰 잔고 조회 (Get Balances)
   *
   * 📖 개념: 현물 계정의 모든 자산 잔고를 조회하는 기능
   *
   * 🧮 제공 정보:
   * 1. 총 잔고 (total): 전체 보유량
   * 2. 사용 가능 잔고 (free): 거래 가능한 수량
   * 3. 주문 중 잔고 (locked): 미체결 주문에 묶인 수량
   *
   * 💡 잔고 계산:
   * - 총 잔고 = 사용 가능 잔고 + 주문 중 잔고
   * - 실제 거래 가능 = 사용 가능 잔고만 사용 가능
   * - 주문 취소 시 locked → free로 이동
   *
   * 🎯 사용 시나리오:
   * - 거래 전 잔고 확인
   * - 포트폴리오 현황 파악
   * - 자산 분산 상태 점검
   * - 수익/손실 계산
   *
   * 📊 주요 자산별 특징:
   * - USDT: 기축 통화, 거래 수수료 지불
   * - BTC/ETH: 주요 암호화폐
   * - BNB: 바이낸스 코인, 수수료 할인 (25%)
   * - 기타 알트코인: 개별 프로젝트 토큰
   *
   * @returns 모든 자산의 잔고 정보 배열
   */
  async getBalances(): Promise<BalanceResponse[]> {
    try {
      this.logger.log(`💰 잔고 조회 시작`);

      // 🚀 잔고 조회 실행
      const raw = await this.orderClient.fetchBalances();
      const external = ExternalBalanceResponse.fromList(raw);
      const response = BalanceResponse.fromList(external);

      // 📊 잔고 요약 정보 출력
      const nonZeroBalances = response.filter(
        (b) => b.free > 0 || b.locked > 0,
      );
      this.logger.log(
        `✅ 잔고 조회 완료: ${nonZeroBalances.length}개 자산 보유 중`,
      );

      // 주요 자산 잔고 로그 출력
      this.MAJOR_ASSETS.forEach((asset) => {
        const balance = response.find((b) => b.asset === asset);
        if (balance && (balance.free > 0 || balance.locked > 0)) {
          this.logger.log(
            `💎 ${asset}: ${balance.free} (사용가능) + ${balance.locked} (주문중) = ${(
              balance.free + balance.locked
            ).toFixed(8)}`,
          );
        }
      });

      return response;
    } catch (error) {
      this.logger.error(`❌ 잔고 조회 실패`, error);
      throw new BadRequestException(
        `잔고 조회 실패: ${error.message}\n\n` +
          `🔍 가능한 원인:\n` +
          `1. 네트워크 연결 문제\n` +
          `2. 바이낸스 서버 일시적 오류\n` +
          `3. API 키 권한 문제 (READ 권한 필요)\n` +
          `4. API 키 만료\n` +
          `5. IP 화이트리스트 설정 문제\n\n` +
          `💡 해결 방법:\n` +
          `1. 네트워크 연결 상태 확인\n` +
          `2. API 키 권한 설정 확인\n` +
          `3. 잠시 후 재시도`,
      );
    }
  }

  /**
   * 🔍 공통 유효성 검사 (Private Helper Method)
   *
   * 📖 개념: 모든 거래 메서드에서 공통으로 사용하는 입력값 검증 함수
   *
   * 🧮 검증 내용:
   * - 숫자 값이 0보다 큰지 확인
   * - null, undefined, NaN 값 차단
   * - 음수 값 차단
   *
   * 💡 사용 이유:
   * - 코드 중복 방지 (DRY 원칙)
   * - 일관된 에러 메시지 제공
   * - 유지보수성 향상
   *
   * @param value 검증할 숫자 값
   * @param message 에러 시 표시할 메시지
   * @throws BadRequestException 값이 0 이하일 때
   */
  private assertPositive(value: number, message: string): void {
    // null, undefined 체크
    if (value == null) {
      throw new BadRequestException(`${message} (값이 없습니다)`);
    }

    // NaN 체크
    if (isNaN(value)) {
      throw new BadRequestException(`${message} (숫자가 아닙니다)`);
    }

    // 양수 체크
    if (value <= 0) {
      throw new BadRequestException(`${message} (0보다 커야 합니다)`);
    }

    // 무한대 체크
    if (!isFinite(value)) {
      throw new BadRequestException(`${message} (유한한 숫자여야 합니다)`);
    }
  }
}
