import { BaseEventDto } from './BaseEventDto';

/**
 * 포지션 오픈/클로즈 이벤트 (공통)
 *
 * @swagger
 * components:
 *   schemas:
 *     PositionOpenedEvent:
 *       allOf:
 *         - $ref: '#/components/schemas/BaseEventDto'
 *         - type: object
 *           properties:
 *             side:
 *               type: string
 *               enum: [LONG, SHORT]
 *               description: 포지션 방향
 *             quantity:
 *               type: number
 *               description: 포지션 수량
 *             leverage:
 *               type: number
 *               description: 레버리지 배수
 *             notional:
 *               type: number
 *               description: 명목 금액
 *             source:
 *               type: string
 *               description: 이벤트 소스
 *             metadata:
 *               type: object
 *               description: 추가 메타데이터
 *     PositionClosedEvent:
 *       allOf:
 *         - $ref: '#/components/schemas/BaseEventDto'
 *         - type: object
 *           properties:
 *             side:
 *               type: string
 *               enum: [LONG, SHORT]
 *               description: 포지션 방향
 *             quantity:
 *               type: number
 *               description: 포지션 수량
 *             source:
 *               type: string
 *               description: 이벤트 소스
 *             metadata:
 *               type: object
 *               description: 추가 메타데이터
 *
 * @typedef {object} PositionOpenedEvent
 * @property {'LONG'|'SHORT'} side - 포지션 방향
 * @property {number} quantity - 포지션 수량
 * @property {number} leverage - 레버리지 배수
 * @property {number} notional - 명목 금액
 * @property {string} source - 이벤트 소스
 * @property {object} [metadata] - 추가 메타데이터
 *
 * @typedef {object} PositionClosedEvent
 * @property {'LONG'|'SHORT'} side - 포지션 방향
 * @property {number} quantity - 포지션 수량
 * @property {string} source - 이벤트 소스
 * @property {object} [metadata] - 추가 메타데이터
 */
export interface PositionOpenedEvent extends BaseEventDto {
  side: 'LONG' | 'SHORT';
  quantity: number;
  leverage: number;
  notional: number;
  source: string;
  metadata?: Record<string, any>;
}

export interface PositionClosedEvent extends BaseEventDto {
  side: 'LONG' | 'SHORT';
  quantity: number;
  source: string;
  metadata?: Record<string, any>;
}
