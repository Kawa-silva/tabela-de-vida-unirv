/**
 * Configuração do ambiente.
 * Lê o arquivo .env (se existir) usando o recurso nativo do Node (process.loadEnvFile, Node 21.7+)
 * e expõe os valores com padrões seguros para desenvolvimento local.
 */
try {
  process.loadEnvFile('.env');
} catch {
  // sem .env: usa as variáveis do sistema ou os valores padrão abaixo
}

export const envConfig = {
  porta: Number(process.env.PORT ?? 3000),
  origemFrontend: process.env.FRONTEND_ORIGIN ?? 'http://localhost:4200',
  banco: {
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? 'postgres',
    password: process.env.PGPASSWORD ?? 'postgres',
    database: process.env.PGDATABASE ?? 'tabela_vida',
  },
  /** caminho do script.sql usado pelo POST /api/database/seed */
  caminhoScriptSql: process.env.SCRIPT_SQL_PATH ?? '../script.sql',
};
