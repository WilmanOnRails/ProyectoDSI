import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ScrapingService } from './scraping/scraping.service.js';
import { RecursosService } from './recursos/recursos.service.js';

async function ejecutarSincronizacionMasiva() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const scrapingService = app.get(ScrapingService);
  const recursosService = app.get(RecursosService);

  const categorias = [
    'construccion',
    'ferreteria',
    'herramientas',
    'pintura',
    'plomeria',
    'electrico',
    'iluminacion',
    'limpieza',
  ];

  console.log('🚀 Iniciando sincronización masiva desde SINSA a la base de datos de Render...');

  for (const cat of categorias) {
    try {
      console.log(`\n--- Procesando categoría: ${cat} ---`);
      const resultadoScraping = await scrapingService.ejecutarScraping(cat);
      console.log(`📦 Encontrados ${resultadoScraping.products.length} productos en ${cat}.`);

      if (resultadoScraping.products.length === 0) continue;

      const recursosAImportar = resultadoScraping.products.map((p) => ({
        descripcion: p.descripcion,
        proveedor: 'SINSA',
        urlProducto: p.urlProducto || `https://www.sinsa.com.ni/${p.descripcion}`,
        precio: p.precio,
        tipo: 'material' as const,
        unidad: 'Unidad',
        categoria: cat,
        nombreProveedor: p.descripcion,
        imagenUrl: p.imagenUrl || undefined,
        fuente: 'SINSA',
        registradoPor: 'Script Automatizado Sincronización',
      }));

      const resImport = await recursosService.importar({ recursos: recursosAImportar });
      console.log(`✅ Sincronizados (${cat}):`, resImport);
    } catch (error) {
      console.error(`❌ Error procesando la categoría ${cat}:`, (error as Error).message);
    }
  }

  console.log('\n🎉 ¡Sincronización masiva finalizada con éxito!');
  await app.close();
}

await ejecutarSincronizacionMasiva();
