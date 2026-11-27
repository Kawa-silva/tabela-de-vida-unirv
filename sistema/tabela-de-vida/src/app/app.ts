import { Component, OnInit, computed, inject } from '@angular/core';
import { CenariosAnaliticosComponent } from './components/cenarios-analiticos.component';
import { ColetaDadosComponent } from './components/coleta-dados.component';
import { EmBreveComponent } from './components/em-breve.component';
import { ImportarModalComponent } from './components/importar-modal.component';
import { TabelaMediaComponent } from './components/tabela-media.component';
import { TabelaVidaComponent } from './components/tabela-vida.component';
import { TelaInicialSelecaoComponent } from './components/tela-inicial-selecao.component';
import { LifeTableService } from './life-table.service';
import { SelecaoContextService } from './selecao-context.service';

interface Aba {
  indice: number;
  titulo: string;
  disponivel: boolean;
}

/**
 * App — casca da aplicação: cabeçalho, barra de abas (0 a 7), assistente de novo cenário,
 * modal de importação e notificações. O conteúdo de cada aba é um componente standalone.
 */
@Component({
  selector: 'app-root',
  imports: [
    TelaInicialSelecaoComponent,
    CenariosAnaliticosComponent,
    ColetaDadosComponent,
    ImportarModalComponent,
    TabelaVidaComponent,
    TabelaMediaComponent,
    EmBreveComponent,
  ],
  templateUrl: './app.html',
})
export class App implements OnInit {
  protected readonly lifeTable = inject(LifeTableService);
  protected readonly selecao = inject(SelecaoContextService);

  protected readonly abas: Aba[] = [
    { indice: 0, titulo: '0. Central de Cenários', disponivel: true },
    { indice: 1, titulo: '1. Coleta & Amostras', disponivel: true },
    { indice: 2, titulo: '2. Tabela de Vida por Talhão', disponivel: true },
    { indice: 3, titulo: '3. Tabela Média & MI', disponivel: true },
    { indice: 4, titulo: '4. Matriz de k & K total', disponivel: false },
    { indice: 5, titulo: '5. Correlação & Regressão', disponivel: false },
    { indice: 6, titulo: '6. Gráficos & Estágio Crítico', disponivel: false },
    { indice: 7, titulo: '7. Ranking de Criticidade', disponivel: false },
  ];

  protected readonly tituloAbaAtual = computed(() => this.abas[this.lifeTable.abaAtiva()]?.titulo ?? '');

  async ngOnInit(): Promise<void> {
    await Promise.all([this.selecao.carregarCatalogos(), this.lifeTable.carregarCenariosDoBackend()]);
  }

  protected abrirAssistente(): void {
    this.selecao.selecionarCultura(null);
    this.lifeTable.mostrarAssistente.set(true);
  }

  protected onSelecaoConcluida(): void {
    this.lifeTable.mostrarAssistente.set(false);
    this.lifeTable.abaAtiva.set(1);
  }

  protected selecionarAba(aba: Aba): void {
    this.lifeTable.abaAtiva.set(aba.indice);
  }
}
