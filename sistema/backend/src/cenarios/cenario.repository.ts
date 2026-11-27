import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseConnection } from '../database/database-connection';
import {
  CenarioAnaliticoModel,
  FaseCenarioModel,
  FaseCicloVida,
  TalhaoModel,
} from '../models/domain.models';

/** Estrutura usada para gravar talhões/amostras/contagens de uma vez (criação, coleta e duplicação). */
export interface TalhaoParaGravar {
  numero: number;
  nome: string;
  areaExperimentalId: string | null;
  amostras: { indice: number; latitude: number; longitude: number; dataHoraColeta: string; observacao: string | null }[];
  contagens: Record<string, number[]>;
}

export interface NovoCenarioRegistro {
  id: string;
  nome: string;
  usuarioId: number | null;
  usuarioNome: string;
  culturaId: string;
  pragaId: string;
  areaExperimentalId: string | null;
  numTalhoes: number;
  numAmostrasPorTalhao: number;
  observacoes: string | null;
}

const FORMATO_DATA = `'YYYY-MM-DD"T"HH24:MI:SS'`;

/**
 * CenarioRepository — toda leitura e escrita relacional dos cenários analíticos.
 * Todas as consultas usam parâmetros posicionais ($1, $2...) e as escritas em várias
 * tabelas rodam dentro de transações (DatabaseConnection.withTransaction).
 */
@Injectable()
export class CenarioRepository {
  constructor(private readonly db: DatabaseConnection) {}

  // =========================================================================== LEITURA

  async listarTodosCenariosCompletos(): Promise<CenarioAnaliticoModel[]> {
    return this.carregarCompletos(null);
  }

  async buscarCenarioPorId(id: string): Promise<CenarioAnaliticoModel | null> {
    const [cenario] = await this.carregarCompletos([id]);
    return cenario ?? null;
  }

  async contarCenarios(): Promise<number> {
    const [linha] = await this.db.query<{ total: string }>(`SELECT count(*) AS total FROM cenarios_analiticos`);
    return Number(linha.total);
  }

  async buscarTalhaoId(cenarioId: string, numero: number): Promise<number | null> {
    const [linha] = await this.db.query<{ id: number }>(
      `SELECT id FROM talhoes WHERE cenario_id = $1 AND numero_talhao = $2`,
      [cenarioId, numero],
    );
    return linha?.id ?? null;
  }

  async listarCodigosFase(cenarioId: string): Promise<string[]> {
    const linhas = await this.db.query<{ codigo_fase: string }>(
      `SELECT codigo_fase FROM cenario_fases WHERE cenario_id = $1 ORDER BY ordem`,
      [cenarioId],
    );
    return linhas.map((l) => l.codigo_fase);
  }

  async listarAmostrasDoTalhao(talhaoId: number) {
    const linhas = await this.db.query(
      `SELECT indice_amostra, latitude, longitude FROM amostras_coleta WHERE talhao_id = $1 ORDER BY indice_amostra`,
      [talhaoId],
    );
    return linhas.map((a) => ({
      indice: a.indice_amostra as number,
      latitude: Number(a.latitude),
      longitude: Number(a.longitude),
    }));
  }

