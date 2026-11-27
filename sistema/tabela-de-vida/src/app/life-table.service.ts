import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from './api.config';
import { computeCompleteAnalysis, ResultadoAnalise } from './life-table.math';
import {
  CenarioAnalitico,
  CriarCenarioPayload,
  FaseCicloVida,
  MetadadosCenario,
  ModoImportacao,
  PlotData,
  SamplePoint,
} from './life-table.models';

export interface Notificacao {
  id: number;
  texto: string;
  tipo: 'sucesso' | 'erro' | 'info';
}

/**
 * LifeTableService — estado central da aplicação com Angular Signals.
 *
 *  - guarda os cenários carregados de GET /api/cenarios e o cenário ativo;
 *  - expõe sinais computados (analise, plotLifeTables, meanLifeTable) que recalculam
 *    as tabelas de vida instantaneamente quando qualquer contagem muda (RN014);
 *  - sincroniza todas as alterações com o backend NestJS via HttpClient.
 */
@Injectable({ providedIn: 'root' })
export class LifeTableService {
  private readonly http = inject(HttpClient);

  // ------------------------------------------------------------------ estado
  readonly cenarios = signal<CenarioAnalitico[]>([]);
  readonly cenarioAtivoId = signal<string | null>(null);
  readonly selectedPlotIndex = signal(0);
  readonly carregando = signal(false);
  readonly salvando = signal(false);

  /** navegação da interface */
  readonly abaAtiva = signal(0);
  readonly mostrarAssistente = signal(false);
  readonly mostrarImportar = signal(false);
  readonly notificacoes = signal<Notificacao[]>([]);

  // ------------------------------------------------------------------ sinais computados
  readonly cenarioAtivo = computed(
    () => this.cenarios().find((c) => c.id === this.cenarioAtivoId()) ?? null,
  );

  readonly talhaoSelecionado = computed(() => {
    const cenario = this.cenarioAtivo();
    if (!cenario || cenario.talhoes.length === 0) return null;
    return cenario.talhoes[Math.min(this.selectedPlotIndex(), cenario.talhoes.length - 1)];
  });

  /** RF010 + RF011 — recalculado automaticamente a cada alteração do cenário ativo */
  readonly analise = computed<ResultadoAnalise | null>(() => {
    const cenario = this.cenarioAtivo();
    if (!cenario || cenario.fases.length < 2 || cenario.talhoes.length === 0) return null;
    return computeCompleteAnalysis(cenario.talhoes, cenario.fases, {
      usar100rxPlanilha: cenario.usar100rxPlanilha,
    });
  });

  readonly plotLifeTables = computed(() => this.analise()?.tabelasPorTalhao ?? []);
  readonly meanLifeTable = computed(() => this.analise()?.tabelaMedia ?? null);

  // ------------------------------------------------------------------ notificações
  notificar(texto: string, tipo: Notificacao['tipo'] = 'sucesso'): void {
    const id = Date.now() + Math.random();
    this.notificacoes.update((lista) => [...lista, { id, texto, tipo }]);
    setTimeout(() => this.notificacoes.update((lista) => lista.filter((n) => n.id !== id)), 4500);
  }

  private tratarErro(erro: unknown, padrao: string): void {
    const mensagem =
      erro instanceof HttpErrorResponse
        ? erro.status === 0
          ? 'Sem conexão com o backend (porta 3000).'
          : (erro.error?.mensagem ?? padrao)
        : padrao;
    this.notificar(mensagem, 'erro');
  }

  // ------------------------------------------------------------------ carregamento
  async carregarCenariosDoBackend(): Promise<void> {
    this.carregando.set(true);
    try {
      const lista = await firstValueFrom(this.http.get<CenarioAnalitico[]>(`${API_URL}/cenarios`));
      this.cenarios.set(lista);
      if (!lista.some((c) => c.id === this.cenarioAtivoId())) {
        this.cenarioAtivoId.set(lista.find((c) => c.ativo)?.id ?? lista[0]?.id ?? null);
      }
    } catch (erro) {
      this.tratarErro(erro, 'Erro ao carregar os cenários.');
    } finally {
      this.carregando.set(false);
    }
  }

