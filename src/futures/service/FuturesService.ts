import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PositionClosedEvent,
  PositionOpenedEvent,
} from 'src/common/dto/event/PositionEvent';
import { v4 as uuidv4 } from 'uuid';
import futuresConfig from '../../config/FuturesConfig';
import { ExternalFuturesOrderResponse } from '../dto/external/ExternalFuturesOrderResponse';
import { PositionSide } from '../dto/request/OpenPositionRequest';
import { MarginType } from '../dto/request/SetMarginTypeRequest';
import { AccountType } from '../dto/request/TransferFundsRequest';
import { FuturesBalanceResponse } from '../dto/response/FuturesBalanceResponse';
import { PositionInfoResponse } from '../dto/response/PositionInfoResponse';
import { PositionOpenResponse } from '../dto/response/PositionOpenResponse';
import { BinanceFuturesClient } from '../infra/client/BinanceFuturesClient';
import { BinanceFuturesPositionClient } from '../infra/client/BinanceFuturesPositionClient';

/**
 * 선물거래 서비스
 *
 * 바이낸스 선물거래의 모든 비즈니스 로직을 담당하는 핵심 서비스입니다.
 * 안전한 선물거래를 위한 다양한 검증과 예외처리를 포함합니다.
 *
 * ⚠️ 선물거래 위험 경고:
 * - 선물거래는 높은 위험을 수반하며 원금 손실 위험이 있습니다
 * - 레버리지 사용 시 손실이 원금을 초과할 수 있습니다
 * - 충분한 이해와 위험 관리 후 사용하시기 바랍니다
 *
 * 주요 기능:
 * - 포지션 진입/청산 (안전성 검증 포함)
 * - 레버리지 및 마진 모드 설정
 * - 포지션 및 잔고 정보 조회
 * - 위험 관리 기능
 */
@Injectable()
export class FuturesService {
  private readonly logger = new Logger(FuturesService.name);
  private readonly MIN_ORDER_NOTIONAL: number;
  private readonly DEFAULT_RISK_THRESHOLD: number;

  constructor(
    private readonly futuresClient: BinanceFuturesClient,
    private readonly positionClient: BinanceFuturesPositionClient,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    const config = futuresConfig();
    this.MIN_ORDER_NOTIONAL = this.configService.get<number>(
      'futures.minOrderNotional',
      config.minOrderNotional,
    );
    this.DEFAULT_RISK_THRESHOLD = this.configService.get<number>(
      'futures.defaultRiskThreshold',
      config.defaultRiskThreshold,
    );
  }

