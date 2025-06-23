// src/market-data/controller/market-data.gateway.ts
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { ExternalTradeResponse } from 'src/market-data/dto/trade/ExternalTradeResponse';
import { TradeResponse } from 'src/market-data/dto/trade/TradeResponse';

@WebSocketGateway({ cors: true })
export class TradeGateway {
  @WebSocketServer()
  server: Server;

  sendTradeData(data: ExternalTradeResponse) {
    const response = TradeResponse.from(data);
    console.log('📤 체결내역 전송:', response);
    this.server.emit(`trade:${data.s}`, response);
  }
}
