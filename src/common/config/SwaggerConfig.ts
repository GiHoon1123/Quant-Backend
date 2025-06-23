import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('Quant Backend API')
  .setDescription('퀀트 시스템을 위한 백엔드 API 명세입니다.')
  .setVersion('1.0')

  .build();
