import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CandleData } from '../../market-data/infra/persistence/entity/Candle15MEntity';
import { Candle15MService } from '../../market-data/service/candle/Candle15MService';

@ApiTags('테스트')
@Controller('test/candle15m')
export class TestCandleController {
  constructor(private readonly candle15MService: Candle15MService) {}

  /**
   * 15분봉 캔들 테스트용 API
   * 심볼과 캔들 데이터를 받아 DB 저장 및 이벤트 발송까지 트리거
   * @param body { symbol: string, candleData: CandleData }
   */
  @Post()
  @ApiOperation({
    summary: '15분봉 캔들 테스트',
    description:
      '임의의 15분봉 캔들 데이터를 입력하면 DB 저장 및 이벤트 발송까지 전체 체인을 트리거합니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          example: 'BTCUSDT',
          description: '거래 심볼',
        },
        candleData: {
          type: 'object',
          properties: {
            openTime: {
              type: 'number',
              example: 1721700000000,
              description: '캔들 시작 시간(Unix timestamp)',
            },
            closeTime: {
              type: 'number',
              example: 1721700899999,
              description: '캔들 종료 시간(Unix timestamp)',
            },
            open: { type: 'number', example: 30000.0, description: '시가' },
            high: { type: 'number', example: 30100.0, description: '고가' },
            low: { type: 'number', example: 29900.0, description: '저가' },
            close: { type: 'number', example: 30050.0, description: '종가' },
            volume: { type: 'number', example: 123.45, description: '거래량' },
            quoteVolume: {
              type: 'number',
              example: 3700000.0,
              description: '거래대금',
            },
            trades: { type: 'number', example: 100, description: '거래 횟수' },
            takerBuyBaseVolume: {
              type: 'number',
              example: 60.0,
              description: '능동 매수 거래량',
            },
            takerBuyQuoteVolume: {
              type: 'number',
              example: 1800000.0,
              description: '능동 매수 거래대금',
            },
          },
          required: [
            'openTime',
            'closeTime',
            'open',
            'high',
            'low',
            'close',
            'volume',
            'quoteVolume',
            'trades',
            'takerBuyBaseVolume',
            'takerBuyQuoteVolume',
          ],
        },
      },
      required: ['symbol', 'candleData'],
      example: {
        symbol: 'BTCUSDT',
        candleData: {
          openTime: 1721700000000,
          closeTime: 1721700899999,
          open: 30000.0,
          high: 30100.0,
          low: 29900.0,
          close: 30050.0,
          volume: 123.45,
          quoteVolume: 3700000.0,
          trades: 100,
          takerBuyBaseVolume: 60.0,
          takerBuyQuoteVolume: 1800000.0,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '테스트 성공 시',
    schema: {
      example: {
        success: true,
        result: {
          /* 저장된 엔티티 정보 */
        },
      },
    },
  })
  async testCandle(@Body() body: { symbol: string; candleData: CandleData }) {
    const { symbol, candleData } = body;
    const result = await this.candle15MService.processTestCandle(
      symbol,
      candleData,
    );
    return { success: true, result };
  }
}
