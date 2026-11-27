import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put } from '@nestjs/common';
import { CenarioService } from './cenario.service';

/** CenarioController — rotas /api/cenarios/* (RF003 a RF009). */
@Controller('cenarios')
export class CenarioController {
  constructor(private readonly service: CenarioService) {}

  /** GET /api/cenarios — todos os cenários com fases, talhões, amostras e contagens */
  @Get()
  listarCenarios() {
    return this.service.listarCenarios();
  }

  /** GET /api/cenarios/:id — um cenário e seu cálculo ecológico completo */
  @Get(':id')
  buscarCenario(@Param('id') id: string) {
    return this.service.buscarCenarioComAnalise(id);
  }

  /** POST /api/cenarios — cria cenário com T talhões e A amostras (RF003) */
  @Post()
  criarCenario(@Body() corpo: unknown) {
    return this.service.criarNovoCenario(corpo);
  }

  /** PUT /api/cenarios/:id — edita nome, responsável, data/hora e observações (RF005) */
  @Put(':id')
  atualizarMetadados(@Param('id') id: string, @Body() corpo: unknown) {
    return this.service.atualizarMetadados(id, corpo);
  }

  /** PATCH /api/cenarios/:id/ativar — define o cenário ativo ("Abrir Coleta", RN003) */
  @Patch(':id/ativar')
  ativarCenario(@Param('id') id: string) {
    return this.service.ativarCenario(id);
  }

  /** PUT /api/cenarios/:id/coleta — persiste a estrutura de fases, talhões e amostras (RF006/RF009) */
  @Put(':id/coleta')
  sincronizarColeta(@Param('id') id: string, @Body() corpo: unknown) {
    return this.service.sincronizarColeta(id, corpo);
  }

  /** PATCH /api/cenarios/:id/talhoes/:num/contagem — atualiza 1 célula amostra × fase (RF006) */
  @Patch(':id/talhoes/:num/contagem')
  atualizarCelulaContagem(@Param('id') id: string, @Param('num', ParseIntPipe) num: number, @Body() corpo: unknown) {
    return this.service.atualizarCelulaContagem(id, num, corpo);
  }

  /** POST /api/cenarios/:id/talhoes/:num/mover-regiao — move o talhão no mapa (RF008) */
  @Post(':id/talhoes/:num/mover-regiao')
  @HttpCode(200)
  moverRegiaoTalhao(@Param('id') id: string, @Param('num', ParseIntPipe) num: number, @Body() corpo: unknown) {
    return this.service.moverRegiaoDoTalhao(id, num, corpo);
  }

  /** PATCH /api/cenarios/:id/talhoes/:num/amostras/:idx — ajuste fino de lat/lng de uma amostra (RF008) */
  @Patch(':id/talhoes/:num/amostras/:idx')
  atualizarCoordenada(
    @Param('id') id: string,
    @Param('num', ParseIntPipe) num: number,
    @Param('idx', ParseIntPipe) idx: number,
    @Body() corpo: unknown,
  ) {
    return this.service.atualizarCoordenadaAmostra(id, num, idx, corpo);
  }

  /** POST /api/cenarios/:id/duplicar — clona o cenário inteiro numa transação (RN005) */
  @Post(':id/duplicar')
  duplicarCenario(@Param('id') id: string) {
    return this.service.duplicarCenario(id);
  }

  /** DELETE /api/cenarios/:id — exclui em cascata; bloqueia o último cenário (RN006) */
  @Delete(':id')
  excluirCenario(@Param('id') id: string) {
    return this.service.excluirCenario(id);
  }
}
