import { BadRequestException, Injectable } from '@nestjs/common';
import { BinanceFuturesClient } from '../infra/BinanceFuturesClient';
import { BinanceFuturesPositionClient } from '../infra/BinanceFuturesPositionClient';
import { PositionSide } from '../dto/request/OpenPositionRequest';
import { MarginType } from '../dto/request/SetMarginTypeRequest';
import { ExternalFuturesOrderResponse } from '../dto/external/ExternalFuturesOrderResponse';
import { ExternalPositionResponse } from '../dto/external/ExternalPositionResponse';
import { ExternalFuturesBalanceResponse } from '../dto/external/ExternalFuturesBalanceResponse';
import { PositionOpenResponse } from '../dto/response/PositionOpenResponse';
import { PositionInfoResponse } from '../dto/response/PositionInfoResponse';
import { FuturesBalanceResponse } from '../dto/response/FuturesBalanceResponse';

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
  constructor(
    private readonly futuresClient: BinanceFuturesClient,
    private readonly positionClient: BinanceFuturesPositionClient,
  ) {}

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
    if (notionalValue < 5) {
      throw new BadRequestException(
        `선물 포지션은 최소 5 USDT 이상이어야 합니다. (현재: ${notionalValue.toFixed(2)} USDT)`,
      );
    }

    // 6. 기존 포지션 확인 및 경고
    if (balanceCheck.hasExistingPosition) {
      console.warn(
        `⚠️ 경고: ${symbol}에 기존 포지션이 존재합니다. 추가 포지션을 진입합니다.`,
      );
    }

    try {
      // 7. 포지션 진입 실행
      const orderSide = side === PositionSide.LONG ? 'BUY' : 'SELL';
      const raw = await this.futuresClient.openPosition(
        symbol,
        orderSide,
        quantity,
        side,
      );

      // 8. 응답 변환
      const external = ExternalFuturesOrderResponse.from(raw);
      const response = PositionOpenResponse.from(external);

      console.log(
        `✅ 선물 포지션 진입 성공: ${symbol} ${side} ${quantity} (레버리지: ${leverage}x)`,
      );
      return response;
    } catch (error) {
      console.error(`❌ 선물 포지션 진입 실패: ${symbol} ${side}`, error);
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
      console.log(
        `✅ 선물 포지션 ${actionText} 성공: ${symbol} ${positionSide} ${quantity || positionQuantity}`,
      );

      return response;
    } catch (error) {
      console.error(`❌ 선물 포지션 청산 실패: ${symbol}`, error);
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
      console.log(`✅ 레버리지 설정 성공: ${symbol} ${leverage}x`);
      return result;
    } catch (error) {
      console.error(`❌ 레버리지 설정 실패: ${symbol} ${leverage}x`, error);

      // 이미 설정된 레버리지인 경우는 에러가 아님
      if (error.message?.includes('leverage not modified')) {
        console.log(`ℹ️ 레버리지 이미 설정됨: ${symbol} ${leverage}x`);
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
      console.log(`✅ 마진 모드 설정 성공: ${symbol} ${marginType}`);
      return result;
    } catch (error) {
      console.error(`❌ 마진 모드 설정 실패: ${symbol} ${marginType}`, error);

      // 이미 설정된 마진 모드인 경우는 에러가 아님
      if (error.message?.includes('No need to change margin type')) {
        console.log(`ℹ️ 마진 모드 이미 설정됨: ${symbol} ${marginType}`);
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
      console.error('❌ 포지션 정보 조회 실패:', error);
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
      console.error('❌ 선물 잔고 조회 실패:', error);
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
      const highRiskPositions =
        await this.positionClient.getHighRiskPositions(riskThreshold);
      return PositionInfoResponse.fromList(highRiskPositions);
    } catch (error) {
      console.error('❌ 위험 포지션 조회 실패:', error);
      throw new BadRequestException(
        `위험 포지션 조회에 실패했습니다: ${error.message}`,
      );
    }
  }

  /**
   * 입력값 유효성 검사 (private 메서드)
   */
  private validatePositionInputs(
    symbol: string,
    quantity: number,
    leverage: number,
  ): void {
    if (!symbol || symbol.trim().length === 0) {
      throw new BadRequestException('거래 심볼을 입력해주세요.');
    }

    if (quantity <= 0) {
      throw new BadRequestException('포지션 수량은 0보다 커야 합니다.');
    }

    if (leverage < 1 || leverage > 125) {
      throw new BadRequestException(
        '레버리지는 1배에서 125배 사이여야 합니다.',
      );
    }

    // 최소 수량 검증 (코인별로 다를 수 있음, 일반적으로 0.001)
    if (quantity < 0.001) {
      throw new BadRequestException('최소 포지션 수량은 0.001입니다.');
    }
  }

  /**
   * 현재 시장가 추정 (private 메서드)
   * 실제로는 바이낸스 마크 프라이스 API를 호출해야 하지만,
   * 여기서는 간단히 포지션 정보에서 마크 가격을 가져옵니다.
   */
  private async getEstimatedPrice(symbol: string): Promise<number> {
    try {
      // 포지션 정보에서 현재 마크 가격 조회
      const rawPositions = await this.futuresClient.getPositions(symbol);
      if (rawPositions && rawPositions.length > 0) {
        return parseFloat(rawPositions[0].markPrice);
      }

      // 기본값 (실제로는 별도 API 호출 필요)
      throw new BadRequestException(
        `${symbol}의 현재 가격을 조회할 수 없습니다.`,
      );
    } catch (error) {
      throw new BadRequestException(`시장가 조회 실패: ${error.message}`);
    }
  }
}
