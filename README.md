# Tabela de Vida Ecológica & Análise de Fator-Chave — UniRV

Sistema web full-stack para registrar contagens de pragas agrícolas por talhão e amostra georreferenciada,
calcular a **Tabela de Vida Ecológica** e apoiar a identificação do **estágio crítico (fator-chave)** da praga.

**Disciplina:** Desenvolvimento de Software para Web — Engenharia de Software, UniRV
**Professor:** Prof. Me. Sergio Souza Novak

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | Angular 22 (componentes standalone, Signals, HttpClient) + Leaflet 1.9 |
| Backend | NestJS (TypeScript, módulos com controllers e providers, log HTTP e filtro de erros) |
| Banco de dados | PostgreSQL 14+ (`sistema/script.sql`: 9 tabelas, 2 views e carga inicial) |

## Estrutura

```
sistema/
├── script.sql            # DDL + DML (tabelas, views e carga inicial)
├── start-backend.sh      # sobe o backend (porta 3000)
├── start-frontend.sh     # sobe o frontend (porta 4200)
├── backend/              # API NestJS
│   └── src/
│       ├── app.module.ts         # módulo raiz: importa os módulos e registra log + filtro de erros
│       ├── main.ts               # prefixo /api, CORS e porta 3000
│       ├── config/               # leitura do .env
│       ├── database/             # DatabaseConnection (pool, transações) + /health e /database/seed
│       ├── common/               # ApiException, ErrorHandlerFilter, LoggingInterceptor, validação
│       ├── models/               # modelos de domínio e DTOs
│       ├── catalogo/             # culturas, pragas, áreas e usuários
│       ├── cenarios/             # cenários, talhões, amostras e contagens
│       └── analise/              # LifeTableMathEngine (motor da tabela de vida)
└── tabela-de-vida/       # frontend Angular
    └── src/app/
        ├── life-table.service.ts       # estado com Signals + chamadas à API
        ├── selecao-context.service.ts  # catálogos (culturas, pragas, áreas)
        ├── life-table.math.ts          # mesmas fórmulas do backend
        └── components/                 # telas (assistente, central, coleta, mapa, tabelas)
```

## Como executar

Pré-requisitos: Node.js 22+, PostgreSQL 14+ e Git Bash (no Windows, para os scripts `.sh`).

1. Configure a senha do PostgreSQL: copie `sistema/backend/.env.example` para `sistema/backend/.env` e ajuste `PGPASSWORD`.
2. Em um terminal, na pasta `sistema`: `./start-backend.sh` → http://localhost:3000/api/health
3. Em outro terminal, na pasta `sistema`: `./start-frontend.sh` → http://localhost:4200

Sem Git Bash: `cd sistema/backend && npm install && npm run start:dev` e `cd sistema/tabela-de-vida && npm install && npx ng serve`.

## Entrega 1 (RF001 a RF011)

- [x] RF001–RF003 — assistente de 3 etapas (cultura → praga → dimensionamento)
- [x] RF004–RF005 — Central de Cenários (acordeão de linha única, busca, edição, duplicação, exclusão)
- [x] RF006 — coleta: fases, talhões e matriz de contagens salva no banco a cada edição
- [x] RF007–RF008 — mapa Leaflet com as 4 áreas da UniRV, mover talhão por clique e ajuste de coordenadas
- [x] RF009 — importação de matrizes TSV/CSV/Excel
- [x] RF010 — tabela de vida por talhão (com alternância do 100rx)
- [x] RF011 — tabela média e mortalidade indispensável (MIx)

**Entrega 2 (pendente):** RF012–RF018 — matriz de k com erro padrão, correlação de Pearson, ANOVA,
gráficos SVG e ranking de criticidade. As abas 4 a 7 já existem no frontend como espaço reservado e o
`LifeTableMathEngine` está preparado para receber os novos cálculos.

## Decisões de projeto

- **Convenção do Lx:** Lx = indivíduos que **atingiram** a fase x (soma da fase e das seguintes), como na
  planilha `dados.xlsx` do professor. Com essa convenção os resultados batem com a planilha
  (ex.: Talhão 1, K = 0,4480; tabela média, k̄ do ovo = 0,2416).
- **Tabela média:** cada talhão é normalizado para uma coorte de 1000 indivíduos antes das médias (como na planilha).
- **Áreas experimentais e culturas:** foram usadas as do `script.sql` fornecido (4 áreas da UniRV; Arroz no lugar de Café).
- **Colunas adicionadas ao script.sql:** `pragas.fases_sugeridas`, `areas_experimentais.poligono` e
  `cenarios_analiticos.usar_100rx_planilha`, exigidas pelas telas e ausentes no script original.
- **Divisões por zero / log(0):** retornam 0 (RN016).

## Principais endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | status do servidor e do banco |
| POST | `/api/database/seed` | restaura a carga inicial |
| GET | `/api/catalogo/culturas` | culturas com pragas |
| GET | `/api/catalogo/areas-unirv` | áreas experimentais |
| GET/POST | `/api/cenarios` | lista / cria cenário |
| GET/PUT/DELETE | `/api/cenarios/:id` | consulta (com análise) / edita / exclui |
| PATCH | `/api/cenarios/:id/ativar` | define o cenário ativo |
| POST | `/api/cenarios/:id/duplicar` | duplica em transação |
| PUT | `/api/cenarios/:id/coleta` | salva fases, talhões e contagens |
| PATCH | `/api/cenarios/:id/talhoes/:num/contagem` | salva uma célula |
| POST | `/api/cenarios/:id/talhoes/:num/mover-regiao` | move o talhão no mapa |
| PATCH | `/api/cenarios/:id/talhoes/:num/amostras/:idx` | ajusta a coordenada de uma amostra |
| POST | `/api/analise/calcular` | executa o motor da tabela de vida |

## Equipe

- Kawã Santos
- Pedro Lucas
  
