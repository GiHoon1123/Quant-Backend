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
  synchronize: false,
};
