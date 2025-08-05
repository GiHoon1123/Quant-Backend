import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as path from 'path';
import { DataSource } from 'typeorm';

// 공통 설정
const commonConfig = {
  type: 'postgres' as const,
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432') || 5432,
  username: process.env.DATABASE_USERNAME || 'root',
  password: process.env.DATABASE_PASSWORD || '1234',
  database: process.env.DATABASE_NAME || 'quant_engine',
  entities: [
    path.resolve(__dirname, '..', '..', '**', '*Entity.{ts,js}'),
    path.resolve(__dirname, '..', '..', '**', '*Record.{ts,js}'),
    path.resolve(__dirname, '..', '..', '**', '*Transaction.{ts,js}'),
  ],
  synchronize: false,
};

// TypeORM CLI용 (마이그레이션 생성/실행)
const AppDataSource = new DataSource({
  ...commonConfig,
  migrations: [path.resolve(__dirname, '..', '..', 'migrations', '*.{ts,js}')],
  logging: true,
});

export default AppDataSource;

// NestJS 애플리케이션용 (실제 서비스 실행)
export const typeOrmConfig: TypeOrmModuleOptions = {
  ...commonConfig,
  logging: false,
  cache: false,
};
