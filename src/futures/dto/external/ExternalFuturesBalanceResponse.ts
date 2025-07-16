/**
 * 바이낸스 선물 잔고 정보 API 응답 DTO
 *
 * 바이낸스 /fapi/v2/balance 엔드포인트에서 반환하는 응답 구조입니다.
 * 선물 계정의 모든 자산 잔고 정보를 포함합니다.
 */
export class ExternalFuturesBalanceResponse {
  /** 자산 심볼 (예: USDT, BTC, ETH) */
  asset: string;

  /** 총 잔고 (사용 가능한 잔고 + 포지션에 사용중인 마진) */
  balance: string;

  /** 교차마진 잔고 (교차마진 모드에서 사용 가능한 잔고) */
  crossWalletBalance: string;

  /** 교차마진 미실현 손익 */
  crossUnPnl: string;

  /** 사용 가능한 잔고 (새로운 포지션 진입에 사용 가능) */
  availableBalance: string;

  /** 최대 출금 가능 금액 */
  maxWithdrawAmount: string;

  /** 마진 사용 가능 여부 (해당 자산으로 마진 거래 가능한지) */
  marginAvailable: boolean;

  /** 잔고 업데이트 시간 (Unix timestamp) */
  updateTime: number;

  /**
   * 바이낸스 API 원시 응답을 이 DTO로 변환하는 정적 메서드
   * @param raw 바이낸스 API에서 받은 원시 응답 데이터
   * @returns 변환된 ExternalFuturesBalanceResponse 객체
   */
  static from(raw: any): ExternalFuturesBalanceResponse {
    const response = new ExternalFuturesBalanceResponse();
    response.asset = raw.asset;
    response.balance = raw.balance;
    response.crossWalletBalance = raw.crossWalletBalance;
    response.crossUnPnl = raw.crossUnPnl;
    response.availableBalance = raw.availableBalance;
    response.maxWithdrawAmount = raw.maxWithdrawAmount;
    response.marginAvailable = raw.marginAvailable;
    response.updateTime = raw.updateTime;
    return response;
  }

  /**
   * 배열 형태의 바이낸스 API 응답을 DTO 배열로 변환
   * @param rawList 바이낸스 API에서 받은 원시 응답 배열
   * @returns 변환된 ExternalFuturesBalanceResponse 배열
   */
  static fromList(rawList: any[]): ExternalFuturesBalanceResponse[] {
    return rawList.map((raw) => ExternalFuturesBalanceResponse.from(raw));
  }
}
