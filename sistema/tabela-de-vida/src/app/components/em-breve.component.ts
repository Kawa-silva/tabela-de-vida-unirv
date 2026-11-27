import { Component, input } from '@angular/core';

/** Abas 4 a 7 (RF012–RF018) — previstas para a Entrega 2. */
@Component({
  selector: 'app-em-breve',
  template: `
    <section class="card center">
      <h2>{{ titulo() }}</h2>
      <p class="muted">Esta aba faz parte da <strong>Entrega 2</strong> (RF012 a RF018): matriz de k, correlação de Pearson,
        ANOVA da regressão, gráficos SVG e ranking de criticidade.</p>
    </section>
  `,
})
export class EmBreveComponent {
  readonly titulo = input('');
}