  /**
   * 선물 포지션 진입
   *
   * @param symbol 거래 심볼 (예: BTCUSDT)
   * @param side 포지션 방향 (LONG: 상승베팅, SHORT: 하락베팅)
   * @param quantity 포지션 수량
   * @param leverage 레버리지 배수
   * @returns 포지션 진입 결과
   *
   * 🔒 안전 검증 항목:
   * - 입력값 유효성 검사
   * - 잔고 충분성 확인
   * - 레버리지 설정 및 확인
   * - 최소 주문 금액 검증
   */
  async openPosition(
    symbol: string,
    side: PositionSide,
    quantity: number,
    leverage: number,
  ): Promise<PositionOpenResponse> {
    // 1. 입력값 유효성 검사
    this.validatePositionInputs(symbol, quantity, leverage);

    // 2. 레버리지 설정 (포지션 진입 전 반드시 설정)
    await this.setLeverage(symbol, leverage);

    // 3. 필요 마진 계산 (현재 시장가 기준 추정)
    const estimatedPrice = await this.getEstimatedPrice(symbol);
    const requiredMargin = (quantity * estimatedPrice) / leverage;

    // 4. 잔고 충분성 확인
    const balanceCheck = await this.positionClient.canOpenPosition(
      symbol,
      requiredMargin,
    );
    if (!balanceCheck.canOpen) {
      throw new BadRequestException(`포지션 진입 불가: ${balanceCheck.reason}`);
    }

    // 5. 최소 주문 금액 검증 (바이낸스 선물 최소 주문 금액: 5 USDT)
    const notionalValue = quantity * estimatedPrice;
    if (notionalValue < this.MIN_ORDER_NOTIONAL) {
      throw new BadRequestException(
        `선물 포지션은 최소 ${this.MIN_ORDER_NOTIONAL} USDT 이상이어야 합니다. (현재: ${notionalValue.toFixed(2)} USDT)`,
      );
    }

    // 6. 기존 포지션 확인 및 경고
    if (balanceCheck.hasExistingPosition) {
      this.logger.warn(
        `⚠️ 경고: ${symbol}에 기존 포지션이 존재합니다. 추가 포지션을 진입합니다.`,
      );
    }

    try {
      // 7. 포지션 진입 실행 (단방향 모드)
      const orderSide = side === PositionSide.LONG ? 'BUY' : 'SELL';
      const raw = await this.futuresClient.openPosition(
        symbol,
        orderSide,
        quantity,
      );

      // 8. 응답 변환
      const external = ExternalFuturesOrderResponse.from(raw);
      const response = PositionOpenResponse.from(external);

      this.logger.log(
        `✅ 선물 포지션 진입 성공: ${symbol} ${side} ${quantity} (레버리지: ${leverage}x)`,
      );

      // 거래 실행 이벤트 발행 (TransactionService에서 처리)
      const tradeExecutedEvent = {
        eventId: uuidv4(),
        timestamp: new Date(),
        symbol,
        service: 'FuturesService',
        orderId: external.orderId,
        clientOrderId: external.clientOrderId || '',
        side: side === PositionSide.LONG ? 'BUY' : 'SELL',
        type: 'MARKET',
        quantity,
        price: parseFloat(external.avgPrice) || 0,
        totalAmount: parseFloat(external.cumQuote) || 0,
        fee: 0, // 추후 실제 수수료 정보로 업데이트 필요
        feeAsset: 'USDT',
        feeRate: 0,
        status: external.status,
        executedAt: new Date(),
        source: 'FuturesService',
        metadata: {
          leverage,
          positionSide: side,
          marginType: 'ISOLATED',
          orderId: external.orderId,
        },
      };
      this.eventEmitter.emit('trade.executed', tradeExecutedEvent);

      // 포지션 오픈 이벤트도 발행 (다른 서비스에서 사용할 수 있음)
      const positionOpenedEvent: PositionOpenedEvent = {
        eventId: uuidv4(),
        timestamp: new Date(),
        symbol,
        service: 'FuturesService',
        side,
        quantity,
        leverage,
        notional: parseFloat(external.cumQuote),
        source: 'FuturesService',
        metadata: { orderId: external.orderId },
      };
      this.eventEmitter.emit('futures.position.opened', positionOpenedEvent);

      return response;
    } catch (error) {
      this.logger.error(`❌ 선물 포지션 진입 실패: ${symbol} ${side}`, error);
      throw new BadRequestException(
        `포지션 진입에 실패했습니다: ${error.message}`,
      );
    }
  }

  /**
   * 선물 포지션 청산
   *
   * @param symbol 청산할 심볼
   * @param quantity 청산할 수량 (없으면 전체 청산)
   * @returns 포지션 청산 결과
   *
   * 🔒 안전 검증 항목:
   * - 포지션 존재 여부 확인
   * - 청산 수량 유효성 검사
   * - 부분 청산 시 잔여 수량 검증
   */
  async closePosition(
    symbol: string,
    quantity?: number,
  ): Promise<PositionOpenResponse> {
    // 1. 현재 포지션 확인
    const activePositions =
      await this.positionClient.getActivePositions(symbol);
    if (activePositions.length === 0) {
      throw new BadRequestException(`${symbol}에 청산할 포지션이 없습니다.`);
    }

    // 2. 포지션이 여러 개인 경우 (LONG과 SHORT 동시 보유)
    if (activePositions.length > 1 && !quantity) {
      throw new BadRequestException(
        `${symbol}에 여러 포지션이 있습니다. 청산할 수량을 명시하거나 개별적으로 청산해주세요.`,
      );
    }

    const position = activePositions[0];
    const positionAmt = parseFloat(position.positionAmt);
    const positionSide = positionAmt > 0 ? 'LONG' : 'SHORT';
    const positionQuantity = Math.abs(positionAmt);

    // 3. 청산 수량 검증
    if (quantity && quantity > positionQuantity) {
      throw new BadRequestException(
        `청산 수량(${quantity})이 보유 포지션 수량(${positionQuantity})을 초과합니다.`,
      );
    }

    try {
      // 4. 포지션 청산 실행
      const raw = await this.futuresClient.closePosition(
        symbol,
        positionSide,
        quantity,
      );

      const external = ExternalFuturesOrderResponse.from(raw);
      const response = PositionOpenResponse.from(external);

      const actionText = quantity ? '부분 청산' : '전체 청산';
      this.logger.log(
        `✅ 선물 포지션 ${actionText} 성공: ${symbol} ${positionSide} ${quantity || positionQuantity}`,
      );

      // 거래 실행 이벤트 발행 (청산은 포지션과 반대 방향 거래)
      const tradeExecutedEvent = {
        eventId: uuidv4(),
        timestamp: new Date(),
        symbol,
        service: 'FuturesService',
        orderId: external.orderId,
        clientOrderId: external.clientOrderId || '',
        side: positionSide === 'LONG' ? 'SELL' : 'BUY',
        type: 'MARKET',
        quantity: quantity || positionQuantity,
        price: parseFloat(external.avgPrice) || 0,
        totalAmount: parseFloat(external.cumQuote) || 0,
        fee: 0,
        feeAsset: 'USDT',
        feeRate: 0,
        status: external.status,
        executedAt: new Date(),
        source: 'FuturesService',
        metadata: {
          positionSide,
          isClosing: true,
          closeType: quantity ? 'PARTIAL' : 'FULL',
          orderId: external.orderId,
        },
      };
      this.eventEmitter.emit('trade.executed', tradeExecutedEvent);

      // 포지션 클로즈 이벤트도 발행
      const positionClosedEvent: PositionClosedEvent = {
        eventId: uuidv4(),
        timestamp: new Date(),
        symbol,
        service: 'FuturesService',
        side: positionSide,
        quantity: quantity || positionQuantity,
        source: 'FuturesService',
        metadata: { orderId: external.orderId },
      };
      this.eventEmitter.emit('futures.position.closed', positionClosedEvent);

      return response;
    } catch (error) {
      this.logger.error(`❌ 선물 포지션 청산 실패: ${symbol}`, error);
      throw new BadRequestException(
        `포지션 청산에 실패했습니다: ${error.message}`,
      );
    }
  }

