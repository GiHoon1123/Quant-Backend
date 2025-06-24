import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { ExternalKlineResponse } from 'src/market-data/dto/kline/ExternalKlineResponse';
import { KlineResponse } from 'src/market-data/dto/kline/KlineResponse';

@WebSocketGateway({ cors: true })
export class KlineGateway {
  @WebSocketServer()
  server: Server;

  async sendKlinedata(data: ExternalKlineResponse) {
    const response = KlineResponse.fromWebSocket(data);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.log(`[${new Date().toISOString()}] 캔들 차트 전송 완료: ${data.s}`);

    this.server.emit(`kline:${data.s}`, response);
  }
}
