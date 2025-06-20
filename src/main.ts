// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './AppModule';
import { BinanceClient } from './market-data/infra/BinanceClient';
import { MarketDataGateway } from './market-data/web/MarketDataGateway';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const gateway = app.get(MarketDataGateway);

  // BinanceClient 인스턴스 생성 및 연결
  const client = new BinanceClient('btcusdt', (data) => {
    gateway.sendTradeData(data); // 웹소켓으로 프론트에 전송
  });

  client.connect();

  await app.listen(3000);
}
bootstrap();
