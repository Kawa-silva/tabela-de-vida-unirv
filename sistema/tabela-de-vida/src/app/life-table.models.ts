/**
 * Contratos de dados consumidos da API REST (espelham backend/src/models/domain.models.ts).
 * Nenhum dado fica fixo no frontend: tudo vem do PostgreSQL via HttpClient.
 */

export interface FaseCicloVida {
  codigo: string;
  label: string;
}

export interface PragaInfo {
  id: string;
  culturaId: string;
  nomeComum: string;
  nomeCientifico: string;
  ordem: string | null;
  faseCriticaTipica: string | null;
  descricao: string;
  imagem: string;
  fasesSugeridas: FaseCicloVida[];
}

export interface CulturaInfo {
  id: string;
  nome: string;
  nomeCientifico: string;
  familia: string;
  descricao: string;
  imagem: string;
  pragas: PragaInfo[];
}

export interface UnirvExperimentalArea {
  id: string;
  nome: string;
  nomeCurto: string;
  descricao: string;
  dmsLat: string;
  dmsLng: string;
  latitude: number;
  longitude: number;
  poligono: [number, number][];
}

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  cargo: string;
}

export interface FaseCenario extends FaseCicloVida {
  ordem: number;
  isInitial: boolean;
  isTerminal: boolean;
}

export interface SamplePoint {
  indice: number;
  latitude: number;
  longitude: number;
  dataHoraColeta: string;
  observacao: string | null;
}

export interface PlotData {
  id?: number;
  numero: number;
  nome: string;
  areaExperimentalId: string | null;
  amostras: SamplePoint[];
  /** contagens[codigoFase][indiceAmostra] */
  contagens: Record<string, number[]>;
}

export interface CenarioAnalitico {
  id: string;
  nome: string;
  usuarioId: number | null;
  usuarioNome: string;
  culturaId: string;
  culturaNome: string;
  pragaId: string;
  pragaNome: string;
  pragaNomeCientifico: string;
  areaExperimentalId: string | null;
  numTalhoes: number;
  numAmostrasPorTalhao: number;
  observacoes: string | null;
  ativo: boolean;
  usar100rxPlanilha: boolean;
  criadoEm: string;
  atualizadoEm: string;
  fases: FaseCenario[];
  talhoes: PlotData[];
}

export interface CriarCenarioPayload {
  nome: string;
  usuarioNome: string;
  usuarioId?: number | null;
  culturaId: string;
  pragaId: string;
  areaExperimentalId?: string | null;
  numTalhoes: number;
  numAmostrasPorTalhao: number;
  observacoes?: string | null;
  modoDados: 'demo' | 'zerado';
}

export interface MetadadosCenario {
  nome?: string;
  usuarioNome?: string;
  criadoEm?: string;
  observacoes?: string | null;
  usar100rxPlanilha?: boolean;
}

export type ModoImportacao = 'replace' | 'append' | 'single';
