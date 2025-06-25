import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './AppModule';
import { swaggerConfig } from './common/config/SwaggerConfig';
import { GlobalExceptionFilter } from './common/exception/global/GlobalExceptionFilter';

async function bootstrap() {
  console.log('✅ NODE_ENV:', process.env.NODE_ENV);
  console.log('✅ BINANCE_API_KEY:', process.env.BINANCE_API_KEY); // 주의: 실제 운영에서는 로그 금지

  const app = await NestFactory.create(AppModule, {
    cors: true,
  });

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen(3000);
}
bootstrap();