  /** Carrega cenários com fases, talhões, amostras e contagens (ids = null → todos). */
  private async carregarCompletos(ids: string[] | null): Promise<CenarioAnaliticoModel[]> {
    const cenarios = await this.db.query(
      `SELECT c.id, c.nome, c.usuario_id, c.usuario_nome, c.cultura_id, cu.nome AS cultura_nome,
              c.praga_id, p.nome_comum AS praga_nome, p.nome_cientifico AS praga_nome_cientifico,
              c.area_experimental_id, c.num_talhoes, c.num_amostras_por_talhao, c.observacoes,
              c.ativo, c.usar_100rx_planilha,
              to_char(c.criado_em, ${FORMATO_DATA}) AS criado_em,
              to_char(c.atualizado_em, ${FORMATO_DATA}) AS atualizado_em
         FROM cenarios_analiticos c
         JOIN culturas cu ON cu.id = c.cultura_id
         JOIN pragas p ON p.id = c.praga_id
        WHERE ($1::varchar[] IS NULL OR c.id = ANY($1))
        ORDER BY c.criado_em DESC`,
      [ids],
    );
    if (cenarios.length === 0) return [];
    const idsCarregados = cenarios.map((c) => c.id as string);

    const [fases, talhoes, amostras, contagens] = await Promise.all([
      this.db.query(
        `SELECT cenario_id, codigo_fase, label, ordem, is_initial, is_terminal
           FROM cenario_fases WHERE cenario_id = ANY($1) ORDER BY cenario_id, ordem`,
        [idsCarregados],
      ),
      this.db.query(
        `SELECT id, cenario_id, numero_talhao, nome, area_experimental_id
           FROM talhoes WHERE cenario_id = ANY($1) ORDER BY cenario_id, numero_talhao`,
        [idsCarregados],
      ),
      this.db.query(
        `SELECT a.talhao_id, a.indice_amostra, a.latitude, a.longitude, a.data_hora_coleta, a.observacao
           FROM amostras_coleta a JOIN talhoes t ON t.id = a.talhao_id
          WHERE t.cenario_id = ANY($1) ORDER BY a.talhao_id, a.indice_amostra`,
        [idsCarregados],
      ),
      this.db.query(
        `SELECT cf.talhao_id, cf.indice_amostra, cf.codigo_fase, cf.quantidade
           FROM contagens_fase cf JOIN talhoes t ON t.id = cf.talhao_id
          WHERE t.cenario_id = ANY($1)`,
        [idsCarregados],
      ),
    ]);

    // agrupa amostras e contagens por talhão
    const talhoesPorId = new Map<number, TalhaoModel>();
    const talhoesPorCenario = new Map<string, TalhaoModel[]>();
    for (const t of talhoes) {
      const talhao: TalhaoModel = {
        id: t.id,
        numero: t.numero_talhao,
        nome: t.nome,
        areaExperimentalId: t.area_experimental_id,
        amostras: [],
        contagens: {},
      };
      talhoesPorId.set(t.id, talhao);
      const listaCenario = talhoesPorCenario.get(t.cenario_id) ?? [];
      listaCenario.push(talhao);
      talhoesPorCenario.set(t.cenario_id, listaCenario);
    }
    for (const a of amostras) {
      talhoesPorId.get(a.talhao_id)?.amostras.push({
        indice: a.indice_amostra,
        latitude: Number(a.latitude),
        longitude: Number(a.longitude),
        dataHoraColeta: a.data_hora_coleta,
        observacao: a.observacao,
      });
    }

    const fasesPorCenario = new Map<string, FaseCenarioModel[]>();
    for (const f of fases) {
      const listaFases = fasesPorCenario.get(f.cenario_id) ?? [];
      listaFases.push({
        codigo: f.codigo_fase,
        label: f.label,
        ordem: f.ordem,
        isInitial: f.is_initial,
        isTerminal: f.is_terminal,
      });
      fasesPorCenario.set(f.cenario_id, listaFases);
    }

    // monta a matriz de contagens [fase][amostra] preenchida com zeros
    for (const c of cenarios) {
      const fasesDoCenario = fasesPorCenario.get(c.id) ?? [];
      for (const talhao of talhoesPorCenario.get(c.id) ?? []) {
        const numAmostras = Math.max(talhao.amostras.length, c.num_amostras_por_talhao);
        for (const f of fasesDoCenario) talhao.contagens[f.codigo] = new Array(numAmostras).fill(0);
      }
    }
    for (const q of contagens) {
      const talhao = talhoesPorId.get(q.talhao_id);
      const linha = talhao?.contagens[q.codigo_fase];
      if (linha && q.indice_amostra < linha.length) linha[q.indice_amostra] = Number(q.quantidade);
    }

    return cenarios.map((c) => ({
      id: c.id,
      nome: c.nome,
      usuarioId: c.usuario_id,
      usuarioNome: c.usuario_nome,
      culturaId: c.cultura_id,
      culturaNome: c.cultura_nome,
      pragaId: c.praga_id,
      pragaNome: c.praga_nome,
      pragaNomeCientifico: c.praga_nome_cientifico,
      areaExperimentalId: c.area_experimental_id,
      numTalhoes: c.num_talhoes,
      numAmostrasPorTalhao: c.num_amostras_por_talhao,
      observacoes: c.observacoes,
      ativo: c.ativo,
      usar100rxPlanilha: c.usar_100rx_planilha,
      criadoEm: c.criado_em,
      atualizadoEm: c.atualizado_em,
      fases: fasesPorCenario.get(c.id) ?? [],
      talhoes: talhoesPorCenario.get(c.id) ?? [],
    }));
  }

