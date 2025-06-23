import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { ExternalKlineResponse } from 'src/market-data/dto/kline/ExternalKlineResponse';
import { KlineResponse } from 'src/market-data/dto/kline/KlineResponse';

@WebSocketGateway({ cors: true })
export class KlineGateway {
  @WebSocketServer()
  server: Server;

  sendKlinedata(data: ExternalKlineResponse) {
    const response = KlineResponse.from(data);
    console.log('📤 캔들차트 전송:', response);
    this.server.emit(`kline:${data.s}`, response);
  }
}