  /**
   * 레버리지 설정
   *
   * @param symbol 설정할 심볼
   * @param leverage 레버리지 배수 (1~125)
   * @returns 설정 결과
   *
   * ⚠️ 레버리지 주의사항:
   * - 높은 레버리지는 높은 위험을 의미합니다
   * - 포지션이 있는 상태에서는 변경이 제한될 수 있습니다
   */
  async setLeverage(symbol: string, leverage: number): Promise<any> {
    // 레버리지 범위 검증
    if (leverage < 1 || leverage > 125) {
      throw new BadRequestException(
        '레버리지는 1배에서 125배 사이여야 합니다.',
      );
    }

    try {
      const result = await this.futuresClient.setLeverage(symbol, leverage);
      this.logger.log(`✅ 레버리지 설정 성공: ${symbol} ${leverage}x`);
      return result;
    } catch (error) {
      this.logger.error(`❌ 레버리지 설정 실패: ${symbol} ${leverage}x`, error);
      if (error.message?.includes('leverage not modified')) {
        this.logger.log(`ℹ️ 레버리지 이미 설정됨: ${symbol} ${leverage}x`);
        return { symbol, leverage, status: 'already_set' };
      }
      throw new BadRequestException(
        `레버리지 설정에 실패했습니다: ${error.message}`,
      );
    }
  }

  /**
   * 마진 모드 설정
   *
   * @param symbol 설정할 심볼
   * @param marginType 마진 타입 (ISOLATED: 격리마진, CROSSED: 교차마진)
   * @returns 설정 결과
   *
   * 📝 마진 모드 설명:
   * - ISOLATED (격리마진): 포지션별 마진 분리, 안전하지만 자금효율성 낮음
   * - CROSSED (교차마진): 전체 잔고 사용, 위험하지만 청산 위험 낮음
   */
  async setMarginType(symbol: string, marginType: MarginType): Promise<any> {
    try {
      const result = await this.futuresClient.setMarginType(symbol, marginType);
      this.logger.log(`✅ 마진 모드 설정 성공: ${symbol} ${marginType}`);
      return result;
    } catch (error) {
      this.logger.error(
        `❌ 마진 모드 설정 실패: ${symbol} ${marginType}`,
        error,
      );
      if (error.message?.includes('No need to change margin type')) {
        this.logger.log(`ℹ️ 마진 모드 이미 설정됨: ${symbol} ${marginType}`);
        return { symbol, marginType, status: 'already_set' };
      }
      throw new BadRequestException(
        `마진 모드 설정에 실패했습니다: ${error.message}`,
      );
    }
  }

  /**
   * 현재 포지션 정보 조회
   *
   * @param symbol 조회할 심볼 (없으면 모든 활성 포지션)
   * @returns 포지션 정보 배열
   *
   * 📊 제공 정보:
   * - 포지션 수량 및 방향
   * - 진입가격 및 현재 손익
   * - 청산 가격 및 위험도
   * - 레버리지 및 마진 정보
   */
  async getPositions(symbol?: string): Promise<PositionInfoResponse[]> {
    try {
      const activePositions =
        await this.positionClient.getActivePositions(symbol);
      return PositionInfoResponse.fromList(activePositions);
    } catch (error) {
      this.logger.error('❌ 포지션 정보 조회 실패:', error);
      throw new BadRequestException(
        `포지션 정보 조회에 실패했습니다: ${error.message}`,
      );
    }
  }

