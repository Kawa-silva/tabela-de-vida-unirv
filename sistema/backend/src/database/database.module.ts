import { Global, Module } from '@nestjs/common';
import { DatabaseConnection } from './database-connection';
import { InfraController } from './infra.controller';

/** Módulo global: qualquer repositório pode injetar a DatabaseConnection. */
@Global()
@Module({
  controllers: [InfraController],
  providers: [DatabaseConnection],
  exports: [DatabaseConnection],
})
export class DatabaseModule {}
