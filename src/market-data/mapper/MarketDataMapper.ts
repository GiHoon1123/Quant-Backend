// 마켓데이터 도메인 매퍼 예시
import { Candle15MResponse } from '../dto/response/candle/Candle15MResponse';
import { Candle15MEntity } from '../infra/persistence/entity/Candle15MEntity';

export class MarketDataMapper {
  static toCandle15MResponse(entity: Candle15MEntity): Candle15MResponse {
    return {
      openTime: entity.openTime.getTime(),
      closeTime: entity.closeTime.getTime(),
      open: entity.open,
      close: entity.close,
      high: entity.high,
      low: entity.low,
      volume: entity.volume,
      symbol: entity.symbol,
      market: entity.market,
      timeframe: entity.timeframe,
    };
  }
}
