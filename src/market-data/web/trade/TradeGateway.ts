import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { ExternalTradeResponse } from 'src/market-data/dto/trade/ExternalTradeResponse';
import { TradeResponse } from 'src/market-data/dto/trade/TradeResponse';

@WebSocketGateway({ cors: true })
export class TradeGateway {
  @WebSocketServer()
  server: Server;

  async sendTradeData(data: ExternalTradeResponse) {
    const response = TradeResponse.from(data);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.log(
      `[${new Date().toISOString()}] 📤 5초 대기 후 체결 내역 전송 완료: ${data.s}`,
    );
    this.server.emit(`trade:${data.s}`, response);
  }
}