  /**
   * 선물 계정 잔고 조회
   *
   * @returns 잔고 정보 배열
   *
   * 💰 제공 정보:
   * - 총 잔고 및 사용 가능한 잔고
   * - 포지션에 사용중인 마진
   * - 최대 출금 가능 금액
   * - 미실현 손익
   */
  async getFuturesBalances(): Promise<FuturesBalanceResponse[]> {
    try {
      const balances = await this.positionClient.getAvailableBalances();
      return FuturesBalanceResponse.fromList(balances);
    } catch (error) {
      this.logger.error('❌ 선물 잔고 조회 실패:', error);
      throw new BadRequestException(
        `선물 잔고 조회에 실패했습니다: ${error.message}`,
      );
    }
  }

  /**
   * 위험 포지션 조회 (청산 위험이 높은 포지션)
   *
   * @param riskThreshold 위험 임계값 (기본값: 0.8 = 80%)
   * @returns 위험 포지션 정보 배열
   *
   * ⚠️ 위험 관리: 유지마진율이 높을수록 청산에 가까워집니다
   * 일반적으로 80% 이상이면 즉시 조치가 필요합니다
   */
  async getHighRiskPositions(
    riskThreshold: number = 0.8,
  ): Promise<PositionInfoResponse[]> {
    try {
      const highRiskPositions = await this.positionClient.getHighRiskPositions(
        riskThreshold ?? this.DEFAULT_RISK_THRESHOLD,
      );
      return PositionInfoResponse.fromList(highRiskPositions);
    } catch (error) {
      this.logger.error('❌ 위험 포지션 조회 실패:', error);
      throw new BadRequestException(
        `위험 포지션 조회에 실패했습니다: ${error.message}`,
      );
    }
  }

  /**
   * 현물 계좌와 선물 계좌 간 자금 이체
   *
   * @param asset 이체할 자산 (예: USDT, BTC)
   * @param amount 이체할 금액
   * @param fromAccountType 출발 계좌 유형 (SPOT, FUTURES)
   * @param toAccountType 도착 계좌 유형 (SPOT, FUTURES)
   * @returns 이체 결과
   *
   * 📝 이체 방향:
   * - SPOT → FUTURES: 선물 거래를 위한 자금 이체
   * - FUTURES → SPOT: 선물 계좌에서 현물 계좌로 자금 회수
   *
   * ⚠️ 주의사항:
   * - 이체 후 즉시 반영되지만 UI 갱신에 약간의 시간 소요 가능
   * - 포지션에 사용 중인 자금은 이체 불가
   * - 최소 이체 금액은 자산별로 상이
   */
  async transferFunds(
    asset: string,
    amount: number,
    fromAccountType: AccountType,
    toAccountType: AccountType,
  ): Promise<any> {
    // 1. 입력값 유효성 검사
    if (!asset || asset.trim().length === 0) {
      throw new BadRequestException(
        '자산 심볼을 입력해주세요. (예: USDT, BTC)',
      );
    }

    if (amount <= 0) {
      throw new BadRequestException('이체 금액은 0보다 커야 합니다.');
    }

    if (fromAccountType === toAccountType) {
      throw new BadRequestException('출발 계좌와 도착 계좌가 동일합니다.');
    }

    try {
      // 2. 이체 실행
      this.logger.log(
        `💸 자금 이체 시작: ${amount} ${asset} (${fromAccountType} → ${toAccountType})`,
      );

      const result = await this.futuresClient.transferFunds(
        asset,
        amount,
        fromAccountType,
        toAccountType,
      );

      this.logger.log(`✅ 자금 이체 완료: ${amount} ${asset}`);
      return {
        asset,
        amount,
        fromAccount: fromAccountType,
        toAccount: toAccountType,
        transferId: result.tranId || result.id || 'unknown',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`❌ 자금 이체 실패: ${asset} ${amount}`, error);

      // 3. 에러 처리
      if (error.message?.includes('insufficient')) {
        throw new BadRequestException(
          `❌ 잔고 부족: ${fromAccountType} 계좌의 ${asset} 잔고가 부족합니다.\n` +
            `💰 이체 요청 금액: ${amount} ${asset}\n` +
            `💡 해결 방법: 잔고를 확인하고 이체 금액을 조정하세요.`,
        );
      }

      throw new BadRequestException(
        `자금 이체에 실패했습니다: ${error.message}\n\n` +
          '💡 가능한 원인:\n' +
          '1. 잔고 부족\n' +
          '2. 최소 이체 금액 미달\n' +
          '3. 포지션에 사용 중인 자금\n' +
          '4. API 키 권한 문제\n' +
          '5. 네트워크 연결 문제',
      );
    }
  }

