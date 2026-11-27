import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CulturaInfo, PragaInfo } from '../life-table.models';
import { LifeTableService } from '../life-table.service';
import { SelecaoContextService } from '../selecao-context.service';

/**
 * TelaInicialSelecaoComponent — assistente modal em 3 etapas (RF001, RF002, RF003):
 *   1. Cultura agrícola → 2. Praga-alvo → 3. Identificação e dimensionamento amostral.
 */
@Component({
  selector: 'app-tela-inicial-selecao',
  imports: [FormsModule],
  templateUrl: './tela-inicial-selecao.component.html',
})
export class TelaInicialSelecaoComponent {
  protected readonly selecao = inject(SelecaoContextService);
  protected readonly lifeTable = inject(LifeTableService);

  readonly concluido = output<void>();
  readonly cancelado = output<void>();

  protected readonly etapa = signal<1 | 2 | 3>(1);

  // Etapa 3 — formulário
  protected readonly nomeCenario = signal('');
  protected readonly criadoPor = signal('');
  protected readonly numTalhoes = signal(10);
  protected readonly numAmostras = signal(10);
  protected readonly areaId = signal<string>('');
  protected readonly observacoes = signal('');

  protected readonly atalhosTalhoes = [5, 7, 10, 12, 15, 20];
  protected readonly atalhosAmostras = [5, 10, 15, 20, 25, 30];

  protected readonly numFases = computed(() => this.selecao.pragaSelecionada()?.fasesSugeridas.length || 6);
  protected readonly totalPontos = computed(() => this.numTalhoes() * this.numAmostras());
  protected readonly totalCelulas = computed(() => this.totalPontos() * this.numFases());
  protected readonly formularioValido = computed(
    () =>
      this.nomeCenario().trim().length > 0 &&
      this.criadoPor().trim().length > 0 &&
      this.numTalhoes() >= 2 && this.numTalhoes() <= 50 &&
      this.numAmostras() >= 1 && this.numAmostras() <= 100,
  );

  constructor() {
    void this.selecao.carregarCatalogos();
    const cultura = this.selecao.culturaSelecionada();
    if (cultura) this.etapa.set(this.selecao.pragaSelecionada() ? 3 : 2);
  }

  // ---------------------------------------------------------------- etapa 1
  protected selecionarCultura(c: CulturaInfo): void {
    this.selecao.selecionarCultura(c);
    this.etapa.set(2);
  }

  protected voltarParaCulturas(): void {
    this.selecao.selecionarCultura(null);
    this.etapa.set(1);
  }

  // ---------------------------------------------------------------- etapa 2
  protected selecionarPraga(p: PragaInfo): void {
    this.selecao.selecionarPraga(p);
    const cultura = this.selecao.culturaSelecionada();
    if (!this.nomeCenario()) {
      this.nomeCenario.set(`Monitoramento ${cultura?.nome ?? ''} — ${p.nomeComum} (Safra ${new Date().getFullYear()}/${String(new Date().getFullYear() + 1).slice(2)})`);
    }
    this.etapa.set(3);
  }

  protected importancia(p: PragaInfo): string {
    return p.descricao.toLowerCase().includes('chave') || p.descricao.toLowerCase().includes('principal')
      ? 'Principal / Chave'
      : 'Secundária';
  }

  // ---------------------------------------------------------------- etapa 3
  protected ajustar(campo: 'talhoes' | 'amostras', delta: number): void {
    if (campo === 'talhoes') this.numTalhoes.set(Math.min(50, Math.max(2, this.numTalhoes() + delta)));
    else this.numAmostras.set(Math.min(100, Math.max(1, this.numAmostras() + delta)));
  }

  protected async confirmarParametrizacao(modoDados: 'demo' | 'zerado'): Promise<void> {
    const cultura = this.selecao.culturaSelecionada();
    const praga = this.selecao.pragaSelecionada();
    if (!cultura || !praga || !this.formularioValido()) return;
    const usuario = this.selecao.usuarios().find((u) => u.nome === this.criadoPor().trim());
    const ok = await this.lifeTable.criarCenario({
      nome: this.nomeCenario().trim(),
      usuarioNome: this.criadoPor().trim(),
      usuarioId: usuario?.id ?? null,
      culturaId: cultura.id,
      pragaId: praga.id,
      areaExperimentalId: this.areaId() || null,
      numTalhoes: this.numTalhoes(),
      numAmostrasPorTalhao: this.numAmostras(),
      observacoes: this.observacoes().trim() || null,
      modoDados,
    });
    if (ok) this.concluido.emit();
  }
}
