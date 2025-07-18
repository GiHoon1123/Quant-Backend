import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as path from 'path';

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'root',
  password: '1234',
  database: 'market_data',
  entities: [path.resolve(__dirname, '..', '..', '**', '*Entity.{ts,js}')],
  synchronize: true, // 🔥 개발 환경에서 테이블 자동 생성 활성화
  logging: false, // � SQL 쿼리 로깅 비활성화 (로그 스팸 방지)
};
