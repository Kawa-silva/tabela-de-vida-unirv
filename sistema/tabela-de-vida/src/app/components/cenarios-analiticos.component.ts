import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { previaEstagioCritico } from '../criticidade';
import { computeLifeTableForPlot } from '../life-table.math';
import { CenarioAnalitico } from '../life-table.models';
import { LifeTableService } from '../life-table.service';
import { NumPipe } from '../num.pipe';
import { SelecaoContextService } from '../selecao-context.service';

/**
 * CenariosAnaliticosComponent — Aba 0, Central de Cenários (RF004, RF005).
 * Lista minimalista em linha única com acordeão, busca, edição, duplicação, exclusão e "Abrir Coleta".
 */
@Component({
  selector: 'app-cenarios-analiticos',
  imports: [FormsModule, NumPipe],
  templateUrl: './cenarios-analiticos.component.html',
})
export class CenariosAnaliticosComponent {
  protected readonly lifeTable = inject(LifeTableService);
  protected readonly selecao = inject(SelecaoContextService);

  protected readonly busca = signal('');
  protected readonly expandidos = signal<Set<string>>(new Set());
  protected readonly editandoId = signal<string | null>(null);
  protected readonly confirmandoExclusao = signal<string | null>(null);

  // formulário de edição inline
  protected readonly editNome = signal('');
  protected readonly editUsuario = signal('');
  protected readonly editData = signal('');
  protected readonly editObs = signal('');

  protected readonly cenariosFiltrados = computed(() => {
    const termo = this.busca().trim().toLowerCase();
    const lista = this.lifeTable.cenarios();
    if (!termo) return lista;
    return lista.filter((c) =>
      [c.nome, c.usuarioNome, c.culturaNome, c.pragaNome, c.pragaNomeCientifico, c.observacoes ?? '']
        .some((campo) => campo.toLowerCase().includes(termo)),
    );
  });

  protected isExpanded(id: string): boolean {
    return this.expandidos().has(id);
  }

  protected alternar(id: string): void {
    this.expandidos.update((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  protected expandirTodos(): void {
    this.expandidos.set(new Set(this.cenariosFiltrados().map((c) => c.id)));
  }

  protected recolherTodos(): void {
    this.expandidos.set(new Set());
  }

  protected novoCenario(): void {
    this.selecao.selecionarCultura(null);
    this.lifeTable.mostrarAssistente.set(true);
  }

  protected abrirColeta(c: CenarioAnalitico, evento?: Event): void {
    evento?.stopPropagation();
    void this.lifeTable.abrirColeta(c.id);
  }

  protected dataFormatada(iso: string): string {
    const [data, hora] = iso.split('T');
    const [a, m, d] = data.split('-');
    return `${d}/${m}/${a} ${hora?.slice(0, 5) ?? ''}`;
  }

  protected nomeArea(id: string | null): string {
    return this.selecao.areaPorId(id)?.nomeCurto ?? 'Várias áreas';
  }

  /** Prévia das somas Lx (indivíduos vivos) por talhão e fase */
  protected previaLx(c: CenarioAnalitico) {
    return c.talhoes.map((t) => ({ nome: t.nome, linhas: computeLifeTableForPlot(t, c.fases).linhas }));
  }

  protected estagioCritico(c: CenarioAnalitico) {
    const tabelas = c.talhoes.map((t) => computeLifeTableForPlot(t, c.fases));
    return previaEstagioCritico(tabelas);
  }

  // ---------------------------------------------------------------- edição inline
  protected iniciarEdicao(c: CenarioAnalitico): void {
    this.editandoId.set(c.id);
    this.editNome.set(c.nome);
    this.editUsuario.set(c.usuarioNome);
    this.editData.set(c.criadoEm.slice(0, 16));
    this.editObs.set(c.observacoes ?? '');
  }

  protected async salvarEdicao(c: CenarioAnalitico): Promise<void> {
    const ok = await this.lifeTable.atualizarMetadadosCenario(c.id, {
      nome: this.editNome(),
      usuarioNome: this.editUsuario(),
      criadoEm: this.editData(),
      observacoes: this.editObs(),
    });
    if (ok) {
      this.editandoId.set(null);
      this.lifeTable.notificar('Dados do cenário atualizados.');
    }
  }

  protected duplicar(c: CenarioAnalitico): void {
    void this.lifeTable.duplicarCenario(c.id);
  }

  protected async remover(c: CenarioAnalitico): Promise<void> {
    if (this.confirmandoExclusao() !== c.id) {
      this.confirmandoExclusao.set(c.id);
      return;
    }
    this.confirmandoExclusao.set(null);
    await this.lifeTable.excluirCenario(c.id);
  }
}
