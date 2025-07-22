import { CandleData } from '../../../market-data/infra/persistence/entity/Candle15MEntity';
import { BaseEventDto } from './BaseEventDto';

/**
 * @swagger
 * components:
 *   schemas:
 *     CandleCompletedEvent:
 *       allOf:
 *         - $ref: '#/components/schemas/BaseEventDto'
 *         - type: object
 *           properties:
 *             market:
 *               type: string
 *               enum: [FUTURES, SPOT]
 *               description: 시장 종류
 *             timeframe:
 *               type: string
 *               description: 캔들 시간 프레임
 *             candle:
 *               $ref: '#/components/schemas/CandleData'
 *               description: 캔들 데이터
 *
 * @typedef {object} CandleCompletedEvent
 * @property {'FUTURES'|'SPOT'} market - 시장 종류
 * @property {string} timeframe - 캔들 시간 프레임
 * @property {CandleData} candle - 캔들 데이터
 */
export interface CandleCompletedEvent extends BaseEventDto {
  market: 'FUTURES' | 'SPOT';
  timeframe: string;
  candle: CandleData;
}
