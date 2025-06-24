import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';

import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './AppModule';
import { swaggerConfig } from './common/config/SwaggerConfig';

async function bootstrap() {
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

  await app.listen(3000);
}
bootstrap();
