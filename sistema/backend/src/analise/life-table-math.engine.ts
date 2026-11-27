import { Injectable } from '@nestjs/common';
import {
  computeCompleteAnalysis,
  computeLifeTableForPlot,
  computeMeanLifeTable,
  FaseInput,
  OpcoesCalculo,
  ResultadoAnalise,
  TabelaMedia,
  TabelaVidaTalhao,
  TalhaoInput,
} from './life-table.math';

/**
 * LifeTableMathEngine — serviço injetável que expõe o motor matemático da tabela de vida.
 * As fórmulas ficam em life-table.math.ts (funções puras, testáveis e reaproveitadas no frontend).
 *
 * Entrega 1: tabela por talhão (RF010) e tabela média + MIx (RF011).
 * Entrega 2: matriz de k, Pearson, ANOVA e ranking entram aqui (RF012–RF018).
 */
@Injectable()
export class LifeTableMathEngine {
  computeLifeTableForPlot(talhao: TalhaoInput, fases: FaseInput[], opcoes?: OpcoesCalculo): TabelaVidaTalhao {
    return computeLifeTableForPlot(talhao, fases, opcoes);
  }

  computeMeanLifeTable(talhoes: TalhaoInput[], fases: FaseInput[], opcoes?: OpcoesCalculo): TabelaMedia {
    return computeMeanLifeTable(talhoes, fases, opcoes);
  }

  computeCompleteAnalysis(talhoes: TalhaoInput[], fases: FaseInput[], opcoes?: OpcoesCalculo): ResultadoAnalise {
    return computeCompleteAnalysis(talhoes, fases, opcoes);
  }
}
