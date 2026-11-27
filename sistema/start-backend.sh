#!/usr/bin/env bash
# =============================================================================
# start-backend.sh — inicia o backend NestJS (porta 3000)
#  1. instala as dependências se a pasta node_modules não existir
#  2. cria o .env a partir do .env.example se ainda não existir
#  3. cria o banco e aplica o script.sql se o esquema ainda não existir
#  4. sobe o servidor em modo desenvolvimento
# Uso (na pasta /sistema):  ./start-backend.sh
# =============================================================================
set -e
RAIZ="$(cd "$(dirname "$0")" && pwd)"
cd "$RAIZ/backend"

if [ ! -d node_modules ]; then
  echo ">> Instalando dependências do backend..."
  npm install
fi

if [ ! -f .env ]; then
  echo ">> Criando .env a partir do .env.example (ajuste a senha do PostgreSQL se necessário)"
  cp .env.example .env
fi

# carrega as variáveis do .env (PGHOST, PGUSER, PGPASSWORD, PGDATABASE...)
set -a
. ./.env
set +a

if command -v psql >/dev/null 2>&1; then
  if ! psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${PGDATABASE}'" | grep -q 1; then
    echo ">> Criando o banco ${PGDATABASE}..."
    psql -d postgres -c "CREATE DATABASE ${PGDATABASE}"
  fi
  if ! psql -tAc "SELECT to_regclass('public.cenarios_analiticos') IS NOT NULL" | grep -q t; then
    echo ">> Aplicando a carga inicial (script.sql)..."
    PGCLIENTENCODING=UTF8 psql -q -f "$RAIZ/script.sql"
  fi
else
  echo ">> psql não encontrado no PATH: o backend aplicará o script.sql automaticamente se o esquema não existir."
fi

echo ">> Iniciando o backend em http://localhost:${PORT:-3000}/api"
npm run start:dev
