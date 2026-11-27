import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModoImportacao } from '../life-table.models';
import { LifeTableService } from '../life-table.service';
import { parseMatrizes } from '../tsv-parser';

/** ImportarModalComponent — importação de matrizes de contagem via TSV/CSV/Excel (RF009). */
@Component({
  selector: 'app-importar-modal',
  imports: [FormsModule],
  templateUrl: './importar-modal.component.html',
})
export class ImportarModalComponent {
  protected readonly lifeTable = inject(LifeTableService);
  readonly fechar = output<void>();

  protected readonly texto = signal('');
  protected readonly modo = signal<ModoImportacao>('single');
  protected readonly talhaoAlvo = signal(0);

  protected readonly cenario = this.lifeTable.cenarioAtivo;
  protected readonly blocos = computed(() => {
    const c = this.cenario();
    return c && this.texto().trim() ? parseMatrizes(this.texto(), c.fases) : [];
  });

  protected readonly codigosFases = computed(() => (this.cenario()?.fases ?? []).map((f) => f.codigo).join(', '));

  protected contarFases(bloco: Record<string, number[]>): number {
    return Object.keys(bloco).length;
  }

  constructor() {
    this.talhaoAlvo.set(this.lifeTable.selectedPlotIndex());
  }

  /** Gera um exemplo a partir do próprio talhão selecionado (sem dados fixos no código) */
  protected preencherExemplo(): void {
    const c = this.cenario();
    const t = c?.talhoes[this.talhaoAlvo()] ?? c?.talhoes[0];
    if (!c || !t) return;
    const cabecalho = ['Fase', ...t.amostras.map((a) => `A${a.indice + 1}`)].join('\t');
    const linhas = c.fases.map((f) => [f.codigo, ...(t.contagens[f.codigo] ?? [])].join('\t'));
    this.texto.set(`# ${t.nome}\n${cabecalho}\n${linhas.join('\n')}`);
  }

  protected async importar(): Promise<void> {
    const blocos = this.blocos();
    if (blocos.length === 0) return;
    const ok = await this.lifeTable.importFromTSV(blocos, this.modo(), this.talhaoAlvo());
    if (ok) this.fechar.emit();
  }
}
