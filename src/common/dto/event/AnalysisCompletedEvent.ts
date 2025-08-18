import { BaseEventDto } from './BaseEventDto';

/**
 * 기술적 분석 완료 이벤트 (공통)
 * - signal: 분석 신호
 * - analyzedAt: 분석 완료 시각
 *
 * @swagger
 * components:
 *   schemas:
 *     AnalysisCompletedEvent:
 *       allOf:
 *         - $ref: '#/components/schemas/BaseEventDto'
 *         - type: object
 *           properties:
 *             signal:
 *               type: string
 *               description: 분석 신호
 *             analyzedAt:
 *               type: string
 *               format: date-time
 *               description: 분석 완료 시각
 *
 * @typedef {object} AnalysisCompletedEvent
 * @property {string} signal - 분석 신호
 * @property {Date} analyzedAt - 분석 완료 시각
 */
export interface AnalysisCompletedEvent extends BaseEventDto {
  signal: string;
  analyzedAt: Date;
}
