import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { envConfig } from './config/env.config';

/**
 * Ponto de entrada do backend (equivalente ao AppServer do enunciado):
 *  - prefixo global /api
 *  - CORS liberado para o frontend Angular (porta 4200)
 *  - servidor HTTP na porta 3000
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: envConfig.origemFrontend });
  app.useBodyParser('json', { limit: '10mb' });
  await app.listen(envConfig.porta);
  new Logger('Bootstrap').log(`Backend rodando em http://localhost:${envConfig.porta}/api`);
}

void bootstrap();
