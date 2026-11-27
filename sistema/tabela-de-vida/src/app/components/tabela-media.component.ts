import { Component, computed, inject } from '@angular/core';
import { LifeTableService } from '../life-table.service';
import { NumPipe } from '../num.pipe';

/** TabelaMediaComponent — Aba 3, Tabela de Vida Média e Mortalidade Indispensável (RF011). */
@Component({
  selector: 'app-tabela-media',
  imports: [NumPipe],
  templateUrl: './tabela-media.component.html',
})
export class TabelaMediaComponent {
  protected readonly lifeTable = inject(LifeTableService);
  protected readonly cenario = this.lifeTable.cenarioAtivo;
  protected readonly media = this.lifeTable.meanLifeTable;

  protected readonly somas = computed(() => {
    const linhas = this.media()?.linhas.filter((l) => !l.isTerminal) ?? [];
    return {
      d: linhas.reduce((s, l) => s + l.dmedio, 0),
      r: linhas.reduce((s, l) => s + l.r100, 0),
      k: linhas.reduce((s, l) => s + l.kx, 0),
      mi: linhas.reduce((s, l) => s + l.MIx, 0),
      miPerc: linhas.reduce((s, l) => s + l.MIxPercentual, 0),
    };
  });

  protected rotulo(codigo: string | null): string {
    return this.cenario()?.fases.find((f) => f.codigo === codigo)?.label ?? '—';
  }

  protected linha(codigo: string | null) {
    return this.media()?.linhas.find((l) => l.codigo === codigo);
  }
}
