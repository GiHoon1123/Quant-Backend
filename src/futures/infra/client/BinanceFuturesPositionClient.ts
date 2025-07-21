import { Injectable } from '@nestjs/common';
import { ExternalFuturesBalanceResponse } from '../../dto/external/ExternalFuturesBalanceResponse';
import { ExternalPositionResponse } from '../../dto/external/ExternalPositionResponse';
import { BinanceFuturesClient } from './BinanceFuturesClient';

/**
 * 바이낸스 선물 포지션 관리 클라이언트
 *
 * 바이낸스 선물 API를 래핑하여 포지션 관련 고수준 기능을 제공합니다.
 * BinanceFuturesClient의 복잡한 API 호출을 단순화하여 사용하기 쉽게 만듭니다.
 *
 * 주요 기능:
 * - 포지션 정보 조회 및 필터링
 * - 잔고 정보 조회 및 가공
 * - 포지션 존재 여부 확인
 * - 특정 조건에 맞는 포지션 검색
 */
@Injectable()
export class BinanceFuturesPositionClient {
  constructor(private readonly futuresClient: BinanceFuturesClient) {}

  /**
   * 활성 포지션만 조회 (수량이 0이 아닌 포지션)
   *
   * @param symbol 특정 심볼만 조회 (선택사항)
   * @returns 활성 포지션 정보 배열
   *
   * 💡 활성 포지션: positionAmt가 0이 아닌 포지션
   * 바이낸스는 모든 심볼에 대해 포지션 정보를 반환하지만,
   * 실제 포지션이 있는 것만 필터링하여 반환합니다.
   */
  async getActivePositions(
    symbol?: string,
  ): Promise<ExternalPositionResponse[]> {
    const rawPositions = await this.futuresClient.getPositions(symbol);
    const positions = ExternalPositionResponse.fromList(rawPositions);

    // 포지션 수량이 0이 아닌 것만 필터링 (실제 포지션이 있는 것)
    return positions.filter(
      (position) => parseFloat(position.positionAmt) !== 0,
    );
  }

  /**
   * 특정 심볼의 포지션 존재 여부 확인
   *
   * @param symbol 확인할 심볼
   * @returns 포지션 존재 여부
   *
   * 🔍 사용 예시: 새로운 포지션 진입 전 기존 포지션 확인
   */
  async hasPosition(symbol: string): Promise<boolean> {
    const activePositions = await this.getActivePositions(symbol);
    return activePositions.length > 0;
  }

  /**
   * 특정 심볼의 특정 방향 포지션 조회
   *
   * @param symbol 조회할 심볼
   * @param side 포지션 방향 (LONG 또는 SHORT)
   * @returns 해당 포지션 정보 (없으면 null)
   *
   * 💡 양방향 포지션 모드에서는 같은 심볼에 LONG과 SHORT 포지션이 동시에 존재할 수 있습니다
   */
  async getPositionBySide(
    symbol: string,
    side: 'LONG' | 'SHORT',
  ): Promise<ExternalPositionResponse | null> {
    const activePositions = await this.getActivePositions(symbol);

    const position = activePositions.find((pos) => {
      const positionAmt = parseFloat(pos.positionAmt);

      if (side === 'LONG' && positionAmt > 0) return true;
      if (side === 'SHORT' && positionAmt < 0) return true;

      return false;
    });

    return position || null;
  }

  /**
   * 손익이 발생하고 있는 포지션만 조회
   *
   * @param minPnlThreshold 최소 손익 임계값 (USDT 기준, 기본값: 1)
   * @returns 손익이 임계값을 넘는 포지션 배열
   *
   * 📈 사용 예시:
   * - 수익 실현이 가능한 포지션 찾기
   * - 손실 제한이 필요한 포지션 찾기
   */
  async getPositionsWithPnl(
    minPnlThreshold: number = 1,
  ): Promise<ExternalPositionResponse[]> {
    const activePositions = await this.getActivePositions();

    return activePositions.filter((position) => {
      const unrealizedPnl = Math.abs(parseFloat(position.unRealizedProfit));
      return unrealizedPnl >= minPnlThreshold;
    });
  }

  /**
   * 청산 위험이 높은 포지션 조회
   *
   * @param riskThreshold 위험 임계값 (유지마진율 기준, 기본값: 0.8 = 80%)
   * @returns 청산 위험이 높은 포지션 배열
   *
   * ⚠️ 위험 신호: 유지마진율이 높을수록 청산에 가까워집니다
   * 일반적으로 80% 이상이면 매우 위험한 상태입니다
   */
  async getHighRiskPositions(
    riskThreshold: number = 0.8,
  ): Promise<ExternalPositionResponse[]> {
    const activePositions = await this.getActivePositions();

    return activePositions.filter((position) => {
      const maintMarginRatio = parseFloat(position.maintMarginRatio);
      return maintMarginRatio >= riskThreshold;
    });
  }

  /**
   * 사용 가능한 선물 잔고 조회 (잔고가 있는 자산만)
   *
   * @returns 잔고가 있는 자산 정보 배열
   *
   * 💰 주요 정보:
   * - 총 잔고 (포지션 마진 포함)
   * - 사용 가능한 잔고 (새 포지션 진입 가능)
   * - 최대 출금 가능 금액
   */
  async getAvailableBalances(): Promise<ExternalFuturesBalanceResponse[]> {
    const rawBalances = await this.futuresClient.getFuturesBalance();
    const balances = ExternalFuturesBalanceResponse.fromList(rawBalances);

    // 잔고가 0보다 큰 자산만 필터링
    return balances.filter((balance) => parseFloat(balance.balance) > 0);
  }

  /**
   * USDT 잔고 정보 조회
   *
   * @returns USDT 잔고 정보 (없으면 null)
   *
   * 💡 선물거래에서 USDT는 가장 중요한 마진 자산입니다
   * 새로운 포지션 진입 가능 여부를 확인할 때 주로 사용됩니다
   */
  async getUSDTBalance(): Promise<ExternalFuturesBalanceResponse | null> {
    const balances = await this.getAvailableBalances();
    return balances.find((balance) => balance.asset === 'USDT') || null;
  }

  /**
   * 포지션 진입 가능 여부 확인
   *
   * @param symbol 진입하려는 심볼
   * @param requiredMargin 필요한 마진 (USDT 기준)
   * @returns 진입 가능 여부와 관련 정보
   *
   * 🔍 검사 항목:
   * - USDT 잔고 충분성
   * - 기존 포지션 존재 여부
   * - 반대 방향 포지션 존재 여부
   */
  async canOpenPosition(
    symbol: string,
    requiredMargin: number,
  ): Promise<{
    canOpen: boolean;
    reason?: string;
    availableBalance?: number;
    hasExistingPosition?: boolean;
  }> {
    // USDT 잔고 확인
    const usdtBalance = await this.getUSDTBalance();
    if (!usdtBalance) {
      return {
        canOpen: false,
        reason: 'USDT 잔고가 없습니다',
        availableBalance: 0,
      };
    }

    const availableBalance = parseFloat(usdtBalance.availableBalance);
    if (availableBalance < requiredMargin) {
      return {
        canOpen: false,
        reason: `사용 가능한 USDT 잔고(${availableBalance.toFixed(2)})가 필요 마진(${requiredMargin})보다 부족합니다`,
        availableBalance,
      };
    }

    // 기존 포지션 확인
    const hasExistingPosition = await this.hasPosition(symbol);

    return {
      canOpen: true,
      availableBalance,
      hasExistingPosition,
    };
  }
}
