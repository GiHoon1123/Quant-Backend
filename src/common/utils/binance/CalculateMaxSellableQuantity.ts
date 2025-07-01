import { BINANCE_STEP_SIZES } from 'src/common/constant/BinanceStepSizes';

/**
 * 사용자의 자산 잔고에서 거래 수수료(0.1%)를 감안하여
 * 심볼별 stepSize에 맞는 최대 주문 가능 수량을 계산한다.
 */
export function calculateMaxSellableQuantity(
  symbol: string,
  freeBalance: number,
  feeRate = 0.001, // Binance 기본 수수료: 0.1%
): number {
  const stepSizeStr = BINANCE_STEP_SIZES[symbol.toUpperCase()];
  if (!stepSizeStr) {
    throw new Error(`stepSize 정보가 존재하지 않습니다: ${symbol}`);
  }

  const stepSize = parseFloat(stepSizeStr);
  const precision = Math.round(-Math.log10(stepSize));

  // 수수료 포함해서 실제 주문 가능한 수량
  const availableQty = freeBalance / (1 + feeRate);

  // stepSize에 맞게 내림
  const flooredQty = Math.floor(availableQty / stepSize) * stepSize;

  return parseFloat(flooredQty.toFixed(precision));
}
