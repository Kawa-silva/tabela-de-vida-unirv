import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { PlotData, UnirvExperimentalArea } from '../life-table.models';
import { LifeTableService } from '../life-table.service';
import { SelecaoContextService } from '../selecao-context.service';

type ModoVisao = 'talhao' | 'todos' | 'areas';

const CORES_TALHOES = ['#2563eb', '#16a34a', '#db2777', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#dc2626', '#4f46e5', '#059669'];

/**
 * MapaColetaComponent — georreferenciamento com Leaflet 1.9 (RF007, RF008).
 *  - camadas Satélite (Esri World Imagery) e Ruas (OpenStreetMap);
 *  - polígonos das 4 áreas experimentais da UniRV (vindos do banco);
 *  - talhões do cenário e marcadores numerados das amostras A1..An;
 *  - clique no mapa move o talhão selecionado; grade para ajuste fino de lat/lng.
 */
@Component({
  selector: 'app-mapa-coleta',
  templateUrl: './mapa-coleta.component.html',
})
export class MapaColetaComponent implements AfterViewInit, OnDestroy {
  protected readonly lifeTable = inject(LifeTableService);
  protected readonly selecao = inject(SelecaoContextService);

  private readonly mapaRef = viewChild.required<ElementRef<HTMLDivElement>>('mapa');

  protected readonly modoClique = signal(true);
  protected readonly camada = signal<'satelite' | 'ruas'>('satelite');
  protected readonly modoVisao = signal<ModoVisao>('talhao');
  protected readonly mostrarCoordenadas = signal(false);

  protected readonly talhao = this.lifeTable.talhaoSelecionado;

  /** quantos talhões do cenário ativo estão em cada área */
  protected readonly talhoesPorArea = computed(() => {
    const contagem: Record<string, number> = {};
    for (const t of this.lifeTable.cenarioAtivo()?.talhoes ?? []) {
      if (t.areaExperimentalId) contagem[t.areaExperimentalId] = (contagem[t.areaExperimentalId] ?? 0) + 1;
    }
    return contagem;
  });

  private mapa?: L.Map;
  private camadaSatelite?: L.LayerGroup;
  private camadaRuas?: L.TileLayer;
  private camadaAreas = L.layerGroup();
  private camadaTalhoes = L.layerGroup();
  private ultimoEnquadramento = '';

  constructor() {
    // redesenha o mapa sempre que o cenário, o talhão selecionado ou as áreas mudarem
    effect(() => {
      const cenario = this.lifeTable.cenarioAtivo();
      const indice = this.lifeTable.selectedPlotIndex();
      const areas = this.selecao.areas();
      const modo = this.modoVisao();
      if (!this.mapa) return;
      this.desenharAreas(areas);
      this.desenharTalhoes(cenario?.talhoes ?? [], indice);
      const chave = `${cenario?.id}|${indice}|${modo}`;
      if (chave !== this.ultimoEnquadramento) {
        this.ultimoEnquadramento = chave;
        this.enquadrar();
      }
    });
    effect(() => {
      const camada = this.camada();
      if (!this.mapa || !this.camadaSatelite || !this.camadaRuas) return;
      if (camada === 'satelite') {
        this.mapa.removeLayer(this.camadaRuas);
        this.camadaSatelite.addTo(this.mapa);
      } else {
        this.mapa.removeLayer(this.camadaSatelite);
        this.camadaRuas.addTo(this.mapa);
      }
    });
  }

  ngAfterViewInit(): void {
    const satelite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Imagens © Esri, Maxar, Earthstar Geographics' },
    );
    const rotulos = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19 },
    );
    this.camadaSatelite = L.layerGroup([satelite, rotulos]);
    this.camadaRuas = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    });

    this.mapa = L.map(this.mapaRef().nativeElement, { center: [-17.78, -51.0], zoom: 13 });
    this.camadaSatelite.addTo(this.mapa);
    this.camadaAreas.addTo(this.mapa);
    this.camadaTalhoes.addTo(this.mapa);

    // RF008 — clique no mapa muda a região do talhão selecionado
    this.mapa.on('click', (e: L.LeafletMouseEvent) => {
      if (!this.modoClique()) return;
      void this.lifeTable.movePlotToCoordinates(this.lifeTable.selectedPlotIndex(), e.latlng.lat, e.latlng.lng);
    });

    // força o primeiro desenho (o effect roda antes do mapa existir)
    this.desenharAreas(this.selecao.areas());
    this.desenharTalhoes(this.lifeTable.cenarioAtivo()?.talhoes ?? [], this.lifeTable.selectedPlotIndex());
    this.enquadrar();
    setTimeout(() => this.mapa?.invalidateSize(), 200);
  }

  ngOnDestroy(): void {
    this.mapa?.remove();
  }

  // ---------------------------------------------------------------- desenho
  private desenharAreas(areas: UnirvExperimentalArea[]): void {
    this.camadaAreas.clearLayers();
    for (const area of areas) {
      if (area.poligono.length < 3) continue;
      L.polygon(area.poligono, { color: '#facc15', weight: 2, dashArray: '6 6', fillOpacity: 0.05 })
        .bindTooltip(area.nomeCurto, { sticky: true })
        .addTo(this.camadaAreas);
    }
  }

  private desenharTalhoes(talhoes: PlotData[], selecionado: number): void {
    this.camadaTalhoes.clearLayers();
    talhoes.forEach((t, i) => {
      if (t.amostras.length === 0) return;
      const ativo = i === selecionado;
      const cor = CORES_TALHOES[i % CORES_TALHOES.length];
      const limites = L.latLngBounds(t.amostras.map((a) => [a.latitude, a.longitude] as L.LatLngTuple)).pad(0.25);
      L.rectangle(limites, {
        color: ativo ? '#ffffff' : cor,
        weight: ativo ? 3 : 1.5,
        fillColor: cor,
        fillOpacity: ativo ? 0.25 : 0.12,
      })
        .bindTooltip(t.nome)
        .on('click', (e: L.LeafletMouseEvent) => {
          if (!this.modoClique() || i !== selecionado) {
            L.DomEvent.stopPropagation(e);
            this.lifeTable.selectedPlotIndex.set(i);
          }
        })
        .addTo(this.camadaTalhoes);

      if (ativo || this.modoVisao() !== 'areas') {
        for (const a of t.amostras) {
          L.marker([a.latitude, a.longitude], {
            icon: L.divIcon({
              className: 'marcador-amostra',
              html: `<span style="background:${cor}">${ativo ? 'A' + (a.indice + 1) : ''}</span>`,
              iconSize: ativo ? [26, 18] : [8, 8],
            }),
            interactive: false,
          }).addTo(this.camadaTalhoes);
        }
      }
    });
  }

  // ---------------------------------------------------------------- enquadramento (RF007)
  protected enquadrar(): void {
    if (!this.mapa) return;
    const cenario = this.lifeTable.cenarioAtivo();
    const modo = this.modoVisao();
    let pontos: L.LatLngTuple[] = [];
    if (modo === 'talhao') {
      pontos = (this.talhao()?.amostras ?? []).map((a) => [a.latitude, a.longitude]);
    } else if (modo === 'todos') {
      pontos = (cenario?.talhoes ?? []).flatMap((t) => t.amostras.map((a) => [a.latitude, a.longitude] as L.LatLngTuple));
    } else {
      pontos = this.selecao.areas().flatMap((a) => a.poligono);
    }
    if (pontos.length > 0) this.mapa.fitBounds(L.latLngBounds(pontos).pad(0.3), { maxZoom: 18 });
  }

  protected definirVisao(modo: ModoVisao): void {
    this.modoVisao.set(modo);
    this.ultimoEnquadramento = '';
    this.enquadrar();
  }

  protected voarParaArea(area: UnirvExperimentalArea): void {
    this.mapa?.flyToBounds(L.latLngBounds(area.poligono).pad(0.2), { maxZoom: 17 });
  }

  protected moverParaArea(area: UnirvExperimentalArea): void {
    void this.lifeTable.movePlotToArea(this.lifeTable.selectedPlotIndex(), area.id);
  }

  // ---------------------------------------------------------------- RF008: ajuste fino
  protected alterarCoordenada(indice: number, campo: 'latitude' | 'longitude', valor: string): void {
    const amostra = this.talhao()?.amostras.find((a) => a.indice === indice);
    const numero = Number(valor);
    if (!amostra || !Number.isFinite(numero)) return;
    const lat = campo === 'latitude' ? numero : amostra.latitude;
    const lng = campo === 'longitude' ? numero : amostra.longitude;
    void this.lifeTable.atualizarCoordenadaAmostra(this.lifeTable.selectedPlotIndex(), indice, lat, lng);
  }
}
