import { BaseEventDto } from './BaseEventDto';

/**
 * 거래 체결 이벤트 (공통)
 * - orderId, clientOrderId, side, type, quantity, price 등
 *
 * @swagger
 * components:
 *   schemas:
 *     TradeExecutedEvent:
 *       allOf:
 *         - $ref: '#/components/schemas/BaseEventDto'
 *         - type: object
 *           properties:
 *             orderId:
 *               type: string
 *               description: 거래 주문 ID
 *             clientOrderId:
 *               type: string
 *               description: 클라이언트 주문 ID
 *             side:
 *               type: string
 *               enum: [BUY, SELL]
 *               description: 거래 방향
 *             type:
 *               type: string
 *               enum: [MARKET, LIMIT]
 *               description: 주문 유형
 *             quantity:
 *               type: number
 *               description: 거래 수량
 *             price:
 *               type: number
 *               description: 거래 가격
 *             totalAmount:
 *               type: number
 *               description: 총 거래 금액
 *             fee:
 *               type: number
 *               description: 거래 수수료
 *             feeAsset:
 *               type: string
 *               description: 수수료 자산
 *             feeRate:
 *               type: number
 *               description: 수수료율
 *             status:
 *               type: string
 *               description: 거래 상태
 *             executedAt:
 *               type: string
 *               format: date-time
 *               description: 거래 체결 시각
 *             source:
 *               type: string
 *               description: 거래 소스
 *             metadata:
 *               type: object
 *               description: 추가 메타데이터
 *
 * @typedef {object} TradeExecutedEvent
 * @property {string} orderId - 거래 주문 ID
 * @property {string} clientOrderId - 클라이언트 주문 ID
 * @property {'BUY'|'SELL'} side - 거래 방향
 * @property {'MARKET'|'LIMIT'} type - 주문 유형
 * @property {number} quantity - 거래 수량
 * @property {number} price - 거래 가격
 * @property {number} totalAmount - 총 거래 금액
 * @property {number} fee - 거래 수수료
 * @property {string} feeAsset - 수수료 자산
 * @property {number} feeRate - 수수료율
 * @property {string} status - 거래 상태
 * @property {Date} executedAt - 거래 체결 시각
 * @property {string} source - 거래 소스
 * @property {object} [metadata] - 추가 메타데이터
 */
export interface TradeExecutedEvent extends BaseEventDto {
  orderId: string;
  clientOrderId: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  price: number;
  totalAmount: number;
  fee: number;
  feeAsset: string;
  feeRate: number;
  status: string;
  executedAt: Date;
  source: string;
  metadata?: Record<string, any>;
}
