import { Component, computed, inject } from '@angular/core';
import { LifeTableService } from '../life-table.service';
import { NumPipe } from '../num.pipe';

/** TabelaVidaComponent — Aba 2, Tabela de Vida Ecológica por Talhão (RF010). */
@Component({
  selector: 'app-tabela-vida',
  imports: [NumPipe],
  templateUrl: './tabela-vida.component.html',
})
export class TabelaVidaComponent {
  protected readonly lifeTable = inject(LifeTableService);

  protected readonly cenario = this.lifeTable.cenarioAtivo;
  protected readonly tabela = computed(() => {
    const tabelas = this.lifeTable.plotLifeTables();
    return tabelas[Math.min(this.lifeTable.selectedPlotIndex(), tabelas.length - 1)] ?? null;
  });

  protected readonly maiorQ = computed(() => Math.max(1, ...(this.tabela()?.linhas.map((l) => l.q100) ?? [0])));
}
