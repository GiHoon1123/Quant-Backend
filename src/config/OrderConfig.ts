// 주문(Order) 도메인 공통 설정값 및 상수
export default {
  minOrderNotional: 10, // 최소 주문 금액 (USDT)
  feeRate: 0.001, // 바이낸스 기본 수수료율 0.1%
  majorAssets: ['USDT', 'BTC', 'ETH', 'BNB'], // 주요 자산 리스트
};