  /**
   * 🔍 입력값 유효성 검사 (Private Helper Method)
   *
   * 📖 개념: 선물 포지션 진입 시 모든 입력값을 검증하는 안전 장치
   *
   * 🧮 검증 항목:
   * 1. 심볼 유효성: 빈 문자열이나 null 값 차단
   * 2. 수량 유효성: 양수 여부 및 최소 수량 확인
   * 3. 레버리지 유효성: 바이낸스 허용 범위 (1~125배) 확인
   *
   * 💡 바이낸스 선물 거래 제한사항:
   * - 최소 포지션 수량: 0.001 (대부분 코인 기준)
   * - 최대 레버리지: 125배 (리스크 매우 높음)
   * - 권장 레버리지: 1~10배 (안전한 범위)
   *
   * ⚠️ 레버리지별 위험도:
   * - 1~5배: 안전 (초보자 권장)
   * - 6~20배: 중간 위험 (경험자)
   * - 21~50배: 높은 위험 (전문가)
   * - 51~125배: 극도로 위험 (비추천)
   *
   * @param symbol 거래 심볼 (예: BTCUSDT)
   * @param quantity 포지션 수량
   * @param leverage 레버리지 배수
   * @throws BadRequestException 유효하지 않은 입력값 시
   */
  private validatePositionInputs(
    symbol: string,
    quantity: number,
    leverage: number,
  ): void {
    // 🔍 1단계: 심볼 유효성 검사
    if (!symbol || symbol.trim().length === 0) {
      throw new BadRequestException(
        '❌ 거래 심볼을 입력해주세요.\n' + '💡 예시: BTCUSDT, ETHUSDT, ADAUSDT',
      );
    }

    // 🔍 2단계: 포지션 수량 검사
    if (quantity <= 0) {
      throw new BadRequestException(
        '❌ 포지션 수량은 0보다 커야 합니다.\n' +
          '💡 최소 수량: 0.001\n' +
          '📊 권장 수량: 리스크 관리를 고려한 적정 수량',
      );
    }

    // 🔍 3단계: 레버리지 범위 검사
    if (leverage < 1 || leverage > 125) {
      throw new BadRequestException(
        '❌ 레버리지는 1배에서 125배 사이여야 합니다.\n\n' +
          '🎯 레버리지별 권장사항:\n' +
          '• 1~5배: 🟢 안전 (초보자 권장)\n' +
          '• 6~20배: 🟡 중간 위험 (경험자)\n' +
          '• 21~50배: 🟠 높은 위험 (전문가)\n' +
          '• 51~125배: 🔴 극도로 위험 (비추천)\n\n' +
          '💡 팁: 처음에는 1~3배로 시작하세요!',
      );
    }

    // 🔍 4단계: 최소 수량 검증
    // 바이낸스 선물은 코인별로 최소 수량이 다름 (일반적으로 0.001)
    if (quantity < 0.001) {
      throw new BadRequestException(
        '❌ 최소 포지션 수량 미달\n' +
          `📊 입력 수량: ${quantity}\n` +
          '📏 최소 수량: 0.001\n\n' +
          '💡 해결 방법:\n' +
          '1. 수량을 0.001 이상으로 증가\n' +
          '2. 더 높은 가격의 코인 선택\n' +
          '3. 레버리지 조정으로 포지션 크기 조절',
      );
    }

    // 🔍 5단계: 권장 사항 로그 출력
    if (leverage > 10) {
      this.logger.warn(`⚠️ 높은 레버리지 경고: ${leverage}배`);
      this.logger.warn('💡 권장: 10배 이하 레버리지 사용을 권장합니다');
    }

    if (quantity > 1) {
      this.logger.log(`📊 대량 포지션: ${quantity} ${symbol}`);
      this.logger.log('💡 팁: 분할 진입을 고려해보세요');
    }
  }

