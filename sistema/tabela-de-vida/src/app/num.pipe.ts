import { Pipe, PipeTransform } from '@angular/core';

/** Formata números no padrão brasileiro: {{ valor | num:4 }} → 0,4480 */
@Pipe({ name: 'num' })
export class NumPipe implements PipeTransform {
  transform(valor: number | null | undefined, casas = 2): string {
    if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  }
}
