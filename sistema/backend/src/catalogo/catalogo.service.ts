import { Injectable } from '@nestjs/common';
import { ApiException } from '../common/api.exception';
import {
  AreaExperimentalModel,
  CulturaModel,
  PragaModel,
  UsuarioModel,
} from '../models/domain.models';
import { CatalogoRepository } from './catalogo.repository';

/** CatalogoService — regras de negócio sobre os catálogos agronômicos e áreas da UniRV. */
@Injectable()
export class CatalogoService {
  constructor(private readonly repo: CatalogoRepository) {}

  listarCulturasComPragas(): Promise<CulturaModel[]> {
    return this.repo.listarCulturasComPragas();
  }

  async buscarCultura(id: string): Promise<CulturaModel> {
    const [cultura] = await this.repo.listarCulturasComPragas(id);
    if (!cultura) throw ApiException.notFound(`Cultura "${id}" não encontrada.`);
    return cultura;
  }

  async buscarPraga(id: string): Promise<PragaModel> {
    const [praga] = await this.repo.listarPragas(undefined, id);
    if (!praga) throw ApiException.notFound(`Praga "${id}" não encontrada.`);
    return praga;
  }

  listarAreas(): Promise<AreaExperimentalModel[]> {
    return this.repo.listarAreas();
  }

  listarUsuarios(): Promise<UsuarioModel[]> {
    return this.repo.listarUsuarios();
  }
}
