import { Module } from '@nestjs/common';
import { AnaliseModule } from '../analise/analise.module';
import { CatalogoModule } from '../catalogo/catalogo.module';
import { CenarioController } from './cenario.controller';
import { CenarioRepository } from './cenario.repository';
import { CenarioService } from './cenario.service';

@Module({
  imports: [CatalogoModule, AnaliseModule],
  controllers: [CenarioController],
  providers: [CenarioRepository, CenarioService],
})
export class CenariosModule {}
