// src/market-data/controller/market-data.gateway.ts
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true })
export class MarketDataGateway {
  @WebSocketServer()
  server: Server;

  sendTradeData(data: any) {
    console.log('📤 클라이언트로 전송:', data); // ← 이거 꼭 추가해봐
    this.server.emit('trade', data);
  }
}
