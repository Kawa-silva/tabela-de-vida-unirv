import { FaseCenario } from './life-table.models';

/**
 * Converte o texto colado do Excel/LibreOffice/Google Sheets em blocos (1 bloco = 1 talhão).
 *  - separadores aceitos: TAB, ponto e vírgula ou espaços (RNF013);
 *  - blocos separados por linha "# Talhão N" ou por linha em branco;
 *  - 1ª coluna = código ou nome da fase (Ov, N1, "Ovo (Ov)"...); se for número, usa a ordem das linhas;
 *  - linhas de cabeçalho (sem números) são ignoradas.
 */
export function parseMatrizes(texto: string, fases: FaseCenario[]): Record<string, number[]>[] {
  const blocosTexto: string[][] = [[]];
  for (const linhaBruta of texto.replace(/\r/g, '').split('\n')) {
    const linha = linhaBruta.trim();
    if (linha === '' || /^#/.test(linha)) {
      if (blocosTexto[blocosTexto.length - 1].length > 0) blocosTexto.push([]);
      continue;
    }
    blocosTexto[blocosTexto.length - 1].push(linha);
  }

  const acharFase = (rotulo: string): string | null => {
    const r = rotulo.trim().toLowerCase();
    const fase = fases.find(
      (f) => f.codigo.toLowerCase() === r || f.label.toLowerCase() === r || f.label.toLowerCase().includes(`(${r})`),
    );
    return fase?.codigo ?? null;
  };

  const resultado: Record<string, number[]>[] = [];
  for (const linhas of blocosTexto) {
    if (linhas.length === 0) continue;
    const bloco: Record<string, number[]> = {};
    let ordem = 0;
    for (const linha of linhas) {
      const partes = linha.split(/\t|;|\s{1,}/).map((p) => p.trim()).filter((p) => p !== '');
      if (partes.length === 0) continue;
      const primeiraEhNumero = /^-?\d+([.,]\d+)?$/.test(partes[0]);
      const valores = (primeiraEhNumero ? partes : partes.slice(1))
        .filter((p) => /^-?\d+([.,]\d+)?$/.test(p))
        .map((p) => Math.max(0, Math.round(Number(p.replace(',', '.')))));
      if (valores.length === 0) continue; // cabeçalho
      const codigo = primeiraEhNumero ? fases[ordem]?.codigo : (acharFase(partes[0]) ?? fases[ordem]?.codigo);
      ordem++;
      if (codigo) bloco[codigo] = valores;
    }
    if (Object.keys(bloco).length > 0) resultado.push(bloco);
  }
  return resultado;
}
