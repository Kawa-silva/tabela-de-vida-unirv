/**
 * MOTOR MATEMÁTICO DA TABELA DE VIDA ECOLÓGICA (funções puras, sem dependência de framework)
 *
 * Este arquivo é usado pelo backend (LifeTableMathEngine) e pode ser copiado sem alterações
 * para o frontend Angular (life-table.math.ts), garantindo que os dois calculem igual.
 *
 * Convenções adotadas (validadas contra a planilha dados.xlsx do professor):
 *  - soma(x): total de indivíduos contados na fase x somando todas as amostras do talhão.
 *  - Lx (modo 'acumulado', padrão da planilha): indivíduos que ATINGIRAM a fase x
 *        = soma(x) + soma(x+1) + ... + soma(adulto).
 *    (modo 'direto': Lx = soma(x), conforme a RN010 literal do enunciado.)
 *  - dx = Lx - Lx+1      100qx = dx / Lx * 100      Sx = Lx+1 / Lx
 *  - 100rx = dx / L0 * 100 (ecológico)  |  modo planilha: encadeado sobre a sobrevivência anterior
 *  - kx = log10(Lx) - log10(Lx+1)       Ktotal = soma dos kx
 *  - Tabela média: cada talhão é normalizado para uma coorte de 1000 ovos (como na planilha)
 *    e depois são tiradas as médias de Lx e dx.
 *  - MIx = L̄final * 100q̄x / (100 - 100q̄x)      %MIx = MIx / L̄0 * 100
 *  - Divisões por zero e log de zero retornam 0 (RN016).
 */

export type ModoLx = 'acumulado' | 'direto';

export interface FaseInput {
  codigo: string;
  label: string;
}

export interface TalhaoInput {
  numero: number;
  nome: string;
  /** contagens[codigoFase] = array com a contagem de cada amostra */
  contagens: Record<string, number[]>;
}

export interface OpcoesCalculo {
  usar100rxPlanilha?: boolean;
  modoLx?: ModoLx;
  /** tamanho da coorte normalizada usada na tabela média (planilha usa 1000) */
  coorteBase?: number;
}

export interface LinhaTabelaVida {
  codigo: string;
  label: string;
  soma: number;
  Lx: number;
  dx: number;
  lx: number;
  q100: number;
  r100: number;
  Sx: number;
  kx: number;
  isTerminal: boolean;
}

export interface TabelaVidaTalhao {
  talhaoNumero: number;
  talhaoNome: string;
  linhas: LinhaTabelaVida[];
  L0: number;
  adultos: number;
  somaDx: number;
  Ktotal: number;
  mortalidadeTotal: number;
  faseMaiorK: string | null;
}

export interface LinhaTabelaMedia {
  codigo: string;
  label: string;
  Lmedio: number;
  dmedio: number;
  LdesvioPadrao: number;
  LerroPadrao: number;
  ddesvioPadrao: number;
  derroPadrao: number;
  lx: number;
  q100: number;
  r100: number;
  Sx: number;
  kx: number;
  MIx: number;
  MIxPercentual: number;
  isTerminal: boolean;
}

export interface TabelaMedia {
  numTalhoes: number;
  coorteBase: number;
  linhas: LinhaTabelaMedia[];
  Ktotal: number;
  sobrevivenciaGlobal: number;
  mortalidadeTotalMedia: number;
  faseMaiorK: string | null;
  faseMaiorMI: string | null;
}

export interface ResultadoAnalise {
  tabelasPorTalhao: TabelaVidaTalhao[];
  tabelaMedia: TabelaMedia;
}

// ---------------------------------------------------------------- utilidades numéricas

const div = (a: number, b: number): number => (b > 0 ? a / b : 0);

const log10Seguro = (a: number, b: number): number =>
  a > 0 && b > 0 ? Math.log10(a) - Math.log10(b) : 0;

export function media(valores: number[]): number {
  return valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : 0;
}

/** desvio padrão amostral (n - 1), igual ao DESVPAD.A / STDEV.S do Excel */
export function desvioPadrao(valores: number[]): number {
  if (valores.length < 2) return 0;
  const m = media(valores);
  return Math.sqrt(valores.reduce((s, v) => s + (v - m) ** 2, 0) / (valores.length - 1));
}

export function erroPadrao(valores: number[]): number {
  return valores.length ? desvioPadrao(valores) / Math.sqrt(valores.length) : 0;
}

// ---------------------------------------------------------------- Lx por talhão

export function somasPorFase(talhao: TalhaoInput, fases: FaseInput[]): number[] {
  return fases.map((f) =>
    (talhao.contagens[f.codigo] ?? []).reduce((s, v) => s + (Number(v) || 0), 0),
  );
}

export function calcularLx(somas: number[], modo: ModoLx = 'acumulado'): number[] {
  if (modo === 'direto') return [...somas];
  const Lx = new Array<number>(somas.length).fill(0);
  let acumulado = 0;
  for (let i = somas.length - 1; i >= 0; i--) {
    acumulado += somas[i];
    Lx[i] = acumulado;
  }
  return Lx;
}

// ---------------------------------------------------------------- RF010: tabela por talhão

