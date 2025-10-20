import { chromium, Browser, Page } from 'playwright';
import { ParserConfig, SearchCriteria, SearchResult, GiftItem, ParserError, ParserStats } from '../types/parser';

export class PeekTgParser {
  private browser: Browser | null = null;
  private config: ParserConfig;
  private stats: ParserStats;

  constructor(config: ParserConfig) {
    this.config = config;
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };
  }

  public async initialize(): Promise<void> {
    try {
      console.log('🚀 Инициализация Playwright браузера...');
      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      console.log('✅ Браузер инициализирован');
    } catch (error) {
      console.error('❌ Ошибка инициализации браузера:', error);
      throw new Error(`Не удалось инициализировать браузер: ${error}`);
    }
  }

  public async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('🔌 Браузер закрыт');
    }
  }

  public async searchGifts(criteria: SearchCriteria): Promise<SearchResult> {
    if (!this.browser) {
      throw new Error('Браузер не инициализирован. Вызовите initialize() сначала.');
    }

    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      console.log(`🔍 Поиск подарков: ${criteria.gift_name}${criteria.model ? ` (${criteria.model})` : ''}`);
      
      const page = await this.browser.newPage();
      
      // Настройка страницы
      await this.setupPage(page);
      
      // Переход на сайт
      await page.goto(this.config.baseUrl, { 
        waitUntil: 'networkidle',
        timeout: this.config.timeout 
      });

      // Выполнение поиска
      const result = await this.performSearch(page, criteria);
      
      await page.close();

      const responseTime = Date.now() - startTime;
      this.updateStats(true, responseTime);

      console.log(`✅ Найдено ${result.count} подарков за ${responseTime}ms`);
      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateStats(false, responseTime);
      
      const parserError: ParserError = {
        message: error instanceof Error ? error.message : 'Неизвестная ошибка',
        code: 'SEARCH_FAILED',
        timestamp: new Date()
      };

      console.error('❌ Ошибка поиска:', parserError.message);
      throw parserError;
    }
  }

  public async searchGiftsWithRetry(criteria: SearchCriteria): Promise<SearchResult> {
    let lastError: ParserError | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        console.log(`🔄 Попытка ${attempt}/${this.config.retryAttempts}`);
        return await this.searchGifts(criteria);
      } catch (error) {
        lastError = error as ParserError;
        lastError.retryCount = attempt;

        if (attempt < this.config.retryAttempts) {
          console.log(`⏳ Ожидание ${this.config.retryDelay}ms перед повтором...`);
          await this.delay(this.config.retryDelay);
        }
      }
    }

    throw lastError || new Error('Все попытки поиска исчерпаны');
  }

  private async setupPage(page: Page): Promise<void> {
    // Установка User-Agent
    if (this.config.userAgent) {
      await page.setExtraHTTPHeaders({
        'User-Agent': this.config.userAgent
      });
    }

    // Установка viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Блокировка ненужных ресурсов для ускорения
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['image', 'font', 'media'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });
  }

  private async performSearch(page: Page, criteria: SearchCriteria): Promise<SearchResult> {
    try {
      // Ожидание загрузки основных элементов
      await page.waitForSelector('input, select, button', { timeout: 10000 });

      // Заполнение формы поиска
      await this.fillSearchForm(page, criteria);

      // Нажатие кнопки поиска
      await this.clickSearchButton(page);

      // Ожидание результатов
      await this.waitForResults(page);

      // Извлечение данных
      const result = await this.extractSearchResults(page, criteria);

      return result;

    } catch (error) {
      console.error('❌ Ошибка выполнения поиска:', error);
      throw error;
    }
  }

  private async fillSearchForm(page: Page, criteria: SearchCriteria): Promise<void> {
    console.log('📝 Заполнение формы поиска...');

    // Поиск поля "Подарок" (Gift)
    const giftNameSelectors = [
      'input[placeholder*="подарок" i]',
      'input[placeholder*="gift" i]',
      'select[name*="gift" i]',
      '[data-testid*="gift" i]'
    ];

    for (const selector of giftNameSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.fill(criteria.gift_name);
          console.log(`  ✅ Заполнено поле подарка: ${criteria.gift_name}`);
          break;
        }
      } catch (error) {
        // Продолжаем поиск следующего селектора
      }
    }

    // Заполнение модели, если указана
    if (criteria.model) {
      await this.fillOptionalField(page, 'model', criteria.model, [
        'input[placeholder*="модель" i]',
        'input[placeholder*="model" i]',
        'select[name*="model" i]'
      ]);
    }

    // Заполнение фона, если указан
    if (criteria.background) {
      await this.fillOptionalField(page, 'background', criteria.background, [
        'input[placeholder*="фон" i]',
        'input[placeholder*="background" i]',
        'select[name*="background" i]'
      ]);
    }

    // Заполнение узора, если указан
    if (criteria.pattern) {
      await this.fillOptionalField(page, 'pattern', criteria.pattern, [
        'input[placeholder*="узор" i]',
        'input[placeholder*="pattern" i]',
        'select[name*="pattern" i]'
      ]);
    }
  }

  private async fillOptionalField(page: Page, fieldName: string, value: string, selectors: string[]): Promise<void> {
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.fill(value);
          console.log(`  ✅ Заполнено поле ${fieldName}: ${value}`);
          return;
        }
      } catch (error) {
        // Продолжаем поиск следующего селектора
      }
    }
    console.log(`  ⚠️ Поле ${fieldName} не найдено, пропускаем`);
  }

  private async clickSearchButton(page: Page): Promise<void> {
    console.log('🔍 Нажатие кнопки поиска...');

    const searchButtonSelectors = [
      'button:has-text("Найти")',
      'button:has-text("Find")',
      'button:has-text("Search")',
      'button[type="submit"]',
      '[data-testid*="search" i]',
      'button[class*="search" i]'
    ];

    for (const selector of searchButtonSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          console.log('  ✅ Кнопка поиска нажата');
          return;
        }
      } catch (error) {
        // Продолжаем поиск следующего селектора
      }
    }

    throw new Error('Кнопка поиска не найдена');
  }

  private async waitForResults(page: Page): Promise<void> {
    console.log('⏳ Ожидание результатов поиска...');

    // Ожидание появления результатов
    const resultSelectors = [
      '[class*="result" i]',
      '[data-testid*="result" i]',
      'text="Найдено"',
      'text="Found"',
      '[class*="gift" i]',
      '[class*="item" i]'
    ];

    for (const selector of resultSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log('  ✅ Результаты загружены');
        return;
      } catch (error) {
        // Продолжаем поиск следующего селектора
      }
    }

    console.log('  ⚠️ Результаты не найдены, продолжаем...');
  }

  private async extractSearchResults(page: Page, criteria: SearchCriteria): Promise<SearchResult> {
    console.log('📊 Извлечение результатов поиска...');

    try {
      // Поиск количества найденных подарков
      const count = await this.extractCount(page);
      
      // Извлечение списка подарков
      const items = await this.extractGiftItems(page);

      const result: SearchResult = {
        count,
        items,
        searchCriteria: criteria,
        timestamp: new Date()
      };

      console.log(`  ✅ Извлечено ${count} подарков, ${items.length} элементов`);
      return result;

    } catch (error) {
      console.error('❌ Ошибка извлечения результатов:', error);
      throw error;
    }
  }

  private async extractCount(page: Page): Promise<number> {
    const countSelectors = [
      'text=/найдено[\\s:]*\\d+/i',
      'text=/found[\\s:]*\\d+/i',
      '[class*="count" i]',
      '[data-testid*="count" i]'
    ];

    for (const selector of countSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await element.textContent();
          if (text) {
            const match = text.match(/\d+/);
            if (match) {
              return parseInt(match[0], 10);
            }
          }
        }
      } catch (error) {
        // Продолжаем поиск
      }
    }

    // Если не удалось найти количество, считаем элементы
    const itemSelectors = [
      '[class*="gift" i]',
      '[class*="item" i]',
      '[data-testid*="gift" i]'
    ];

    for (const selector of itemSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          return elements.length;
        }
      } catch (error) {
        // Продолжаем поиск
      }
    }

    return 0;
  }

  private async extractGiftItems(page: Page): Promise<GiftItem[]> {
    const items: GiftItem[] = [];

    try {
      // Поиск контейнеров с подарками
      const itemSelectors = [
        '[class*="gift" i]',
        '[class*="item" i]',
        '[data-testid*="gift" i]'
      ];

      let elements: any[] = [];
      for (const selector of itemSelectors) {
        try {
          elements = await page.$$(selector);
          if (elements.length > 0) break;
        } catch (error) {
          // Продолжаем поиск
        }
      }

      // Извлечение данных из каждого элемента
      for (let i = 0; i < Math.min(elements.length, 10); i++) { // Ограничиваем до 10 элементов
        try {
          const item = await this.extractGiftItem(elements[i]);
          if (item) {
            items.push(item);
          }
        } catch (error) {
          console.warn(`⚠️ Ошибка извлечения элемента ${i}:`, error);
        }
      }

    } catch (error) {
      console.warn('⚠️ Ошибка извлечения списка подарков:', error);
    }

    return items;
  }

  private async extractGiftItem(element: any): Promise<GiftItem | null> {
    try {
      // Извлечение ID
      const id = await element.getAttribute('data-id') || 
                 await element.getAttribute('id') || 
                 `item-${Date.now()}`;

      // Извлечение названия
      const nameElement = await element.$('h1, h2, h3, [class*="name" i], [class*="title" i]');
      const name = nameElement ? await nameElement.textContent() : 'Unknown Gift';

      // Извлечение изображения
      const imgElement = await element.$('img');
      const imageUrl = imgElement ? await imgElement.getAttribute('src') : undefined;

      // Извлечение редкости
      const rarityElement = await element.$('[class*="rarity" i], [class*="percent" i]');
      const rarity = rarityElement ? await rarityElement.textContent() : undefined;

      return {
        id: id.trim(),
        name: name?.trim() || 'Unknown Gift',
        imageUrl,
        rarity
      };

    } catch (error) {
      console.warn('⚠️ Ошибка извлечения данных подарка:', error);
      return null;
    }
  }

  private updateStats(success: boolean, responseTime: number): void {
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }

    // Обновление среднего времени ответа
    const totalTime = this.stats.averageResponseTime * (this.stats.successfulRequests - 1) + responseTime;
    this.stats.averageResponseTime = totalTime / this.stats.successfulRequests;
    this.stats.lastRequestTime = new Date();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getStats(): ParserStats {
    return { ...this.stats };
  }

  public resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };
  }
}
