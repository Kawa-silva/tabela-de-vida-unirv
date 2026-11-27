import { Controller, Get, Param } from '@nestjs/common';
import { CatalogoService } from './catalogo.service';

/** CatalogoController — rotas /api/catalogo/* (RF001, RF002, RF007). */
@Controller('catalogo')
export class CatalogoController {
  constructor(private readonly service: CatalogoService) {}

  /** GET /api/catalogo/culturas — 8 culturas com as pragas aninhadas */
  @Get('culturas')
  listarCulturas() {
    return this.service.listarCulturasComPragas();
  }

  /** GET /api/catalogo/culturas/:id */
  @Get('culturas/:id')
  buscarCulturaPorId(@Param('id') id: string) {
    return this.service.buscarCultura(id);
  }

  /** GET /api/catalogo/pragas/:id */
  @Get('pragas/:id')
  buscarPragaPorId(@Param('id') id: string) {
    return this.service.buscarPraga(id);
  }

  /** GET /api/catalogo/areas-unirv — 4 áreas experimentais com polígono */
  @Get('areas-unirv')
  listarAreasUnirv() {
    return this.service.listarAreas();
  }

  /** GET /api/catalogo/usuarios */
  @Get('usuarios')
  listarUsuarios() {
    return this.service.listarUsuarios();
  }
}
