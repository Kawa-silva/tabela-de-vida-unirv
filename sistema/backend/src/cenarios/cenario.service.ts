import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LifeTableMathEngine } from '../analise/life-table-math.engine';
import { CatalogoService } from '../catalogo/catalogo.service';
import { ApiException } from '../common/api.exception';
import { inteiro, lista, numero, objeto, texto } from '../common/validacao';
import {
  AreaExperimentalModel,
  CenarioAnaliticoModel,
  FaseCicloVida,
} from '../models/domain.models';
import { CenarioRepository, TalhaoParaGravar } from './cenario.repository';

const FASES_PADRAO: FaseCicloVida[] = [
  { codigo: 'Ov', label: 'Ovo (Ov)' },
  { codigo: 'N1', label: 'Ninfa 1 (N1)' },
  { codigo: 'N2', label: 'Ninfa 2 (N2)' },
  { codigo: 'N3', label: 'Ninfa 3 (N3)' },
  { codigo: 'N4', label: 'Ninfa 4 (N4)' },
  { codigo: 'Ad', label: 'Adulto (Ad)' },
];

/** lado (em graus) do quadrado que cada área experimental ocupa no mapa (~530 m) */
const LADO_AREA_GRAUS = 0.0048;

/**
 * CenarioService — regras de negócio dos cenários analíticos:
 * validação, geração das amostras georreferenciadas, dados de demonstração,
 * deslocamento espacial de talhões e integridade (RN001–RN014).
 */
@Injectable()
export class CenarioService {
  constructor(
    private readonly repo: CenarioRepository,
    private readonly catalogo: CatalogoService,
    private readonly mathEngine: LifeTableMathEngine,
  ) {}

  // =========================================================================== CONSULTAS

  listarCenarios(): Promise<CenarioAnaliticoModel[]> {
    return this.repo.listarTodosCenariosCompletos();
  }

  async buscarCenario(id: string): Promise<CenarioAnaliticoModel> {
    const cenario = await this.repo.buscarCenarioPorId(id);
    if (!cenario) throw ApiException.notFound(`Cenário "${id}" não encontrado.`);
    return cenario;
  }

  /** Cenário + cálculo ecológico completo (tabelas por talhão e tabela média). */
  async buscarCenarioComAnalise(id: string) {
    const cenario = await this.buscarCenario(id);
    const analise = this.mathEngine.computeCompleteAnalysis(cenario.talhoes, cenario.fases, {
      usar100rxPlanilha: cenario.usar100rxPlanilha,
    });
    return { ...cenario, analise };
  }

  // =========================================================================== RF003: CRIAÇÃO

  async criarNovoCenario(corpo: unknown): Promise<CenarioAnaliticoModel> {
    const dto = objeto<Record<string, unknown>>(corpo);
    const nome = texto(dto.nome, 'nome', true, 220);
    const usuarioNome = texto(dto.usuarioNome, 'usuarioNome', true, 150);
    const numTalhoes = inteiro(dto.numTalhoes, 'numTalhoes', 2, 50);
    const numAmostras = inteiro(dto.numAmostrasPorTalhao, 'numAmostrasPorTalhao', 1, 100);
    const observacoes = texto(dto.observacoes, 'observacoes', false, 2000) || null;
    const modoDados = dto.modoDados === 'zerado' ? 'zerado' : 'demo';

    const cultura = await this.catalogo.buscarCultura(texto(dto.culturaId, 'culturaId'));
    const praga = await this.catalogo.buscarPraga(texto(dto.pragaId, 'pragaId'));
    if (praga.culturaId !== cultura.id) {
      throw ApiException.badRequest(`A praga "${praga.nomeComum}" não pertence à cultura "${cultura.nome}".`);
    }

    const areas = await this.catalogo.listarAreas();
    const areaEscolhida = dto.areaExperimentalId
      ? areas.find((a) => a.id === dto.areaExperimentalId)
      : undefined;
    if (dto.areaExperimentalId && !areaEscolhida) {
      throw ApiException.badRequest(`Área experimental "${String(dto.areaExperimentalId)}" não existe.`);
    }

    const fases = praga.fasesSugeridas.length >= 2 ? praga.fasesSugeridas : FASES_PADRAO;
    const talhoes = this.gerarTalhoes(numTalhoes, numAmostras, fases, areas, areaEscolhida ?? null, modoDados);
    const id = `cen-${randomUUID().slice(0, 8)}`;

    await this.repo.criarCenario(
      {
        id,
        nome,
        usuarioId: typeof dto.usuarioId === 'number' ? dto.usuarioId : null,
        usuarioNome,
        culturaId: cultura.id,
        pragaId: praga.id,
        areaExperimentalId: areaEscolhida?.id ?? talhoes[0].areaExperimentalId,
        numTalhoes,
        numAmostrasPorTalhao: numAmostras,
        observacoes,
      },
      fases,
      talhoes,
    );
    return this.buscarCenario(id);
  }

