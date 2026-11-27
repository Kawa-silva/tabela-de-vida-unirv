import { Module } from '@nestjs/common';
import { AnaliseEcologicaController } from './analise-ecologica.controller';
import { LifeTableMathEngine } from './life-table-math.engine';

@Module({
  controllers: [AnaliseEcologicaController],
  providers: [LifeTableMathEngine],
  exports: [LifeTableMathEngine],
})
export class AnaliseModule {}