  private substituirCenario(atualizado: CenarioAnalitico): void {
    this.cenarios.update((lista) => {
      const existe = lista.some((c) => c.id === atualizado.id);
      return existe ? lista.map((c) => (c.id === atualizado.id ? atualizado : c)) : [atualizado, ...lista];
    });
  }

  private async recarregarCenario(id: string): Promise<void> {
    const cenario = await firstValueFrom(this.http.get<CenarioAnalitico>(`${API_URL}/cenarios/${id}`));
    this.substituirCenario(cenario);
  }

  // ------------------------------------------------------------------ RF003 / RF004 / RF005
  async criarCenario(payload: CriarCenarioPayload): Promise<boolean> {
    this.salvando.set(true);
    try {
      const novo = await firstValueFrom(this.http.post<CenarioAnalitico>(`${API_URL}/cenarios`, payload));
      this.cenarios.update((lista) => [novo, ...lista.map((c) => ({ ...c, ativo: false }))]);
      this.cenarioAtivoId.set(novo.id);
      this.selectedPlotIndex.set(0);
      this.notificar(`Cenário "${novo.nome}" criado com ${novo.numTalhoes} talhões.`);
      return true;
    } catch (erro) {
      this.tratarErro(erro, 'Erro ao criar o cenário.');
      return false;
    } finally {
      this.salvando.set(false);
    }
  }

  /** RN003 — ativa o cenário no backend e abre a Aba 1 (Coleta & Amostras) */
  async abrirColeta(id: string): Promise<void> {
    try {
      await firstValueFrom(this.http.patch(`${API_URL}/cenarios/${id}/ativar`, {}));
      this.cenarios.update((lista) => lista.map((c) => ({ ...c, ativo: c.id === id })));
      this.cenarioAtivoId.set(id);
      this.selectedPlotIndex.set(0);
      this.abaAtiva.set(1);
    } catch (erro) {
      this.tratarErro(erro, 'Erro ao abrir a coleta.');
    }
  }

  async atualizarMetadadosCenario(id: string, dados: MetadadosCenario): Promise<boolean> {
    try {
      const atualizado = await firstValueFrom(this.http.put<CenarioAnalitico>(`${API_URL}/cenarios/${id}`, dados));
      this.substituirCenario(atualizado);
      return true;
    } catch (erro) {
      this.tratarErro(erro, 'Erro ao salvar os dados do cenário.');
      return false;
    }
  }

  async duplicarCenario(id: string): Promise<void> {
    try {
      const copia = await firstValueFrom(this.http.post<CenarioAnalitico>(`${API_URL}/cenarios/${id}/duplicar`, {}));
      this.substituirCenario(copia);
      this.notificar(`Cenário duplicado: "${copia.nome}".`);
    } catch (erro) {
      this.tratarErro(erro, 'Erro ao duplicar o cenário.');
    }
  }

