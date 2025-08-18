// 선물(Futures) 도메인 공통 설정값 및 상수
export default () => ({
  minOrderNotional: 5, // 최소 주문 금액 (USDT)
  defaultRiskThreshold: 0.8, // VaR 기반으로 변경 예정 (기존: 0.8)
});
