#!/usr/bin/env bash
# =============================================================================
# start-frontend.sh — inicia o frontend Angular (porta 4200)
#  1. instala as dependências se a pasta node_modules não existir
#  2. sobe o servidor de desenvolvimento do Angular
# Uso (na pasta /sistema):  ./start-frontend.sh
# O backend precisa estar rodando (./start-backend.sh) para os dados aparecerem.
# =============================================================================
set -e
cd "$(cd "$(dirname "$0")" && pwd)/tabela-de-vida"

if [ ! -d node_modules ]; then
  echo ">> Instalando dependências do frontend..."
  npm install
fi

echo ">> Iniciando o frontend em http://localhost:4200"
npx ng serve --port 4200