  /**
   * 💰 현재 시장가 추정 (Private Helper Method)
   *
   * 📖 개념: 포지션 진입 전 필요 마진 계산을 위한 현재 시장가 조회
   *
   * 🧮 가격 조회 방법:
   * 1. 바이낸스 마크 프라이스 API 호출 (가장 정확)
   * 2. 포지션 정보에서 마크 가격 추출 (대안)
   * 3. 최근 거래 가격 사용 (최후 수단)
   *
   * 💡 마크 프라이스란?
   * - 바이낸스에서 청산 계산에 사용하는 공정 가격
   * - 현물 가격과 선물 가격의 가중 평균
   * - 급격한 가격 변동 시 청산 방지 역할
   *
   * 🎯 사용 목적:
   * - 필요 마진 계산: (수량 × 가격) ÷ 레버리지
   * - 청산 가격 예상
   * - 리스크 평가
   *
   * ⚠️ 주의사항:
   * - 실시간 가격 변동으로 실제 체결가와 차이 가능
   * - 네트워크 지연으로 가격 지연 가능
   * - 시장 급변 시 가격 오차 증가
   *
   * @param symbol 가격을 조회할 심볼 (예: BTCUSDT)
   * @returns 현재 추정 시장가 (USDT)
   * @throws BadRequestException 가격 조회 실패 시
   */
  private async getEstimatedPrice(symbol: string): Promise<number> {
    try {
      this.logger.log(`💰 ${symbol} 현재 시장가 조회 중...`);
      // 🚀 1단계: 포지션 정보에서 마크 가격 조회
      // 실제 운영에서는 별도의 마크 프라이스 API 사용 권장
      const rawPositions = await this.futuresClient.getPositions(symbol);

      if (rawPositions && rawPositions.length > 0) {
        const markPrice = parseFloat(rawPositions[0].markPrice);

        // 🔍 2단계: 가격 유효성 검사
        if (markPrice > 0 && isFinite(markPrice)) {
          this.logger.log(
            `✅ ${symbol} 마크 프라이스: ${markPrice.toLocaleString()} USDT`,
          );
          return markPrice;
        }
      }

      // 🔍 3단계: 대안 방법들 (실제 구현에서는 추가 API 호출)
      this.logger.warn(
        `⚠️ ${symbol} 마크 프라이스 조회 실패, 대안 방법 시도 중...`,
      );

      // TODO: 실제 구현에서는 다음 API들 사용:
      // 1. GET /fapi/v1/premiumIndex - 마크 프라이스 직접 조회
      // 2. GET /fapi/v1/ticker/price - 최신 거래 가격
      // 3. GET /fapi/v1/depth - 오더북에서 중간가 계산

      throw new BadRequestException(
        `❌ ${symbol} 현재 가격 조회 실패\n\n` +
          '🔍 가능한 원인:\n' +
          '1. 해당 심볼이 존재하지 않음\n' +
          '2. 거래 일시 중단 상태\n' +
          '3. 네트워크 연결 문제\n' +
          '4. 바이낸스 서버 일시적 오류\n\n' +
          '💡 해결 방법:\n' +
          '1. 심볼명 확인 (예: BTCUSDT)\n' +
          '2. 바이낸스 거래 가능 여부 확인\n' +
          '3. 잠시 후 재시도\n' +
          '4. 다른 심볼로 테스트',
      );
    } catch (error) {
      this.logger.error(`❌ ${symbol} 시장가 조회 실패:`, error);

      // 🔍 에러 타입별 상세 메시지 제공
      if (error.message?.includes('symbol')) {
        throw new BadRequestException(
          `❌ 잘못된 심볼: ${symbol}\n` +
            '💡 올바른 형식: BTCUSDT, ETHUSDT, ADAUSDT\n' +
            '📋 지원 심볼 확인: 바이낸스 선물 거래 페이지 참조',
        );
      }

      if (
        error.message?.includes('network') ||
        error.message?.includes('timeout')
      ) {
        throw new BadRequestException(
          `❌ 네트워크 연결 문제\n` +
            '🌐 인터넷 연결 상태를 확인해주세요\n' +
            '⏰ 잠시 후 다시 시도해주세요',
        );
      }

      throw new BadRequestException(
        `시장가 조회 실패: ${error.message}\n\n` +
          '💡 일반적인 해결 방법:\n' +
          '1. 심볼명 정확성 확인\n' +
          '2. 네트워크 연결 상태 점검\n' +
          '3. 바이낸스 서비스 상태 확인\n' +
          '4. API 키 권한 설정 확인',
      );
    }
  }