  async excluirCenario(id: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete(`${API_URL}/cenarios/${id}`));
      this.notificar('Cenário excluído.');
      await this.carregarCenariosDoBackend();
    } catch (erro) {
      this.tratarErro(erro, 'Erro ao excluir o cenário.');
    }
  }

  /** RF010 / RN015 — alterna a convenção do 100rx e persiste no cenário */
  async setUseSpreadsheet100rx(valor: boolean): Promise<void> {
    const cenario = this.cenarioAtivo();
    if (!cenario) return;
    this.substituirCenario({ ...cenario, usar100rxPlanilha: valor });
    await this.atualizarMetadadosCenario(cenario.id, { usar100rxPlanilha: valor });
  }

  // ------------------------------------------------------------------ RF006: contagens
  /** Atualiza 1 célula na tela (sinal) e persiste via PATCH */
  async updateSampleValue(plotIndex: number, codigoFase: string, indiceAmostra: number, valor: number): Promise<void> {
    const cenario = this.cenarioAtivo();
    if (!cenario) return;
    const quantidade = Number.isFinite(valor) && valor >= 0 ? Math.floor(valor) : 0;
    const copia = structuredClone(cenario);
    const talhao = copia.talhoes[plotIndex];
    if (!talhao?.contagens[codigoFase]) return;
    talhao.contagens[codigoFase][indiceAmostra] = quantidade;
    this.substituirCenario(copia);
    try {
      await firstValueFrom(
        this.http.patch(`${API_URL}/cenarios/${cenario.id}/talhoes/${talhao.numero}/contagem`, {
          codigoFase,
          indiceAmostra,
          quantidade,
        }),
      );
    } catch (erro) {
      this.tratarErro(erro, 'Erro ao salvar a contagem.');
      await this.recarregarCenario(cenario.id);
    }
  }

  // ------------------------------------------------------------------ RF006 / RF009: estrutura da coleta
  /** PUT /coleta — envia a estrutura completa (fases, talhões, amostras e contagens) */
  async sincronizarCenarioAtivoNoBackend(fases: FaseCicloVida[], talhoes: PlotData[], mensagem?: string): Promise<boolean> {
    const cenario = this.cenarioAtivo();
    if (!cenario) return false;
    this.salvando.set(true);
    try {
      const atualizado = await firstValueFrom(
        this.http.put<CenarioAnalitico>(`${API_URL}/cenarios/${cenario.id}/coleta`, {
          fases: fases.map((f) => ({ codigo: f.codigo, label: f.label })),
          talhoes: talhoes.map((t) => ({
            nome: t.nome,
            areaExperimentalId: t.areaExperimentalId,
            amostras: t.amostras,
            contagens: t.contagens,
          })),
        }),
      );
      this.substituirCenario(atualizado);
      if (this.selectedPlotIndex() >= atualizado.talhoes.length) this.selectedPlotIndex.set(atualizado.talhoes.length - 1);
      if (mensagem) this.notificar(mensagem);
      return true;
    } catch (erro) {
      this.tratarErro(erro, 'Erro ao salvar a estrutura da coleta.');
      return false;
    } finally {
      this.salvando.set(false);
    }
  }

  /** Adiciona uma nova fase antes do estágio adulto (terminal) */
  async addStage(codigo: string, label: string): Promise<void> {
    const cenario = this.cenarioAtivo();
    if (!cenario) return;
    const cod = codigo.trim();
    if (!cod) return;
    if (cenario.fases.some((f) => f.codigo.toLowerCase() === cod.toLowerCase())) {
      this.notificar(`A fase "${cod}" já existe.`, 'erro');
      return;
    }
    const fases: FaseCicloVida[] = cenario.fases.map((f) => ({ codigo: f.codigo, label: f.label }));
    fases.splice(Math.max(fases.length - 1, 0), 0, { codigo: cod, label: label.trim() || cod });
    const talhoes = structuredClone(cenario.talhoes);
    talhoes.forEach((t) => (t.contagens[cod] = new Array(t.amostras.length).fill(0)));
    await this.sincronizarCenarioAtivoNoBackend(fases, talhoes, `Fase "${cod}" adicionada.`);
  }

  async removeStage(codigo: string): Promise<void> {
    const cenario = this.cenarioAtivo();
    if (!cenario) return;
    if (cenario.fases.length <= 2) {
      this.notificar('O cenário precisa de pelo menos 2 fases.', 'erro');
      return;
    }
    const fases = cenario.fases.filter((f) => f.codigo !== codigo).map((f) => ({ codigo: f.codigo, label: f.label }));
    const talhoes = structuredClone(cenario.talhoes);
    talhoes.forEach((t) => delete t.contagens[codigo]);
    await this.sincronizarCenarioAtivoNoBackend(fases, talhoes, `Fase "${codigo}" removida.`);
  }

  /** Novo talhão: copia a geometria do último talhão, deslocada um pouco ao sul */
  async addPlot(): Promise<void> {
    const cenario = this.cenarioAtivo();
    if (!cenario) return;
    const talhoes = structuredClone(cenario.talhoes);
    const base = talhoes[talhoes.length - 1];
    const numAmostras = base?.amostras.length || cenario.numAmostrasPorTalhao || 1;
    const novo: PlotData = {
      numero: talhoes.length + 1,
      nome: `Talhão ${talhoes.length + 1}`,
      areaExperimentalId: base?.areaExperimentalId ?? cenario.areaExperimentalId,
      amostras: this.gerarAmostras(base?.amostras ?? [], numAmostras, -0.0009, 0),
      contagens: Object.fromEntries(cenario.fases.map((f) => [f.codigo, new Array(numAmostras).fill(0)])),
    };
    talhoes.push(novo);
    if (await this.sincronizarCenarioAtivoNoBackend(cenario.fases, talhoes, `${novo.nome} adicionado.`)) {
      this.selectedPlotIndex.set(talhoes.length - 1);
    }
  }

  async removePlot(plotIndex: number): Promise<void> {
    const cenario = this.cenarioAtivo();
    if (!cenario) return;
    if (cenario.talhoes.length <= 2) {
      this.notificar('O cenário precisa de pelo menos 2 talhões para a análise estatística.', 'erro');
      return;
    }
    const talhoes = structuredClone(cenario.talhoes).filter((_, i) => i !== plotIndex);
    talhoes.forEach((t, i) => {
      t.numero = i + 1;
      if (/^Talhão \d+$/.test(t.nome)) t.nome = `Talhão ${i + 1}`;
    });
    await this.sincronizarCenarioAtivoNoBackend(cenario.fases, talhoes, 'Talhão removido.');
  }

  /** Acrescenta uma amostra (coluna) em todos os talhões */
  async addSample(): Promise<void> {
    const cenario = this.cenarioAtivo();
    if (!cenario) return;
    const talhoes = structuredClone(cenario.talhoes);
    for (const t of talhoes) {
      if (t.amostras.length >= 100) {
        this.notificar('Limite de 100 amostras por talhão.', 'erro');
        return;
      }
      const ultima = t.amostras[t.amostras.length - 1];
      t.amostras.push({
        indice: t.amostras.length,
        latitude: (ultima?.latitude ?? 0) - 0.00015,
        longitude: ultima?.longitude ?? 0,
        dataHoraColeta: ultima?.dataHoraColeta ?? '',
        observacao: null,
      });
      Object.values(t.contagens).forEach((linha) => linha.push(0));
    }
    await this.sincronizarCenarioAtivoNoBackend(cenario.fases, talhoes, 'Amostra adicionada em todos os talhões.');
  }

  // ------------------------------------------------------------------ RF008: mapa
  async movePlotToCoordinates(plotIndex: number, latitude: number, longitude: number): Promise<void> {
    await this.moverTalhao(plotIndex, { latitude, longitude });
  }

  async movePlotToArea(plotIndex: number, areaExperimentalId: string): Promise<void> {
    await this.moverTalhao(plotIndex, { areaExperimentalId });
  }

  private async moverTalhao(plotIndex: number, corpo: object): Promise<void> {
    const cenario = this.cenarioAtivo();
    const talhao = cenario?.talhoes[plotIndex];
    if (!cenario || !talhao) return;
    try {
      const resposta = await firstValueFrom(
        this.http.post<{ cenario: CenarioAnalitico; areaExperimentalNome: string | null }>(
          `${API_URL}/cenarios/${cenario.id}/talhoes/${talhao.numero}/mover-regiao`,
          corpo,
        ),
      );
      this.substituirCenario(resposta.cenario);
      this.notificar(`${talhao.nome} movido para ${resposta.areaExperimentalNome ?? 'a nova posição'}.`);
    } catch (erro) {
      this.tratarErro(erro, 'Erro ao mover o talhão.');
    }
  }

  async atualizarCoordenadaAmostra(plotIndex: number, indice: number, latitude: number, longitude: number): Promise<void> {
    const cenario = this.cenarioAtivo();
    const talhao = cenario?.talhoes[plotIndex];
    if (!cenario || !talhao) return;
    const copia = structuredClone(cenario);
    const amostra = copia.talhoes[plotIndex].amostras.find((a) => a.indice === indice);
    if (!amostra) return;
    amostra.latitude = latitude;
    amostra.longitude = longitude;
    this.substituirCenario(copia);
    try {
      await firstValueFrom(
        this.http.patch(`${API_URL}/cenarios/${cenario.id}/talhoes/${talhao.numero}/amostras/${indice}`, { latitude, longitude }),
      );
    } catch (erro) {
      this.tratarErro(erro, 'Erro ao salvar a coordenada.');
      await this.recarregarCenario(cenario.id);
    }
  }

  // ------------------------------------------------------------------ RF009: importação
  /**
   * Aplica matrizes importadas (cada bloco = 1 talhão, com contagens por fase) no cenário ativo.
   *  replace → substitui todos os talhões | append → adiciona novos | single → atualiza 1 talhão
   */
  async importFromTSV(blocos: Record<string, number[]>[], modo: ModoImportacao, plotIndex = 0): Promise<boolean> {
    const cenario = this.cenarioAtivo();
    if (!cenario || blocos.length === 0) return false;
    const atuais = structuredClone(cenario.talhoes);
    const montar = (bloco: Record<string, number[]>, numero: number, base?: PlotData): PlotData => {
      const numAmostras = Math.max(1, ...Object.values(bloco).map((v) => v.length));
      const referencia = base ?? atuais[(numero - 1) % Math.max(atuais.length, 1)];
      const deslocamento = base ? 0 : numero > atuais.length ? -0.0009 * (numero - atuais.length) : 0;
      return {
        numero,
        nome: base?.nome ?? `Talhão ${numero}`,
        areaExperimentalId: referencia?.areaExperimentalId ?? cenario.areaExperimentalId,
        amostras: this.gerarAmostras(referencia?.amostras ?? [], numAmostras, deslocamento, 0),
        contagens: Object.fromEntries(
          cenario.fases.map((f) => [f.codigo, Array.from({ length: numAmostras }, (_, j) => bloco[f.codigo]?.[j] ?? 0)]),
        ),
      };
    };

    let talhoes: PlotData[];
    if (modo === 'replace') {
      if (blocos.length < 2) {
        this.notificar('Para substituir todos os talhões, cole pelo menos 2 blocos (talhões).', 'erro');
        return false;
      }
      talhoes = blocos.map((b, i) => montar(b, i + 1, atuais[i]));
    } else if (modo === 'append') {
      talhoes = [...atuais, ...blocos.map((b, i) => montar(b, atuais.length + i + 1))];
    } else {
      talhoes = atuais.map((t, i) => (i === plotIndex ? montar(blocos[0], t.numero, t) : t));
    }
    return this.sincronizarCenarioAtivoNoBackend(cenario.fases, talhoes, `Importação concluída: ${blocos.length} bloco(s).`);
  }

  /** Reaproveita as coordenadas de referência (deslocadas) ou cria uma linha simples de pontos */
  private gerarAmostras(referencia: SamplePoint[], quantidade: number, dLat: number, dLng: number): SamplePoint[] {
    const ultima = referencia[referencia.length - 1];
    return Array.from({ length: quantidade }, (_, j) => {
      const ref = referencia[j];
      return {
        indice: j,
        latitude: ref ? ref.latitude + dLat : (ultima?.latitude ?? -17.785303) + dLat - 0.00015 * (j - referencia.length + 1),
        longitude: ref ? ref.longitude + dLng : (ultima?.longitude ?? -50.964869) + dLng,
        dataHoraColeta: ref?.dataHoraColeta ?? ultima?.dataHoraColeta ?? '',
        observacao: ref?.observacao ?? null,
      };
    });
  }
}
