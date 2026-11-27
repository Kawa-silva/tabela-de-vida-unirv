import { Injectable } from '@nestjs/common';
import { DatabaseConnection } from '../database/database-connection';
import {
  AreaExperimentalModel,
  CulturaModel,
  PragaModel,
  UsuarioModel,
} from '../models/domain.models';

/** CatalogoRepository — consultas parametrizadas em culturas, pragas, áreas e usuários. */
@Injectable()
export class CatalogoRepository {
  constructor(private readonly db: DatabaseConnection) {}

  async listarCulturasComPragas(culturaId?: string): Promise<CulturaModel[]> {
    const culturas = await this.db.query(
      `SELECT id, nome, nome_cientifico, familia, descricao, imagem
         FROM culturas
        WHERE ($1::varchar IS NULL OR id = $1)
        ORDER BY nome`,
      [culturaId ?? null],
    );
    const pragas = await this.listarPragas(culturaId);
    return culturas.map((c) => ({
      id: c.id,
      nome: c.nome,
      nomeCientifico: c.nome_cientifico,
      familia: c.familia,
      descricao: c.descricao,
      imagem: c.imagem,
      pragas: pragas.filter((p) => p.culturaId === c.id),
    }));
  }

  async listarPragas(culturaId?: string, pragaId?: string): Promise<PragaModel[]> {
    const linhas = await this.db.query(
      `SELECT id, cultura_id, nome_comum, nome_cientifico, ordem, fase_critica_tipica,
              descricao, imagem, fases_sugeridas
         FROM pragas
        WHERE ($1::varchar IS NULL OR cultura_id = $1)
          AND ($2::varchar IS NULL OR id = $2)
        ORDER BY nome_comum`,
      [culturaId ?? null, pragaId ?? null],
    );
    return linhas.map((p) => ({
      id: p.id,
      culturaId: p.cultura_id,
      nomeComum: p.nome_comum,
      nomeCientifico: p.nome_cientifico,
      ordem: p.ordem,
      faseCriticaTipica: p.fase_critica_tipica,
      descricao: p.descricao,
      imagem: p.imagem,
      fasesSugeridas: p.fases_sugeridas ?? [],
    }));
  }

  async listarAreas(): Promise<AreaExperimentalModel[]> {
    const linhas = await this.db.query(
      `SELECT id, nome, nome_curto, descricao, dms_lat, dms_lng, latitude, longitude, poligono
         FROM areas_experimentais
        ORDER BY nome`,
    );
    return linhas.map((a) => ({
      id: a.id,
      nome: a.nome,
      nomeCurto: a.nome_curto,
      descricao: a.descricao,
      dmsLat: a.dms_lat,
      dmsLng: a.dms_lng,
      latitude: Number(a.latitude),
      longitude: Number(a.longitude),
      poligono: (a.poligono ?? []).map((p: number[]) => [Number(p[0]), Number(p[1])]),
    }));
  }

  async listarUsuarios(): Promise<UsuarioModel[]> {
    const linhas = await this.db.query(
      `SELECT id, nome, email, crea_registro, instituicao, cargo FROM usuarios ORDER BY id`,
    );
    return linhas.map((u) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      creaRegistro: u.crea_registro,
      instituicao: u.instituicao,
      cargo: u.cargo,
    }));
  }
}