  /**
   * 현재 포지션 조회 (단일 심볼)
   * @param symbol 조회할 심볼
   * @returns 현재 포지션 정보 (없으면 null)
   */
  private async getCurrentPosition(symbol: string): Promise<any | null> {
    try {
      const positions = await this.futuresClient.getPositions(symbol);
      const position = positions.find((p: any) => p.symbol === symbol);

      if (!position) {
        return null;
      }

      const positionAmt = parseFloat(position.positionAmt);

      // 포지션이 0이면 없는 것으로 처리
      if (Math.abs(positionAmt) === 0) {
        return null;
      }

      // quantity 필드 추가 (절댓값)
      return {
        ...position,
        quantity: Math.abs(positionAmt),
        side: positionAmt > 0 ? 'LONG' : 'SHORT',
      };
    } catch (error) {
      this.logger.error(`❌ ${symbol} 포지션 조회 실패:`, error);
      return null;
    }
  }

  /**
   * 포지션 스위칭 (롱 ↔ 숏 전환)
   *
   * @param symbol 거래 심볼
   * @param newSide 새로운 포지션 방향
   * @param newQuantity 새로운 포지션 수량
   * @returns 스위칭 결과
   */
  async switchPosition(
    symbol: string,
    newSide: PositionSide,
    newQuantity: number,
  ): Promise<any> {
    try {
      // 1. 현재 포지션 조회
      const currentPosition = await this.getCurrentPosition(symbol);
      if (!currentPosition) {
        throw new BadRequestException(
          `${symbol}에 기존 포지션이 없어서 스위칭할 수 없습니다.`,
        );
      }

      const currentSide = currentPosition.side;
      const currentQuantity = currentPosition.quantity;

      if (currentSide === newSide) {
        throw new BadRequestException(
          `현재 이미 ${currentSide} 포지션입니다. 스위칭이 불필요합니다.`,
        );
      }

      this.logger.log(
        `🔄 포지션 스위칭 시작: ${symbol} ${currentSide} ${currentQuantity} → ${newSide} ${newQuantity}`,
      );

      // 2. 스위칭 실행
      const raw = await this.futuresClient.switchPosition(
        symbol,
        currentSide,
        currentQuantity,
        newQuantity,
      );

      const external = ExternalFuturesOrderResponse.from(raw);
      const response = PositionOpenResponse.from(external);

      this.logger.log(
        `✅ 포지션 스위칭 성공: ${symbol} ${currentSide} → ${newSide} ${newQuantity}`,
      );

      // 스위칭은 청산 + 새 포지션 진입으로 두 개의 이벤트 발행
      // 1. 기존 포지션 청산 이벤트
      const closeEvent = {
        eventId: uuidv4(),
        timestamp: new Date(),
        symbol,
        service: 'FuturesService',
        orderId: `${external.orderId}_close`,
        clientOrderId: '',
        side: currentSide === 'LONG' ? 'SELL' : 'BUY',
        type: 'MARKET',
        quantity: currentQuantity,
        price: parseFloat(external.avgPrice) || 0,
        totalAmount: 0,
        fee: 0,
        feeAsset: 'USDT',
        feeRate: 0,
        status: 'FILLED',
        executedAt: new Date(),
        source: 'FuturesService',
        metadata: {
          positionSide: currentSide,
          isClosing: true,
          closeType: 'SWITCH',
          orderId: external.orderId,
        },
      };
      this.eventEmitter.emit('trade.executed', closeEvent);

      // 2. 새 포지션 진입 이벤트
      const openEvent = {
        eventId: uuidv4(),
        timestamp: new Date(),
        symbol,
        service: 'FuturesService',
        orderId: external.orderId,
        clientOrderId: external.clientOrderId || '',
        side: newSide === 'LONG' ? 'BUY' : 'SELL',
        type: 'MARKET',
        quantity: newQuantity,
        price: parseFloat(external.avgPrice) || 0,
        totalAmount: parseFloat(external.cumQuote) || 0,
        fee: 0,
        feeAsset: 'USDT',
        feeRate: 0,
        status: external.status,
        executedAt: new Date(),
        source: 'FuturesService',
        metadata: {
          positionSide: newSide,
          isSwitch: true,
          previousSide: currentSide,
          orderId: external.orderId,
        },
      };
      this.eventEmitter.emit('trade.executed', openEvent);

      return response;
    } catch (error) {
      this.logger.error(
        `❌ 포지션 스위칭 실패: ${symbol} ${newSide} ${newQuantity}`,
        error,
      );
      throw new InternalServerErrorException(`포지션 스위칭 실패`);
    }
  }

