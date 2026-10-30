import { Injectable, Logger } from '@nestjs/common';
import { chromium, type Page } from 'playwright';

type ProductoScrapeado = {
  descripcion: string;
  precio: number;
  urlProducto: string | null;
  imagenUrl: string | null;
  categoria: string;
  proveedor: string;
  unidad: string;
};

@Injectable()
export class ScrapingService {
  private readonly logger = new Logger(ScrapingService.name);
  private readonly selectorTarjeta =
    '.vtex-search-result-3-x-galleryItem';

  /**
   * Espera a que la galería deje de crecer. Al hacer clic en "Mostrar más",
   * VTEX actualiza la URL y agrega las tarjetas por etapas, por lo que no
   * basta con esperar a que aparezca la primera tarjeta nueva.
   */
  private async esperarGaleriaEstable(page: Page): Promise<number> {
    const inicio = Date.now();
    const estabilidadRequerida = 2500;
    const tiempoMaximo = 30000;
    let cantidadAnterior = await page.locator(this.selectorTarjeta).count();
    let ultimoCambio = Date.now();

    while (Date.now() - inicio < tiempoMaximo) {
      await page.waitForTimeout(500);
      const cantidadActual = await page.locator(this.selectorTarjeta).count();

      if (cantidadActual !== cantidadAnterior) {
        cantidadAnterior = cantidadActual;
        ultimoCambio = Date.now();
      }

      if (Date.now() - ultimoCambio >= estabilidadRequerida) {
        return cantidadActual;
      }
    }

    return cantidadAnterior;
  }

  async ejecutarScraping(categoria: string) {
    const slugCategoria = (categoria || 'construccion').trim().toLowerCase();
    const urlBase = `https://www.sinsa.com.ni/${slugCategoria}`;
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    const productosPorUrl = new Map<string, ProductoScrapeado>();

    try {
      // En SINSA, "Mostrar más" es un enlace rel="next". Al hacer clic,
      // VTEX cambia la URL y acumula la siguiente tanda en la galería.
      await page.goto(urlBase, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector(this.selectorTarjeta, {
        timeout: 20000,
      });

      let numeroTanda = 1;

      while (true) {
        const tarjetas = page.locator(this.selectorTarjeta);
        const cantidadAntes = productosPorUrl.size;
        const productosVisibles = await tarjetas.evaluateAll(
          (results, cat) => {
            return Array.from(results).flatMap((e) => {
              const title =
                e
                  .querySelector(
                    'h3, .vtex-product-summary-2-x-productNameContainer',
                  )
                  ?.textContent?.trim();
              if (!title) return [];

              const imagenUrl =
                e
                  .querySelector(
                    'img.vtex-product-summary-2-x-imageNormal, img',
                  )
                  ?.getAttribute('src') ?? null;
              const priceContainer = e.querySelector(
                '[class*="currencyContainer"], [class*="priceContainer"], .vtex-product-summary-2-x-priceContainer',
              );
              const rawPrice =
                priceContainer?.textContent?.replace(/\s+/g, ' ').trim() ??
                '';
              const matches = rawPrice.match(/C?\$?\s*([\d,]+\.\d{2})/g);
              const priceText = matches?.at(-1) ?? rawPrice;
              const precio =
                Number.parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;

              const link = e
                .querySelector(
                  'a.vtex-product-summary-2-x-clearLink, a[href*="/p"]',
                )
                ?.getAttribute('href');
              const urlProducto = link
                ? link.startsWith('http')
                  ? link
                  : `https://www.sinsa.com.ni${link}`
                : null;

              return [
                {
                  descripcion: title,
                  precio,
                  urlProducto,
                  imagenUrl,
                  categoria: cat,
                  proveedor: 'SINSA',
                  unidad: 'Unidad',
                },
              ];
            });
          },
          slugCategoria,
        );

        for (const producto of productosVisibles) {
          const clave = producto.urlProducto ?? producto.descripcion;
          productosPorUrl.set(clave, producto);
        }

        const nuevos = productosPorUrl.size - cantidadAntes;
        this.logger.log(
          `Categoría ${slugCategoria}, tanda ${numeroTanda}: ${productosVisibles.length} tarjetas visibles, ${nuevos} productos nuevos, total ${productosPorUrl.size}`,
        );

        const siguiente = page.locator('a[rel="next"]:visible').first();
        if ((await siguiente.count()) === 0) {
          break;
        }

        const href = await siguiente.getAttribute('href');
        if (!href) {
          this.logger.warn(
            `Categoría ${slugCategoria}: el enlace Mostrar más no tiene URL`,
          );
          break;
        }

        const urlSiguiente = new URL(href, page.url());
        const paginaSiguiente = urlSiguiente.searchParams.get('page');
        const urlActual = page.url();

        // Esperamos la consulta de productos que dispara VTEX. La respuesta
        // puede no aparecer en algunas cargas, por eso no hacemos fallar todo
        // el scraping si el DOM sí se actualiza correctamente.
        const respuestaProductos = page
          .waitForResponse(
            (response) =>
              response.request().method() === 'GET' &&
              response.url().includes('operationName=productSearchV3') &&
              response.ok(),
            { timeout: 30000 },
          )
          .catch(() => null);

        await siguiente.scrollIntoViewIfNeeded();
        await siguiente.click();

        try {
          await page.waitForURL(
            (url) =>
              paginaSiguiente === null ||
              url.searchParams.get('page') === paginaSiguiente,
            { timeout: 30000 },
          );
        } catch {
          this.logger.warn(
            `Categoría ${slugCategoria}: la URL no cambió después de pulsar Mostrar más`,
          );
        }

        await respuestaProductos;
        const cantidadTarjetas = await this.esperarGaleriaEstable(page);

        if (page.url() === urlActual && cantidadTarjetas <= productosVisibles.length) {
          this.logger.warn(
            `Categoría ${slugCategoria}: Mostrar más no agregó productos después de la tanda ${numeroTanda}`,
          );
          break;
        }

        if (nuevos === 0 && cantidadTarjetas <= productosVisibles.length) {
          this.logger.warn(
            `Categoría ${slugCategoria}: no se encontraron productos nuevos; se detiene para evitar un ciclo`,
          );
          break;
        }

        numeroTanda++;
      }

      const products = [...productosPorUrl.values()];
      return {
        categoria: slugCategoria,
        total: products.length,
        products,
      };
    } catch (error) {
      this.logger.error(
        `Error en el proceso de scraping: ${(error as Error).message}`,
      );
      throw error;
    } finally {
      await browser.close();
    }
  }
}
