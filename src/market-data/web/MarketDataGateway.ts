// src/market-data/controller/market-data.gateway.ts
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { TradeTickResponse } from '../dto/TradeTickResponse';
import { ExternalTradeTickResponse } from '../dto/ExternalTradeTickResponse';

@WebSocketGateway({ cors: true })
export class MarketDataGateway {
  @WebSocketServer()
  server: Server;

  sendTradeData(data: ExternalTradeTickResponse) {
    const response = TradeTickResponse.from(data);
    console.log('📤 클라이언트로 전송:', response);
    this.server.emit('trade', response);
  }
}
