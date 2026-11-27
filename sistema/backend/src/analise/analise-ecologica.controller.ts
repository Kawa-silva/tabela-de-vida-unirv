import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { lista, objeto, texto } from '../common/validacao';
import { FaseInput, TalhaoInput } from './life-table.math';
import { LifeTableMathEngine } from './life-table-math.engine';

/** AnaliseEcologicaController — POST /api/analise/calcular (RF010, RF011). */
@Controller('analise')
export class AnaliseEcologicaController {
  constructor(private readonly engine: LifeTableMathEngine) {}

  /**
   * Corpo esperado:
   * { fases: [{codigo, label}], talhoes: [{numero, nome, contagens: {Ov: [..], N1: [..]}}],
   *   usar100rxPlanilha?: boolean, modoLx?: 'acumulado' | 'direto' }
   */
  @Post('calcular')
  @HttpCode(200)
  calcularTabelaDeVida(@Body() corpo: unknown) {
    const dados = objeto<Record<string, unknown>>(corpo);
    const fases = lista<FaseInput>(dados.fases, 'fases', 2).map((f, i) => ({
      codigo: texto(f?.codigo, `fases[${i}].codigo`, true, 20),
      label: texto(f?.label ?? f?.codigo, `fases[${i}].label`, true, 60),
    }));
    const talhoes = lista<TalhaoInput>(dados.talhoes, 'talhoes', 1).map((t, i) => ({
      numero: Number(t?.numero ?? i + 1),
      nome: String(t?.nome ?? `Talhão ${i + 1}`),
      contagens: objeto<Record<string, number[]>>(t?.contagens, `talhoes[${i}].contagens`),
    }));
    return this.engine.computeCompleteAnalysis(talhoes, fases, {
      usar100rxPlanilha: dados.usar100rxPlanilha === true,
      modoLx: dados.modoLx === 'direto' ? 'direto' : 'acumulado',
    });
  }
}
