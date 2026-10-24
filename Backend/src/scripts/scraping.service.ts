import { Injectable, Logger } from '@nestjs/common';
import { chromium } from 'playwright';

@Injectable()
export class ScrapingService {
  private readonly logger = new Logger(ScrapingService.name);

  async ejecutarScraping(categoria: string) {
    const slugCategoria = (categoria || 'construccion').trim().toLowerCase();
    const urlDinamica = `https://www.sinsa.com.ni/${slugCategoria}`;

    // Agregamos un User-Agent real para evitar que VTEX bloquee la conexión automatizada
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
      this.logger.log(`Navegando a: ${urlDinamica}...`);
      await page.goto(urlDinamica, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // 🔥 EXTREMADAMENTE IMPORTANTE: Esperar a que React renderice las tarjetas en el DOM
      this.logger.log('Esperando a que se carguen los productos en la pantalla...');
      await page.waitForSelector('.vtex-search-result-3-x-galleryItem', { timeout: 15000 });

      const products = await page
        .locator('.vtex-search-result-3-x-galleryItem')
        .evaluateAll((results) =>
          Array.from(results).flatMap((e) => {
            const title = e.querySelector('h3, .vtex-product-summary-2-x-productNameContainer')?.textContent?.trim();
            if (!title) return [];

            const img = e
              .querySelector('img.vtex-product-summary-2-x-imageNormal, img')
              ?.getAttribute('src');

            // Selector flexible tolerante a variaciones de clases de VTEX
            const priceContainer = e.querySelector(
              '[class*="currencyContainer"], [class*="priceContainer"], .vtex-product-summary-2-x-priceContainer'
            );
            const price = priceContainer
              ? (priceContainer.textContent ?? '').replace(/\s+/g, ' ').trim()
              : 'No disponible';

            const link = e
              .querySelector('a.vtex-product-summary-2-x-clearLink, a[href*="/p"]')
              ?.getAttribute('href');

            // Convertir el link relativo en absoluto si es necesario
            const fullLink = link
              ? link.startsWith('http')
                ? link
                : `https://www.sinsa.com.ni${link}`
              : null;

            return [{ title, price, link: fullLink, img }];
          })
        );

      return {
        total: products.length,
        products,
      };

    } catch (error) {
      this.logger.error(`Error en el proceso de scraping: ${(error as Error).message}`);
      throw error;
    } finally {
      // Siempre cerramos el navegador en el bloque 'finally' para evitar fugas de memoria en tu PC
      await browser.close();
    }
  }
}