  // =========================================================================== ESCRITA

  /** Cria o cenário completo em UMA transação e o define como cenário ativo. */
  async criarCenario(
    registro: NovoCenarioRegistro,
    fases: FaseCicloVida[],
    talhoes: TalhaoParaGravar[],
  ): Promise<void> {
    await this.db.withTransaction(async (cliente) => {
      await cliente.query(`UPDATE cenarios_analiticos SET ativo = FALSE WHERE ativo`);
      await cliente.query(
        `INSERT INTO cenarios_analiticos
           (id, nome, usuario_id, usuario_nome, cultura_id, praga_id, area_experimental_id,
            num_talhoes, num_amostras_por_talhao, observacoes, ativo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)`,
        [
          registro.id,
          registro.nome,
          registro.usuarioId,
          registro.usuarioNome,
          registro.culturaId,
          registro.pragaId,
          registro.areaExperimentalId,
          registro.numTalhoes,
          registro.numAmostrasPorTalhao,
          registro.observacoes,
        ],
      );
      await this.gravarFases(cliente, registro.id, fases);
      await this.gravarTalhoes(cliente, registro.id, talhoes);
    });
  }

  async atualizarMetadados(
    id: string,
    campos: { nome?: string; usuarioNome?: string; criadoEm?: string; observacoes?: string | null; usar100rxPlanilha?: boolean },
  ): Promise<void> {
    await this.db.query(
      `UPDATE cenarios_analiticos SET
          nome = COALESCE($2, nome),
          usuario_nome = COALESCE($3, usuario_nome),
          criado_em = COALESCE($4::timestamp, criado_em),
          observacoes = CASE WHEN $5::boolean THEN $6 ELSE observacoes END,
          usar_100rx_planilha = COALESCE($7, usar_100rx_planilha),
          atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [
        id,
        campos.nome ?? null,
        campos.usuarioNome ?? null,
        campos.criadoEm ?? null,
        campos.observacoes !== undefined,
        campos.observacoes ?? null,
        campos.usar100rxPlanilha ?? null,
      ],
    );
  }

  /** Marca um cenário como ativo e desativa os demais. */
  async ativarCenario(id: string): Promise<void> {
    await this.db.query(`UPDATE cenarios_analiticos SET ativo = (id = $1)`, [id]);
  }

  /** PUT /coleta — substitui fases, talhões, amostras e contagens numa única transação. */
  async substituirTalhoesEFases(
    id: string,
    fases: FaseCicloVida[],
    talhoes: TalhaoParaGravar[],
    numAmostrasPorTalhao: number,
  ): Promise<void> {
    await this.db.withTransaction(async (cliente) => {
      await cliente.query(`DELETE FROM talhoes WHERE cenario_id = $1`, [id]);
      await cliente.query(`DELETE FROM cenario_fases WHERE cenario_id = $1`, [id]);
      await this.gravarFases(cliente, id, fases);
      await this.gravarTalhoes(cliente, id, talhoes);
      await cliente.query(
        `UPDATE cenarios_analiticos
            SET num_talhoes = $2, num_amostras_por_talhao = $3, atualizado_em = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [id, talhoes.length, numAmostrasPorTalhao],
      );
    });
  }

  /** PATCH /contagem — grava (ou atualiza) a contagem de uma célula amostra × fase. */
  async atualizarValorAmostra(talhaoId: number, codigoFase: string, indiceAmostra: number, quantidade: number): Promise<void> {
    await this.db.query(
      `INSERT INTO contagens_fase (talhao_id, indice_amostra, codigo_fase, quantidade)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (talhao_id, indice_amostra, codigo_fase)
       DO UPDATE SET quantidade = EXCLUDED.quantidade`,
      [talhaoId, indiceAmostra, codigoFase, quantidade],
    );
    await this.tocarCenarioDoTalhao(talhaoId);
  }

  /** Translada todas as amostras do talhão por (deltaLat, deltaLng) e atualiza a área experimental. */
  async moverRegiaoTalhao(talhaoId: number, deltaLat: number, deltaLng: number, areaId: string | null): Promise<void> {
    await this.db.withTransaction(async (cliente) => {
      await cliente.query(
        `UPDATE amostras_coleta
            SET latitude = ROUND((latitude + $2)::numeric, 6),
                longitude = ROUND((longitude + $3)::numeric, 6)
          WHERE talhao_id = $1`,
        [talhaoId, deltaLat, deltaLng],
      );
      await cliente.query(`UPDATE talhoes SET area_experimental_id = $2 WHERE id = $1`, [talhaoId, areaId]);
    });
    await this.tocarCenarioDoTalhao(talhaoId);
  }

  /** Ajuste fino da coordenada GPS de uma amostra (RF008). */
  async atualizarCoordenadaAmostra(talhaoId: number, indice: number, latitude: number, longitude: number): Promise<number> {
    const linhas = await this.db.query(
      `UPDATE amostras_coleta SET latitude = ROUND($3::numeric, 6), longitude = ROUND($4::numeric, 6)
        WHERE talhao_id = $1 AND indice_amostra = $2 RETURNING id`,
      [talhaoId, indice, latitude, longitude],
    );
    return linhas.length;
  }

  /** Clona o cenário inteiro (metadados, fases, talhões, amostras e contagens) em UMA transação (RN005). */
  async duplicarCenario(idOrigem: string, idNovo: string): Promise<void> {
    await this.db.withTransaction(async (cliente) => {
      await cliente.query(
        `INSERT INTO cenarios_analiticos
           (id, nome, usuario_id, usuario_nome, cultura_id, praga_id, area_experimental_id,
            num_talhoes, num_amostras_por_talhao, observacoes, ativo, usar_100rx_planilha)
         SELECT $2, nome || ' (Cópia)', usuario_id, usuario_nome, cultura_id, praga_id, area_experimental_id,
                num_talhoes, num_amostras_por_talhao, observacoes, FALSE, usar_100rx_planilha
           FROM cenarios_analiticos WHERE id = $1`,
        [idOrigem, idNovo],
      );
      await cliente.query(
        `INSERT INTO cenario_fases (cenario_id, codigo_fase, label, ordem, is_initial, is_terminal, is_nymph)
         SELECT $2, codigo_fase, label, ordem, is_initial, is_terminal, is_nymph
           FROM cenario_fases WHERE cenario_id = $1`,
        [idOrigem, idNovo],
      );
      await cliente.query(
        `INSERT INTO talhoes (cenario_id, numero_talhao, nome, area_experimental_id)
         SELECT $2, numero_talhao, nome, area_experimental_id FROM talhoes WHERE cenario_id = $1`,
        [idOrigem, idNovo],
      );
      await cliente.query(
        `INSERT INTO amostras_coleta (talhao_id, indice_amostra, latitude, longitude, data_hora_coleta, observacao)
         SELECT tn.id, a.indice_amostra, a.latitude, a.longitude, a.data_hora_coleta, a.observacao
           FROM amostras_coleta a
           JOIN talhoes tv ON tv.id = a.talhao_id AND tv.cenario_id = $1
           JOIN talhoes tn ON tn.cenario_id = $2 AND tn.numero_talhao = tv.numero_talhao`,
        [idOrigem, idNovo],
      );
      await cliente.query(
        `INSERT INTO contagens_fase (talhao_id, indice_amostra, codigo_fase, quantidade)
         SELECT tn.id, cf.indice_amostra, cf.codigo_fase, cf.quantidade
           FROM contagens_fase cf
           JOIN talhoes tv ON tv.id = cf.talhao_id AND tv.cenario_id = $1
           JOIN talhoes tn ON tn.cenario_id = $2 AND tn.numero_talhao = tv.numero_talhao`,
        [idOrigem, idNovo],
      );
    });
  }

  /** Exclui o cenário (talhões, amostras e contagens saem em cascata) e garante um cenário ativo. */
  async excluirCenario(id: string): Promise<void> {
    await this.db.withTransaction(async (cliente) => {
      await cliente.query(`DELETE FROM cenarios_analiticos WHERE id = $1`, [id]);
      await cliente.query(
        `UPDATE cenarios_analiticos SET ativo = TRUE
          WHERE id = (SELECT id FROM cenarios_analiticos ORDER BY criado_em DESC LIMIT 1)
            AND NOT EXISTS (SELECT 1 FROM cenarios_analiticos WHERE ativo)`,
      );
    });
  }

  // =========================================================================== AUXILIARES

  private async tocarCenarioDoTalhao(talhaoId: number): Promise<void> {
    await this.db.query(
      `UPDATE cenarios_analiticos SET atualizado_em = CURRENT_TIMESTAMP
        WHERE id = (SELECT cenario_id FROM talhoes WHERE id = $1)`,
      [talhaoId],
    );
  }

  private async gravarFases(cliente: PoolClient, cenarioId: string, fases: FaseCicloVida[]): Promise<void> {
    const ultimo = fases.length - 1;
    await cliente.query(
      `INSERT INTO cenario_fases (cenario_id, codigo_fase, label, ordem, is_initial, is_terminal, is_nymph)
       SELECT $1, f.codigo, f.label, f.ordem, f.ordem = 1, f.ordem = $4, f.ordem NOT IN (1, $4)
         FROM unnest($2::varchar[], $3::varchar[]) WITH ORDINALITY AS f(codigo, label, ordem)`,
      [cenarioId, fases.map((f) => f.codigo), fases.map((f) => f.label), ultimo + 1],
    );
  }

  /** Insere talhões, amostras e contagens em lote (unnest) — rápido mesmo com milhares de células. */
  private async gravarTalhoes(cliente: PoolClient, cenarioId: string, talhoes: TalhaoParaGravar[]): Promise<void> {
    if (talhoes.length === 0) return;
    const inseridos = await cliente.query<{ id: number; numero_talhao: number }>(
      `INSERT INTO talhoes (cenario_id, numero_talhao, nome, area_experimental_id)
       SELECT $1, t.numero, t.nome, t.area
         FROM unnest($2::int[], $3::varchar[], $4::varchar[]) AS t(numero, nome, area)
       RETURNING id, numero_talhao`,
      [
        cenarioId,
        talhoes.map((t) => t.numero),
        talhoes.map((t) => t.nome),
        talhoes.map((t) => t.areaExperimentalId),
      ],
    );
    const idPorNumero = new Map(inseridos.rows.map((r) => [r.numero_talhao, r.id]));

    const am = { talhao: [] as number[], indice: [] as number[], lat: [] as number[], lng: [] as number[], data: [] as string[], obs: [] as (string | null)[] };
    const ct = { talhao: [] as number[], indice: [] as number[], fase: [] as string[], qtd: [] as number[] };

    for (const t of talhoes) {
      const talhaoId = idPorNumero.get(t.numero)!;
      for (const a of t.amostras) {
        am.talhao.push(talhaoId);
        am.indice.push(a.indice);
        am.lat.push(a.latitude);
        am.lng.push(a.longitude);
        am.data.push(a.dataHoraColeta);
        am.obs.push(a.observacao);
      }
      for (const [fase, valores] of Object.entries(t.contagens)) {
        valores.forEach((qtd, indice) => {
          ct.talhao.push(talhaoId);
          ct.indice.push(indice);
          ct.fase.push(fase);
          ct.qtd.push(qtd);
        });
      }
    }

    await cliente.query(
      `INSERT INTO amostras_coleta (talhao_id, indice_amostra, latitude, longitude, data_hora_coleta, observacao)
       SELECT a.talhao, a.indice, ROUND(a.lat, 6), ROUND(a.lng, 6), a.data, a.obs
         FROM unnest($1::int[], $2::int[], $3::numeric[], $4::numeric[], $5::varchar[], $6::varchar[])
           AS a(talhao, indice, lat, lng, data, obs)`,
      [am.talhao, am.indice, am.lat, am.lng, am.data, am.obs],
    );
    await cliente.query(
      `INSERT INTO contagens_fase (talhao_id, indice_amostra, codigo_fase, quantidade)
       SELECT c.talhao, c.indice, c.fase, c.qtd
         FROM unnest($1::int[], $2::int[], $3::varchar[], $4::numeric[]) AS c(talhao, indice, fase, qtd)`,
      [ct.talhao, ct.indice, ct.fase, ct.qtd],
    );
  }
}
