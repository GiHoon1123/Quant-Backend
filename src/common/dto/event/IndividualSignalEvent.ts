import { BaseEventDto } from './BaseEventDto';

/**
 * @swagger
 * components:
 *   schemas:
 *     IndividualSignalEvent:
 *       allOf:
 *         - $ref: '#/components/schemas/BaseEventDto'
 *         - type: object
 *           properties:
 *             signalType:
 *               type: string
 *               description: 신호 타입
 *             timeframe:
 *               type: string
 *               description: 신호 발생 시간 프레임
 *             currentPrice:
 *               type: number
 *               description: 현재 가격(옵션)
 *
 * @typedef {object} IndividualSignalEvent
 * @property {string} signalType - 신호 타입
 * @property {string} timeframe - 신호 발생 시간 프레임
 * @property {number} [currentPrice] - 현재 가격(옵션)
 */

/**
 * 개별 전략 신호 이벤트 (공통)
 * - signalType: 신호 타입
 * - timeframe: 신호 발생 시간 프레임
 * - currentPrice: 현재 가격(옵션)
 */
export interface IndividualSignalEvent extends BaseEventDto {
  signalType: string;
  timeframe: string;
  currentPrice?: number;
}
