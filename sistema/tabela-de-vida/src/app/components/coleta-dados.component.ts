import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { calcularLx, somasPorFase } from '../life-table.math';
import { LifeTableService } from '../life-table.service';
import { MapaColetaComponent } from './mapa-coleta.component';

/**
 * ColetaDadosComponent — Aba 1, Coleta & Amostras (RF006).
 * Gerencia as fases do ciclo de vida, os talhões e a matriz de contagens por amostra.
 */
@Component({
  selector: 'app-coleta-dados',
  imports: [FormsModule, MapaColetaComponent],
  templateUrl: './coleta-dados.component.html',
})
export class ColetaDadosComponent {
  protected readonly lifeTable = inject(LifeTableService);

  protected readonly novaFaseCodigo = signal('');
  protected readonly novaFaseLabel = signal('');

  protected readonly cenario = this.lifeTable.cenarioAtivo;
  protected readonly talhao = this.lifeTable.talhaoSelecionado;

  /** soma por fase (ΣAj) e Lx acumulado do talhão selecionado */
  protected readonly resumoFases = computed(() => {
    const c = this.cenario();
    const t = this.talhao();
    if (!c || !t) return [];
    const somas = somasPorFase(t, c.fases);
    const Lx = calcularLx(somas);
    return c.fases.map((f, i) => ({
      codigo: f.codigo,
      soma: somas[i],
      Lx: Lx[i],
      variacao: i < c.fases.length - 1 && Lx[i] > 0 ? ((Lx[i + 1] - Lx[i]) / Lx[i]) * 100 : null,
    }));
  });

  protected readonly totalTalhao = computed(() => this.resumoFases().reduce((s, r) => s + r.soma, 0));

  protected selecionarTalhao(indice: number): void {
    this.lifeTable.selectedPlotIndex.set(indice);
  }

  protected alterarCelula(codigoFase: string, indiceAmostra: number, valor: string): void {
    void this.lifeTable.updateSampleValue(this.lifeTable.selectedPlotIndex(), codigoFase, indiceAmostra, Number(valor));
  }

  protected async adicionarFase(): Promise<void> {
    await this.lifeTable.addStage(this.novaFaseCodigo(), this.novaFaseLabel());
    this.novaFaseCodigo.set('');
    this.novaFaseLabel.set('');
  }

  protected removerFase(codigo: string): void {
    if (confirm(`Remover a fase "${codigo}" e todas as suas contagens?`)) void this.lifeTable.removeStage(codigo);
  }

  protected removerTalhao(): void {
    const t = this.talhao();
    if (t && confirm(`Remover o ${t.nome} e todas as suas amostras?`)) {
      void this.lifeTable.removePlot(this.lifeTable.selectedPlotIndex());
    }
  }
}