  /**
   * 포지션 수량 증가 (기존 포지션에 추가)
   *
   * @param symbol 거래 심볼
   * @param addQuantity 추가할 수량
   * @returns 추가 결과
   */
  async addToPosition(symbol: string, addQuantity: number): Promise<any> {
    try {
      // 1. 현재 포지션 조회
      const currentPosition = await this.getCurrentPosition(symbol);
      if (!currentPosition) {
        throw new BadRequestException(
          `${symbol}에 기존 포지션이 없어서 추가할 수 없습니다. 새로운 포지션을 진입해주세요.`,
        );
      }

      const currentSide = currentPosition.side;
      this.logger.log(
        `➕ 포지션 추가 시작: ${symbol} ${currentSide} +${addQuantity}`,
      );

      // 2. 포지션 추가 실행
      const raw = await this.futuresClient.addToPosition(
        symbol,
        currentSide,
        addQuantity,
      );

      const external = ExternalFuturesOrderResponse.from(raw);
      const response = PositionOpenResponse.from(external);

      this.logger.log(
        `✅ 포지션 추가 성공: ${symbol} ${currentSide} +${addQuantity}`,
      );

      // 포지션 추가 이벤트 발행
      const tradeExecutedEvent = {
        eventId: uuidv4(),
        timestamp: new Date(),
        symbol,
        service: 'FuturesService',
        orderId: external.orderId,
        clientOrderId: external.clientOrderId || '',
        side: currentSide === 'LONG' ? 'BUY' : 'SELL',
        type: 'MARKET',
        quantity: addQuantity,
        price: parseFloat(external.avgPrice) || 0,
        totalAmount: parseFloat(external.cumQuote) || 0,
        fee: 0,
        feeAsset: 'USDT',
        feeRate: 0,
        status: external.status,
        executedAt: new Date(),
        source: 'FuturesService',
        metadata: {
          positionSide: currentSide,
          isAddition: true,
          orderId: external.orderId,
        },
      };
      this.eventEmitter.emit('trade.executed', tradeExecutedEvent);

      return response;
    } catch (error) {
      this.logger.error(
        `❌ 포지션 추가 실패: ${symbol} +${addQuantity}`,
        error,
      );
      throw new InternalServerErrorException(`포지션 추가 실패`);
    }
  }

  /**
   * 포지션 부분 청산
   *
   * @param symbol 거래 심볼
   * @param reduceQuantity 청산할 수량
   * @returns 부분 청산 결과
   */
  async reducePosition(symbol: string, reduceQuantity: number): Promise<any> {
    try {
      // 1. 현재 포지션 조회
      const currentPosition = await this.getCurrentPosition(symbol);
      if (!currentPosition) {
        throw new BadRequestException(`${symbol}에 청산할 포지션이 없습니다.`);
      }

      const currentSide = currentPosition.side;
      const currentQuantity = currentPosition.quantity;

      if (reduceQuantity >= currentQuantity) {
        throw new BadRequestException(
          `청산 수량이 너무 큽니다. 현재 포지션: ${currentQuantity}, 요청 청산: ${reduceQuantity}`,
        );
      }

      this.logger.log(
        `📉 포지션 부분 청산 시작: ${symbol} ${currentSide} -${reduceQuantity}`,
      );

      // 2. 부분 청산 실행
      const raw = await this.futuresClient.reducePosition(
        symbol,
        currentSide,
        reduceQuantity,
      );

      const external = ExternalFuturesOrderResponse.from(raw);
      const response = PositionOpenResponse.from(external);

      this.logger.log(
        `✅ 포지션 부분 청산 성공: ${symbol} ${currentSide} -${reduceQuantity}`,
      );

      // 부분 청산 이벤트 발행
      const tradeExecutedEvent = {
        eventId: uuidv4(),
        timestamp: new Date(),
        symbol,
        service: 'FuturesService',
        orderId: external.orderId,
        clientOrderId: external.clientOrderId || '',
        side: currentSide === 'LONG' ? 'SELL' : 'BUY',
        type: 'MARKET',
        quantity: reduceQuantity,
        price: parseFloat(external.avgPrice) || 0,
        totalAmount: parseFloat(external.cumQuote) || 0,
        fee: 0,
        feeAsset: 'USDT',
        feeRate: 0,
        status: external.status,
        executedAt: new Date(),
        source: 'FuturesService',
        metadata: {
          positionSide: currentSide,
          isPartialClose: true,
          originalQuantity: currentQuantity,
          remainingQuantity: currentQuantity - reduceQuantity,
          orderId: external.orderId,
        },
      };
      this.eventEmitter.emit('trade.executed', tradeExecutedEvent);

      return response;
    } catch (error) {
      this.logger.error(
        `❌ 포지션 부분 청산 실패: ${symbol} -${reduceQuantity}`,
        error,
      );
      throw new InternalServerErrorException(`포지션 부분 청산 실패`);
    }
  }
}
