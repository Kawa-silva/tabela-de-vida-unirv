import { TabelaVidaTalhao } from './life-table.math';

/**
 * Prévia do estágio crítico pelo critério de Podoler & Rogers (1975):
 * inclinação b da regressão de cada kx sobre o Ktotal dos talhões; o maior b indica o fator-chave.
 * (A análise estatística completa — Pearson, ANOVA, ranking — entra na Entrega 2.)
 */
export function previaEstagioCritico(tabelas: TabelaVidaTalhao[]): { codigo: string; label: string; b: number } | null {
  if (tabelas.length < 2) return null;
  const K = tabelas.map((t) => t.Ktotal);
  const mK = K.reduce((s, v) => s + v, 0) / K.length;
  const varK = K.reduce((s, v) => s + (v - mK) ** 2, 0);
  if (varK === 0) return null;
  const linhas = tabelas[0].linhas.filter((l) => !l.isTerminal);
  let melhor: { codigo: string; label: string; b: number } | null = null;
  linhas.forEach((linha, i) => {
    const k = tabelas.map((t) => t.linhas[i].kx);
    const mk = k.reduce((s, v) => s + v, 0) / k.length;
    const b = K.reduce((s, v, j) => s + (v - mK) * (k[j] - mk), 0) / varK;
    if (!melhor || b > melhor.b) melhor = { codigo: linha.codigo, label: linha.label, b };
  });
  return melhor;
}