  // =========================================================================== RF005: METADADOS, DUPLICAR, EXCLUIR

  async atualizarMetadados(id: string, corpo: unknown): Promise<CenarioAnaliticoModel> {
    await this.buscarCenario(id);
    const dto = objeto<Record<string, unknown>>(corpo);
    let criadoEm: string | undefined;
    if (dto.criadoEm !== undefined) {
      criadoEm = texto(dto.criadoEm, 'criadoEm', true, 40);
      if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(criadoEm)) {
        throw ApiException.badRequest('O campo "criadoEm" deve estar no formato AAAA-MM-DDTHH:mm.');
      }
    }
    await this.repo.atualizarMetadados(id, {
      nome: dto.nome !== undefined ? texto(dto.nome, 'nome', true, 220) : undefined,
      usuarioNome: dto.usuarioNome !== undefined ? texto(dto.usuarioNome, 'usuarioNome', true, 150) : undefined,
      criadoEm,
      observacoes: dto.observacoes !== undefined ? texto(dto.observacoes, 'observacoes', false, 2000) || null : undefined,
      usar100rxPlanilha: typeof dto.usar100rxPlanilha === 'boolean' ? dto.usar100rxPlanilha : undefined,
    });
    return this.buscarCenario(id);
  }

  async ativarCenario(id: string): Promise<CenarioAnaliticoModel> {
    await this.buscarCenario(id);
    await this.repo.ativarCenario(id);
    return this.buscarCenario(id);
  }

  async duplicarCenario(id: string): Promise<CenarioAnaliticoModel> {
    await this.buscarCenario(id);
    const idNovo = `cen-${randomUUID().slice(0, 8)}`;
    await this.repo.duplicarCenario(id, idNovo);
    return this.buscarCenario(idNovo);
  }

  /** RN006: impede excluir o último cenário cadastrado. */
  async excluirCenario(id: string): Promise<{ mensagem: string }> {
    await this.buscarCenario(id);
    if ((await this.repo.contarCenarios()) <= 1) {
      throw ApiException.conflict('Não é possível excluir o único cenário cadastrado.');
    }
    await this.repo.excluirCenario(id);
    return { mensagem: `Cenário "${id}" excluído com sucesso.` };
  }

  // =========================================================================== RF006 / RF009: COLETA

  /** PATCH /contagem — atualiza uma única célula (fase × amostra) de um talhão. */
  async atualizarCelulaContagem(id: string, numeroTalhao: number, corpo: unknown) {
    const dto = objeto<Record<string, unknown>>(corpo);
    const codigoFase = texto(dto.codigoFase, 'codigoFase', true, 20);
    const indiceAmostra = inteiro(dto.indiceAmostra, 'indiceAmostra', 0, 99);
    const quantidade = numero(dto.quantidade, 'quantidade', 0, 1_000_000);

    const talhaoId = await this.buscarTalhaoId(id, numeroTalhao);
    const fases = await this.repo.listarCodigosFase(id);
    if (!fases.includes(codigoFase)) {
      throw ApiException.badRequest(`A fase "${codigoFase}" não existe neste cenário.`);
    }
    await this.repo.atualizarValorAmostra(talhaoId, codigoFase, indiceAmostra, quantidade);
    return { talhao: numeroTalhao, codigoFase, indiceAmostra, quantidade };
  }

  /** PUT /coleta — substitui toda a estrutura de fases, talhões, amostras e contagens. */
  async sincronizarColeta(id: string, corpo: unknown): Promise<CenarioAnaliticoModel> {
    const cenario = await this.buscarCenario(id);
    const dto = objeto<Record<string, unknown>>(corpo);

    const fases = lista<Record<string, unknown>>(dto.fases, 'fases', 2).map((f, i) => ({
      codigo: texto(f?.codigo, `fases[${i}].codigo`, true, 20),
      label: texto(f?.label ?? f?.codigo, `fases[${i}].label`, true, 60),
    }));
    if (new Set(fases.map((f) => f.codigo)).size !== fases.length) {
      throw ApiException.badRequest('Existem fases com código repetido.');
    }

    const areas = await this.catalogo.listarAreas();
    const talhoesEntrada = lista<Record<string, unknown>>(dto.talhoes, 'talhoes', 2);
    if (talhoesEntrada.length > 100) throw ApiException.badRequest('O cenário aceita no máximo 100 talhões.');

    let maxAmostras = 1;
    const talhoes: TalhaoParaGravar[] = talhoesEntrada.map((t, i) => {
      const numeroTalhao = i + 1;
      const areaId = (t?.areaExperimentalId as string) ?? cenario.areaExperimentalId ?? areas[0]?.id ?? null;
      const amostras = lista<Record<string, unknown>>(t?.amostras, `talhoes[${i}].amostras`, 1).map((a, j) => ({
        indice: j,
        latitude: numero(a?.latitude, `talhoes[${i}].amostras[${j}].latitude`, -90, 90),
        longitude: numero(a?.longitude, `talhoes[${i}].amostras[${j}].longitude`, -180, 180),
        dataHoraColeta: String(a?.dataHoraColeta ?? this.agoraFormatado()),
        observacao: a?.observacao ? String(a.observacao).slice(0, 255) : null,
      }));
      if (amostras.length > 100) throw ApiException.badRequest(`Talhão ${numeroTalhao}: máximo de 100 amostras.`);
      maxAmostras = Math.max(maxAmostras, amostras.length);

      const contagensEntrada = objeto<Record<string, unknown[]>>(t?.contagens ?? {}, `talhoes[${i}].contagens`);
      const contagens: Record<string, number[]> = {};
      for (const f of fases) {
        const valores = Array.isArray(contagensEntrada[f.codigo]) ? contagensEntrada[f.codigo] : [];
        contagens[f.codigo] = amostras.map((_, j) => {
          const v = Number(valores[j] ?? 0);
          if (!Number.isFinite(v) || v < 0) {
            throw ApiException.badRequest(`Contagem inválida no talhão ${numeroTalhao}, fase ${f.codigo}, amostra ${j + 1}.`);
          }
          return v;
        });
      }
      return {
        numero: numeroTalhao,
        nome: t?.nome ? String(t.nome).slice(0, 100) : `Talhão ${numeroTalhao}`,
        areaExperimentalId: areas.some((a) => a.id === areaId) ? areaId : null,
        amostras,
        contagens,
      };
    });

    await this.repo.substituirTalhoesEFases(id, fases, talhoes, maxAmostras);
    return this.buscarCenario(id);
  }

  // =========================================================================== RF008: MAPA

  /**
   * Move o talhão para a coordenada clicada no mapa: calcula o deslocamento (Δlat, Δlng)
   * entre o centroide atual e o ponto clicado, translada todas as amostras mantendo a
   * dispersão relativa e associa a área experimental mais próxima (RN012).
   */
  async moverRegiaoDoTalhao(id: string, numeroTalhao: number, corpo: unknown) {
    const dto = objeto<Record<string, unknown>>(corpo);
    const areas = await this.catalogo.listarAreas();

    let destinoLat: number;
    let destinoLng: number;
    let area: AreaExperimentalModel | undefined;
    if (dto.areaExperimentalId && dto.latitude === undefined) {
      area = areas.find((a) => a.id === dto.areaExperimentalId);
      if (!area) throw ApiException.badRequest(`Área experimental "${String(dto.areaExperimentalId)}" não existe.`);
      destinoLat = area.latitude;
      destinoLng = area.longitude;
    } else {
      destinoLat = numero(dto.latitude, 'latitude', -90, 90);
      destinoLng = numero(dto.longitude, 'longitude', -180, 180);
      area = this.areaMaisProxima(areas, destinoLat, destinoLng);
    }

    const talhaoId = await this.buscarTalhaoId(id, numeroTalhao);
    const amostras = await this.repo.listarAmostrasDoTalhao(talhaoId);
    if (amostras.length === 0) throw ApiException.badRequest('O talhão não possui amostras para mover.');

    const centroLat = amostras.reduce((s, a) => s + a.latitude, 0) / amostras.length;
    const centroLng = amostras.reduce((s, a) => s + a.longitude, 0) / amostras.length;
    const deltaLat = destinoLat - centroLat;
    const deltaLng = destinoLng - centroLng;

    await this.repo.moverRegiaoTalhao(talhaoId, deltaLat, deltaLng, area?.id ?? null);
    return {
      talhao: numeroTalhao,
      deltaLat,
      deltaLng,
      areaExperimentalId: area?.id ?? null,
      areaExperimentalNome: area?.nomeCurto ?? null,
      cenario: await this.buscarCenario(id),
    };
  }

  async atualizarCoordenadaAmostra(id: string, numeroTalhao: number, indice: number, corpo: unknown) {
    const dto = objeto<Record<string, unknown>>(corpo);
    const latitude = numero(dto.latitude, 'latitude', -90, 90);
    const longitude = numero(dto.longitude, 'longitude', -180, 180);
    const talhaoId = await this.buscarTalhaoId(id, numeroTalhao);
    const alteradas = await this.repo.atualizarCoordenadaAmostra(talhaoId, indice, latitude, longitude);
    if (alteradas === 0) throw ApiException.notFound(`Amostra A${indice + 1} não encontrada no talhão ${numeroTalhao}.`);
    return { talhao: numeroTalhao, indice, latitude, longitude };
  }

  // =========================================================================== AUXILIARES

  private async buscarTalhaoId(id: string, numeroTalhao: number): Promise<number> {
    await this.buscarCenario(id);
    const talhaoId = await this.repo.buscarTalhaoId(id, numeroTalhao);
    if (!talhaoId) throw ApiException.notFound(`Talhão ${numeroTalhao} não encontrado no cenário "${id}".`);
    return talhaoId;
  }

  private areaMaisProxima(areas: AreaExperimentalModel[], lat: number, lng: number) {
    return areas.reduce<AreaExperimentalModel | undefined>((melhor, a) => {
      const d = (a.latitude - lat) ** 2 + (a.longitude - lng) ** 2;
      const dMelhor = melhor ? (melhor.latitude - lat) ** 2 + (melhor.longitude - lng) ** 2 : Infinity;
      return d < dMelhor ? a : melhor;
    }, undefined);
  }

  private agoraFormatado(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  /**
   * Gera os talhões do novo cenário:
   *  - distribui os talhões em grade dentro da área experimental (ou alterna entre as 4 áreas);
   *  - cria as amostras georreferenciadas em grade dentro de cada talhão;
   *  - preenche as contagens com zeros ou com uma coorte simulada realista (modo 'demo').
   */
  private gerarTalhoes(
    numTalhoes: number,
    numAmostras: number,
    fases: FaseCicloVida[],
    areas: AreaExperimentalModel[],
    areaFixa: AreaExperimentalModel | null,
    modoDados: 'demo' | 'zerado',
  ): TalhaoParaGravar[] {
    const dataColeta = this.agoraFormatado();
    const talhoesPorArea = new Map<string, number>();

    return Array.from({ length: numTalhoes }, (_, t) => {
      const area = areaFixa ?? areas[t % Math.max(areas.length, 1)];
      const posicaoNaArea = talhoesPorArea.get(area.id) ?? 0;
      talhoesPorArea.set(area.id, posicaoNaArea + 1);
      const totalNaArea = areaFixa ? numTalhoes : Math.ceil(numTalhoes / areas.length);

      // grade de talhões dentro da área
      const colunas = Math.ceil(Math.sqrt(totalNaArea));
      const celula = LADO_AREA_GRAUS / colunas;
      const linha = Math.floor(posicaoNaArea / colunas);
      const coluna = posicaoNaArea % colunas;
      const centroLat = area.latitude + LADO_AREA_GRAUS / 2 - celula * (linha + 0.5);
      const centroLng = area.longitude - LADO_AREA_GRAUS / 2 + celula * (coluna + 0.5);

      // grade de amostras dentro do talhão
      const lado = Math.ceil(Math.sqrt(numAmostras));
      const passo = (celula * 0.7) / Math.max(lado, 1);
      const amostras = Array.from({ length: numAmostras }, (_, j) => ({
        indice: j,
        latitude: centroLat - (Math.floor(j / lado) - (lado - 1) / 2) * passo,
        longitude: centroLng + ((j % lado) - (lado - 1) / 2) * passo,
        dataHoraColeta: dataColeta,
        observacao: `${area.nomeCurto} — Talhão ${t + 1} — Amostra ${j + 1}`,
      }));

      return {
        numero: t + 1,
        nome: `Talhão ${t + 1}`,
        areaExperimentalId: area.id,
        amostras,
        contagens: modoDados === 'demo' ? this.gerarContagensDemo(fases, numAmostras) : this.contagensZeradas(fases, numAmostras),
      };
    });
  }

  private contagensZeradas(fases: FaseCicloVida[], numAmostras: number): Record<string, number[]> {
    return Object.fromEntries(fases.map((f) => [f.codigo, new Array(numAmostras).fill(0)]));
  }

  /**
   * Simula uma coorte por amostra: começa com 3 a 12 ovos e, em cada fase, uma parte morre
   * (mortalidade de 5% a 40%, com uma fase "crítica" de 35% a 65%). A contagem de cada fase é o
   * número de indivíduos que pararam naquela fase; os sobreviventes finais são os adultos.
   */
  private gerarContagensDemo(fases: FaseCicloVida[], numAmostras: number): Record<string, number[]> {
    const ultimo = fases.length - 1;
    const faseCritica = 1 + Math.floor(Math.random() * Math.max(ultimo - 1, 1));
    const mortalidade = fases.map((_, i) =>
      i === faseCritica ? 0.35 + Math.random() * 0.3 : 0.05 + Math.random() * 0.35,
    );
    const contagens = this.contagensZeradas(fases, numAmostras);
    for (let j = 0; j < numAmostras; j++) {
      let vivos = 3 + Math.floor(Math.random() * 10);
      fases.forEach((f, i) => {
        if (i === ultimo) {
          contagens[f.codigo][j] = vivos;
          return;
        }
        let mortos = 0;
        for (let k = 0; k < vivos; k++) if (Math.random() < mortalidade[i]) mortos++;
        contagens[f.codigo][j] = mortos;
        vivos -= mortos;
      });
    }
    return contagens;
  }
}
