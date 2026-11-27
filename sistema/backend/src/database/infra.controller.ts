import { Controller, Get, Post } from '@nestjs/common';
import { DatabaseConnection } from './database-connection';

/** Rotas de infraestrutura: saúde do servidor e recarga do banco. */
@Controller()
export class InfraController {
  constructor(private readonly db: DatabaseConnection) {}

  /** GET /api/health — status do servidor e da conexão com o PostgreSQL */
  @Get('health')
  async health() {
    const banco = await this.db.ping();
    return {
      status: banco ? 'ok' : 'degradado',
      servidor: 'NestJS',
      banco: banco ? 'conectado' : 'desconectado',
      timestamp: new Date().toISOString(),
    };
  }

  /** POST /api/database/seed — reexecuta o script.sql restaurando a carga inicial */
  @Post('database/seed')
  async seed() {
    await this.db.executeSqlScript();
    return { mensagem: 'Banco restaurado com a carga inicial do script.sql' };
  }
}
