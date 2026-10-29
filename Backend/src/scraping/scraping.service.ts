import { Injectable, Logger } from '@nestjs/common';
import { chromium } from 'playwright';

@Injectable()
export class ScrapingService {
  private readonly logger = new Logger(ScrapingService.name);

  async ejecutarScraping(categoria: string) {
    const slugCategoria = (categoria || 'construccion').trim().toLowerCase();
    const urlDinamica = `https://www.sinsa.com.ni/${slugCategoria}`;

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    try {
      this.logger.log(`Navegando a: ${urlDinamica}...`);
      await page.goto(urlDinamica, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      this.logger.log(
        'Esperando a que se carguen los productos en la pantalla...',
      );
      await page.waitForSelector('.vtex-search-result-3-x-galleryItem', {
        timeout: 15000,
      });

      const catActual = slugCategoria;

      const products = await page
        .locator('.vtex-search-result-3-x-galleryItem')
        .evaluateAll((results, cat) => {
          return Array.from(results).flatMap((e) => {
            const title =
              e
                .querySelector(
                  'h3, .vtex-product-summary-2-x-productNameContainer',
                )
                ?.textContent?.trim();
            if (!title) return [];

            const img = e
              .querySelector('img.vtex-product-summary-2-x-imageNormal, img')
              ?.getAttribute('src');

            const priceContainer = e.querySelector(
              '[class*="currencyContainer"], [class*="priceContainer"], .vtex-product-summary-2-x-priceContainer',
            );
            const rawPrice = priceContainer
              ? (priceContainer.textContent ?? '')
                  .replace(/\s+/g, ' ')
                  .trim()
              : '';

            let precioNumerico = 0;
            if (rawPrice) {
              const matches = rawPrice.match(/C?\$?\s*([\d,]+\.\d{2})/g);
              if (matches && matches.length > 0) {
                const ultimoPrecioStr = matches[matches.length - 1];
                const limpio = ultimoPrecioStr.replace(/[^0-9.]/g, '');
                precioNumerico = Number.parseFloat(limpio) || 0;
              } else {
                const limpio = rawPrice.replace(/[^0-9.]/g, '');
                precioNumerico = Number.parseFloat(limpio) || 0;
              }
            }

            const link = e
              .querySelector(
                'a.vtex-product-summary-2-x-clearLink, a[href*="/p"]',
              )
              ?.getAttribute('href');

            const fullLink = link
              ? link.startsWith('http')
                ? link
                : `https://www.sinsa.com.ni${link}`
              : null;

            return [
              {
                descripcion: title,
                precio: precioNumerico,
                urlProducto: fullLink,
                imagenUrl: img,
                categoria: cat,
                proveedor: 'SINSA',
                unidad: 'Unidad',
              },
            ];
          });
        }, catActual);

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