export function computeLifeTableForPlot(
  talhao: TalhaoInput,
  fases: FaseInput[],
  opcoes: OpcoesCalculo = {},
): TabelaVidaTalhao {
  const somas = somasPorFase(talhao, fases);
  const Lx = calcularLx(somas, opcoes.modoLx);
  const L0 = Lx[0] ?? 0;
  const ultimo = fases.length - 1;

  let sobrevivenciaAnterior = 1; // usada no modo planilha encadeado
  const linhas: LinhaTabelaVida[] = fases.map((fase, i) => {
    const terminal = i === ultimo;
    const atual = Lx[i];
    const proximo = terminal ? 0 : Lx[i + 1];
    const dx = terminal ? 0 : atual - proximo;
    const q100 = terminal ? 0 : div(dx, atual) * 100;

    let r100 = 0;
    if (!terminal) {
      if (opcoes.usar100rxPlanilha) {
        r100 = (q100 / 100) * sobrevivenciaAnterior * 100;
        sobrevivenciaAnterior *= 1 - q100 / 100;
      } else {
        r100 = div(dx, L0) * 100;
      }
    }

    return {
      codigo: fase.codigo,
      label: fase.label,
      soma: somas[i],
      Lx: atual,
      dx,
      lx: div(atual, L0) * 100,
      q100,
      r100,
      Sx: terminal ? 0 : div(proximo, atual),
      kx: terminal ? 0 : log10Seguro(atual, proximo),
      isTerminal: terminal,
    };
  });

  const imaturas = linhas.filter((l) => !l.isTerminal);
  const Ktotal = imaturas.reduce((s, l) => s + l.kx, 0);
  const adultos = Lx[ultimo] ?? 0;
  const maior = imaturas.reduce<LinhaTabelaVida | null>(
    (m, l) => (l.kx > 0 && (!m || l.kx > m.kx) ? l : m),
    null,
  );

  return {
    talhaoNumero: talhao.numero,
    talhaoNome: talhao.nome,
    linhas,
    L0,
    adultos,
    somaDx: imaturas.reduce((s, l) => s + l.dx, 0),
    Ktotal,
    mortalidadeTotal: div(L0 - adultos, L0) * 100,
    faseMaiorK: maior?.codigo ?? null,
  };
}

// ---------------------------------------------------------------- RF011: tabela média + MIx

export function computeMeanLifeTable(
  talhoes: TalhaoInput[],
  fases: FaseInput[],
  opcoes: OpcoesCalculo = {},
): TabelaMedia {
  const base = opcoes.coorteBase ?? 1000;
  const ultimo = fases.length - 1;

  // normaliza cada talhão para uma coorte de `base` indivíduos (talhões sem ovos são ignorados)
  const normalizados = talhoes
    .map((t) => calcularLx(somasPorFase(t, fases), opcoes.modoLx))
    .filter((Lx) => Lx[0] > 0)
    .map((Lx) => Lx.map((v) => (v / Lx[0]) * base));

  const LporFase = fases.map((_, i) => normalizados.map((Lx) => Lx[i]));
  const dporFase = fases.map((_, i) =>
    i === ultimo ? [] : normalizados.map((Lx) => Lx[i] - Lx[i + 1]),
  );

  const Lmedio = LporFase.map(media);
  const dmedio = dporFase.map(media);
  const L0 = Lmedio[0] ?? 0;
  const Lfinal = Lmedio[ultimo] ?? 0;

  let sobrevivenciaAnterior = 1;
  const linhas: LinhaTabelaMedia[] = fases.map((fase, i) => {
    const terminal = i === ultimo;
    const q100 = terminal ? 0 : div(dmedio[i], Lmedio[i]) * 100;
    let r100 = 0;
    if (!terminal) {
      if (opcoes.usar100rxPlanilha) {
        r100 = (q100 / 100) * sobrevivenciaAnterior * 100;
        sobrevivenciaAnterior *= 1 - q100 / 100;
      } else {
        r100 = div(dmedio[i], L0) * 100;
      }
    }
    const MIx = terminal || q100 >= 100 ? 0 : Lfinal * (q100 / (100 - q100));
    return {
      codigo: fase.codigo,
      label: fase.label,
      Lmedio: Lmedio[i],
      dmedio: terminal ? 0 : dmedio[i],
      LdesvioPadrao: desvioPadrao(LporFase[i]),
      LerroPadrao: erroPadrao(LporFase[i]),
      ddesvioPadrao: desvioPadrao(dporFase[i]),
      derroPadrao: erroPadrao(dporFase[i]),
      lx: div(Lmedio[i], L0) * 100,
      q100,
      r100,
      Sx: terminal ? 0 : div(Lmedio[i + 1], Lmedio[i]),
      kx: terminal ? 0 : log10Seguro(Lmedio[i], Lmedio[i + 1]),
      MIx,
      MIxPercentual: div(MIx, L0) * 100,
      isTerminal: terminal,
    };
  });

  const imaturas = linhas.filter((l) => !l.isTerminal);
  const maiorK = imaturas.reduce<LinhaTabelaMedia | null>(
    (m, l) => (l.kx > 0 && (!m || l.kx > m.kx) ? l : m),
    null,
  );
  const maiorMI = imaturas.reduce<LinhaTabelaMedia | null>(
    (m, l) => (l.MIx > 0 && (!m || l.MIx > m.MIx) ? l : m),
    null,
  );

  return {
    numTalhoes: normalizados.length,
    coorteBase: base,
    linhas,
    Ktotal: imaturas.reduce((s, l) => s + l.kx, 0),
    sobrevivenciaGlobal: div(Lfinal, L0) * 100,
    mortalidadeTotalMedia: media(normalizados.map((Lx) => div(Lx[0] - Lx[ultimo], Lx[0]) * 100)),
    faseMaiorK: maiorK?.codigo ?? null,
    faseMaiorMI: maiorMI?.codigo ?? null,
  };
}

// ---------------------------------------------------------------- análise completa

export function computeCompleteAnalysis(
  talhoes: TalhaoInput[],
  fases: FaseInput[],
  opcoes: OpcoesCalculo = {},
): ResultadoAnalise {
  return {
    tabelasPorTalhao: talhoes.map((t) => computeLifeTableForPlot(t, fases, opcoes)),
    tabelaMedia: computeMeanLifeTable(talhoes, fases, opcoes),
  };
}
