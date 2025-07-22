/**
 * @swagger
 * components:
 *   schemas:
 *     BaseEventDto:
 *       type: object
 *       properties:
 *         eventId:
 *           type: string
 *           description: 이벤트 고유 ID
 *         symbol:
 *           type: string
 *           description: 자산/종목 코드
 *         service:
 *           type: string
 *           description: 이벤트 발생 서비스명
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: 이벤트 발생 시각
 *
 * @typedef {object} BaseEventDto
 * @property {string} eventId - 이벤트 고유 ID
 * @property {string} symbol - 자산/종목 코드
 * @property {string} service - 이벤트 발생 서비스명
 * @property {Date} timestamp - 이벤트 발생 시각
 */
export interface BaseEventDto {
  eventId: string;
  symbol: string;
  service: string;
  timestamp: Date;
}
