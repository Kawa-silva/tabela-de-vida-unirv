import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { envConfig } from '../config/env.config';

/**
 * DatabaseConnection — provider único (singleton no contêiner de injeção do NestJS)
 * que gerencia o pool de conexões com o PostgreSQL.
 *
 *  - query<T>(sql, params): consulta parametrizada ($1, $2...) — evita SQL Injection (RNF014)
 *  - withTransaction(fn):   BEGIN / COMMIT / ROLLBACK automático (RNF003)
 *  - executeSqlScript():    aplica o script.sql (carga inicial)
 */
@Injectable()
export class DatabaseConnection implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseConnection.name);
  private readonly pool = new Pool(envConfig.banco);

  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query('SELECT 1');
      this.logger.log(
        `Conectado ao PostgreSQL ${envConfig.banco.host}:${envConfig.banco.port}/${envConfig.banco.database}`,
      );
      const { rows } = await this.pool.query<{ existe: boolean }>(
        `SELECT to_regclass('public.cenarios_analiticos') IS NOT NULL AS existe`,
      );
      if (!rows[0].existe) {
        this.logger.warn('Esquema não encontrado. Aplicando script.sql automaticamente...');
        await this.executeSqlScript();
      }
    } catch (erro) {
      this.logger.error(`Falha ao conectar no PostgreSQL: ${(erro as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async query<T extends QueryResultRow = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    const resultado = await this.pool.query<T>(sql, params);
    return resultado.rows;
  }

  async withTransaction<T>(fn: (cliente: PoolClient) => Promise<T>): Promise<T> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const resultado = await fn(cliente);
      await cliente.query('COMMIT');
      return resultado;
    } catch (erro) {
      await cliente.query('ROLLBACK');
      throw erro;
    } finally {
      cliente.release();
    }
  }

  async executeSqlScript(caminho = envConfig.caminhoScriptSql): Promise<void> {
    const sql = await readFile(resolve(process.cwd(), caminho), 'utf8');
    await this.pool.query(sql);
    this.logger.log(`Script ${caminho} aplicado com sucesso.`);
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
