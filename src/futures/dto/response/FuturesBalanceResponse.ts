import { ExternalFuturesBalanceResponse } from '../external/ExternalFuturesBalanceResponse';

/**
 * 선물 잔고 정보 응답 DTO
 *
 * 선물 계정의 자산 잔고 정보를 사용자 친화적인 형태로 제공합니다.
 * 사용 가능한 잔고, 포지션에 사용중인 마진 등의 정보를 포함합니다.
 */
export class FuturesBalanceResponse {
  /** 자산 심볼 (예: USDT, BTC, ETH) */
  asset: string;

  /** 총 잔고 (사용 가능한 잔고 + 포지션 마진 + 미실현 손익) */
  totalBalance: number;

  /** 사용 가능한 잔고 (새로운 포지션 진입에 사용 가능) */
  availableBalance: number;

  /** 최대 출금 가능 금액 */
  maxWithdrawAmount: number;

  /** 교차마진 잔고 (교차마진 모드에서 사용되는 잔고) */
  crossWalletBalance: number;

  /** 교차마진 미실현 손익 */
  crossUnrealizedPnl: number;

  /** 마진 거래 사용 가능 여부 */
  marginAvailable: boolean;

  /** 마지막 업데이트 시간 */
  updateTime: Date;

  /**
   * 외부 바이낸스 API 응답을 내부 응답 DTO로 변환
   * @param external 바이낸스 API에서 받은 외부 응답 DTO
   * @returns 변환된 FuturesBalanceResponse 객체
   */
  static from(
    external: ExternalFuturesBalanceResponse,
  ): FuturesBalanceResponse {
    const response = new FuturesBalanceResponse();

    response.asset = external.asset;
    response.totalBalance = parseFloat(external.balance);
    response.availableBalance = parseFloat(external.availableBalance);
    response.maxWithdrawAmount = parseFloat(external.maxWithdrawAmount);
    response.crossWalletBalance = parseFloat(external.crossWalletBalance);
    response.crossUnrealizedPnl = parseFloat(external.crossUnPnl);
    response.marginAvailable = external.marginAvailable;
    response.updateTime = new Date(external.updateTime);

    return response;
  }

  /**
   * 배열 형태의 외부 응답을 내부 응답 배열로 변환
   * 잔고가 0보다 큰 자산만 필터링하여 반환
   * @param externalList 외부 응답 DTO 배열
   * @returns 잔고가 있는 FuturesBalanceResponse 배열
   */
  static fromList(
    externalList: ExternalFuturesBalanceResponse[],
  ): FuturesBalanceResponse[] {
    return externalList
      .map((external) => FuturesBalanceResponse.from(external))
      .filter((balance) => balance.totalBalance > 0); // 잔고가 있는 것만 반환
  }
}
