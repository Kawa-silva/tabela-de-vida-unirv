/**
 * Modelos de domínio e DTOs (contratos JSON trocados entre o backend e o frontend Angular).
 */

export interface FaseCicloVida {
  codigo: string;
  label: string;
}

export interface PragaModel {
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

export interface CulturaModel {
  id: string;
  nome: string;
  nomeCientifico: string;
  familia: string;
  descricao: string;
  imagem: string;
  pragas: PragaModel[];
}

export interface AreaExperimentalModel {
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

export interface UsuarioModel {
  id: number;
  nome: string;
  email: string;
  creaRegistro: string | null;
  instituicao: string;
  cargo: string;
}

export interface FaseCenarioModel extends FaseCicloVida {
  ordem: number;
  isInitial: boolean;
  isTerminal: boolean;
}

export interface PontoAmostralModel {
  indice: number;
  latitude: number;
  longitude: number;
  dataHoraColeta: string;
  observacao: string | null;
}

export interface TalhaoModel {
  id: number;
  numero: number;
  nome: string;
  areaExperimentalId: string | null;
  amostras: PontoAmostralModel[];
  /** contagens[codigoFase][indiceAmostra] = quantidade */
  contagens: Record<string, number[]>;
}

export interface CenarioAnaliticoModel {
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
  fases: FaseCenarioModel[];
  talhoes: TalhaoModel[];
}

// ------------------------------------------------------------------ DTOs (entrada)

export interface CriarCenarioDTO {
  nome: string;
  usuarioNome: string;
  usuarioId?: number | null;
  culturaId: string;
  pragaId: string;
  areaExperimentalId?: string | null;
  numTalhoes: number;
  numAmostrasPorTalhao: number;
  observacoes?: string | null;
  /** 'demo' = gera contagens realistas | 'zerado' = planilha em branco */
  modoDados?: 'demo' | 'zerado';
}

export interface AtualizarCenarioMetadadosDTO {
  nome?: string;
  usuarioNome?: string;
  criadoEm?: string;
  observacoes?: string | null;
  usar100rxPlanilha?: boolean;
}

export interface AtualizarContagemDTO {
  codigoFase: string;
  indiceAmostra: number;
  quantidade: number;
}

export interface SincronizarColetaDTO {
  fases: FaseCicloVida[];
  talhoes: {
    numero: number;
    nome?: string;
    areaExperimentalId?: string | null;
    amostras: { indice: number; latitude: number; longitude: number; dataHoraColeta?: string; observacao?: string | null }[];
    contagens: Record<string, number[]>;
  }[];
}

export interface MoverTalhaoDTO {
  latitude: number;
  longitude: number;
  areaExperimentalId?: string | null;
}

export interface AtualizarCoordenadaDTO {
  latitude: number;
  longitude: number;
}
