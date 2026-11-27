import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from './api.config';
import { CulturaInfo, PragaInfo, UnirvExperimentalArea, Usuario } from './life-table.models';

/**
 * SelecaoContextService — carrega do backend os catálogos (culturas, pragas, áreas da UniRV
 * e usuários) e guarda a cultura e a praga escolhidas no assistente em sinais reativos.
 */
@Injectable({ providedIn: 'root' })
export class SelecaoContextService {
  private readonly http = inject(HttpClient);

  readonly culturas = signal<CulturaInfo[]>([]);
  readonly areas = signal<UnirvExperimentalArea[]>([]);
  readonly usuarios = signal<Usuario[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  readonly culturaSelecionada = signal<CulturaInfo | null>(null);
  readonly pragaSelecionada = signal<PragaInfo | null>(null);

  readonly totalPragas = computed(() => this.culturas().reduce((s, c) => s + c.pragas.length, 0));

  async carregarCatalogos(): Promise<void> {
    if (this.culturas().length > 0) return;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const [culturas, areas, usuarios] = await Promise.all([
        firstValueFrom(this.http.get<CulturaInfo[]>(`${API_URL}/catalogo/culturas`)),
        firstValueFrom(this.http.get<UnirvExperimentalArea[]>(`${API_URL}/catalogo/areas-unirv`)),
        firstValueFrom(this.http.get<Usuario[]>(`${API_URL}/catalogo/usuarios`)),
      ]);
      this.culturas.set(culturas);
      this.areas.set(areas);
      this.usuarios.set(usuarios);
    } catch {
      this.erro.set('Não foi possível carregar os catálogos. Verifique se o backend está rodando na porta 3000.');
    } finally {
      this.carregando.set(false);
    }
  }

  selecionarCultura(cultura: CulturaInfo | null): void {
    this.culturaSelecionada.set(cultura);
    this.pragaSelecionada.set(null);
  }

  selecionarPraga(praga: PragaInfo | null): void {
    this.pragaSelecionada.set(praga);
  }

  areaPorId(id: string | null): UnirvExperimentalArea | undefined {
    return this.areas().find((a) => a.id === id);
  }
}
