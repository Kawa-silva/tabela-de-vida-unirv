import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AnaliseModule } from './analise/analise.module';
import { CatalogoModule } from './catalogo/catalogo.module';
import { CenariosModule } from './cenarios/cenarios.module';
import { ErrorHandlerFilter } from './common/error-handler.filter';
import { LoggingInterceptor } from './common/logging.interceptor';
import { DatabaseModule } from './database/database.module';

/**
 * AppModule — módulo raiz da aplicação (arquitetura em camadas / MVC do NestJS).
 *
 *  imports    → módulos de cada domínio. Cada módulo agrupa seus Controllers (camada HTTP)
 *               e Providers (Services com regras de negócio + Repositories com SQL).
 *     - DatabaseModule  : DatabaseConnection (pool PostgreSQL + transações) e rotas /health e /database/seed
 *     - CatalogoModule  : culturas, pragas, áreas experimentais e usuários
 *     - CenariosModule  : cenários analíticos, talhões, amostras e contagens
 *     - AnaliseModule   : LifeTableMathEngine (motor matemático da tabela de vida)
 *
 *  providers globais:
 *     - APP_INTERCEPTOR → LoggingInterceptor: log de toda requisição HTTP (método, rota, status, tempo)
 *     - APP_FILTER      → ErrorHandlerFilter: tratamento centralizado de erros com JSON padronizado
 */
@Module({
  imports: [DatabaseModule, CatalogoModule, CenariosModule, AnaliseModule],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_FILTER, useClass: ErrorHandlerFilter },
  ],
})
export class AppModule {}
