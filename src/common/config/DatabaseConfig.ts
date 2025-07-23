import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as path from 'path';
import { DataSource } from 'typeorm';

const AppDataSource = new DataSource({
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
  migrations: [path.resolve(__dirname, '..', '..', 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: true,
});

export default AppDataSource;

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
  synchronize: false, // 마이그레이션 사용을 위해 false로 유지
  logging: false,
  cache: false,
};
