import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as path from 'path';

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'root',
  password: '1234',
  database: 'quant_engine',
  entities: [
    path.resolve(__dirname, '..', '..', '**', '*Entity.{ts,js}'),
    path.resolve(__dirname, '..', '..', '**', '*Record.{ts,js}'),
    path.resolve(__dirname, '..', '..', '**', '*Transaction.{ts,js}'),
  ],
  synchronize: false, // 🔥 테이블 생성을 위해 다시 활성화
  logging: false, // SQL 쿼리 로깅 활성화 (문제 파악용)
  cache: false, // 메타데이터 캐시 비활성화
};
