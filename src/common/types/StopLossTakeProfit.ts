/**
 * 손절/익절 설정 관련 공통 타입 정의
 *
 * @description 현물/선물 거래에서 공통으로 사용되는 손절/익절 관련 타입들을 정의합니다.
 * 퍼센트 또는 절대가격으로 설정할 수 있으며, 미설정 상태도 지원합니다.
 */

/**
 * 손절/익절 설정 타입
 *
 * @description 사용자가 손절/익절을 설정하는 방식을 정의합니다.
 * - PERCENT: 진입가 기준 퍼센트로 설정 (예: 5% 하락 시 손절)
 * - PRICE: 절대 가격으로 설정 (예: 50,000 USDT에서 손절)
 * - NONE: 미설정 (손절/익절 없음)
 */
export enum StopLossTakeProfitType {
  PERCENT = 'PERCENT', // 퍼센트 기준 설정
  PRICE = 'PRICE', // 절대 가격 설정
  NONE = 'NONE', // 미설정
}

/**
 * 손절 설정 인터페이스
 *
 * @description 손절가 설정을 위한 데이터 구조입니다.
 * type이 NONE이면 value는 무시되고, 손절이 설정되지 않습니다.
 */
export interface StopLossConfig {
  /** 손절 설정 타입 (퍼센트/가격/미설정) */
  type: StopLossTakeProfitType;

  /**
   * 손절 값
   * - PERCENT일 때: 0.05 = 5% 하락 시 손절
   * - PRICE일 때: 실제 손절가 (USDT 기준)
   * - NONE일 때: 무시됨
   */
  value?: number;
}

/**
 * 익절 설정 인터페이스
 *
 * @description 익절가 설정을 위한 데이터 구조입니다.
 * type이 NONE이면 value는 무시되고, 익절이 설정되지 않습니다.
 */
export interface TakeProfitConfig {
  /** 익절 설정 타입 (퍼센트/가격/미설정) */
  type: StopLossTakeProfitType;

  /**
   * 익절 값
   * - PERCENT일 때: 0.10 = 10% 상승 시 익절
   * - PRICE일 때: 실제 익절가 (USDT 기준)
   * - NONE일 때: 무시됨
   */
  value?: number;
}

/**
 * 계산된 손절/익절 가격 결과
 *
 * @description 퍼센트나 기타 설정을 바탕으로 계산된 실제 손절/익절 가격입니다.
 * null인 경우 해당 기능이 미설정된 것을 의미합니다.
 */
export interface CalculatedStopLossTakeProfit {
  /** 계산된 손절가 (USDT 기준, null이면 미설정) */
  stopLossPrice: number | null;

  /** 계산된 익절가 (USDT 기준, null이면 미설정) */
  takeProfitPrice: number | null;
}
