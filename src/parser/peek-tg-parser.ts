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


    // Заполнение подарка (обязательно)
    await this.selectDropdownValue(page, 'Подарок', criteria.gift_name, [
      // Английские селекторы
      'button:has-text("All gifts")',
      'button[aria-haspopup="listbox"]:has-text("All gifts")',
      'button[type="button"]:has-text("All gifts")',
      'div:has(label:has-text("Gift")) button[type="button"]',
      'div:has(label:has-text("Gift")) button',
      // Селекторы по классам из HTML
      'button[class*="relative"]:has-text("All gifts")',
      'button[class*="flex"]:has-text("All gifts")',
      'button[class*="w-full"]:has-text("All gifts")',
      // Селектор по span внутри кнопки
      'button:has(span:has-text("All gifts"))'
    ]);

    // Заполнение модели, если указана
    if (criteria.model) {
      await this.selectDropdownValue(page, 'Коллекция', criteria.model, [
        'button:has-text("All models")',
        'button[aria-haspopup="listbox"]:has-text("All models")',
        'button[type="button"]:has-text("All models")',
        'div:has(label:has-text("Model")) button[type="button"]',
        'div:has(label:has-text("Model")) button',
        'button[class*="relative"]:has-text("All models")',
        'button[class*="flex"]:has-text("All models")',
        'button[class*="w-full"]:has-text("All models")',
        'button:has(span:has-text("All models"))'
      ]);
    }

    // Заполнение фона, если указан
    if (criteria.background) {
      await this.selectDropdownValue(page, 'Фон', criteria.background, [
        'button:has-text("All backgrounds")',
        'button[aria-haspopup="listbox"]:has-text("All backgrounds")',
        'button[type="button"]:has-text("All backgrounds")',
        'div:has(label:has-text("Background")) button[type="button"]',
        'div:has(label:has-text("Background")) button',
        'button[class*="relative"]:has-text("All backgrounds")',
        'button[class*="flex"]:has-text("All backgrounds")',
        'button[class*="w-full"]:has-text("All backgrounds")',
        'button:has(span:has-text("All backgrounds"))'
      ]);
    }

    // Заполнение узора, если указан
    if (criteria.pattern) {
      await this.selectDropdownValue(page, 'Узор', criteria.pattern, [
        'button:has-text("All patterns")',
        'button[aria-haspopup="listbox"]:has-text("All patterns")',
        'button[type="button"]:has-text("All patterns")',
        'div:has(label:has-text("Pattern")) button[type="button"]',
        'div:has(label:has-text("Pattern")) button',
        'button[class*="relative"]:has-text("All patterns")',
        'button[class*="flex"]:has-text("All patterns")',
        'button[class*="w-full"]:has-text("All patterns")',
        'button:has(span:has-text("All patterns"))'
      ]);
    }
  }

  private async selectDropdownValue(page: Page, fieldName: string, value: string, buttonSelectors: string[]): Promise<void> {
    console.log(`  🔍 Выбор ${fieldName}: ${value}`);
    
    // Находим и кликаем на кнопку dropdown
    let dropdownButton = null;
    for (const selector of buttonSelectors) {
      try {
        dropdownButton = await page.$(selector);
        if (dropdownButton) {
          console.log(`    ✅ Найдена кнопка ${fieldName}: ${selector}`);
          break;
        }
      } catch (error) {
        // Продолжаем поиск
      }
    }

    if (!dropdownButton) {
      console.log(`    ⚠️ Кнопка ${fieldName} не найдена, пропускаем`);
      return;
    }

    try {
      // Кликаем на кнопку dropdown
      await dropdownButton.click();
      console.log(`    ✅ Кликнули на кнопку ${fieldName}`);
      
      // Ждем появления поля поиска
      await page.waitForTimeout(1000);
      
      // Ищем поле поиска и вводим значение
      const searchInputSelectors = [
        'input[placeholder="Search..."]',
        'input[type="text"][placeholder="Search..."]',
        'div[role="listbox"] input[placeholder="Search..."]',
        'input[class*="bg-gray-700"]'
      ];
      
      let searchInput = null;
      for (const selector of searchInputSelectors) {
        try {
          searchInput = await page.$(selector);
          if (searchInput) {
            console.log(`    ✅ Найдено поле поиска для ${fieldName} с селектором: ${selector}`);
            break;
          }
        } catch (error) {
          // Продолжаем поиск
        }
      }
      
      if (searchInput) {
        console.log(`    ✅ Найдено поле поиска для ${fieldName}`);
        await searchInput.fill(value);
        console.log(`    ✅ Введено значение: ${value}`);
        
        // Ждем появления результатов поиска
        await page.waitForTimeout(1500);
        
        // Ищем опцию с нужным значением в результатах поиска
        const optionSelectors = [
          `[role="option"]:has-text("${value}")`,
          `div[role="option"]:has-text("${value}")`,
          `div:has-text("${value}"):has([role="option"])`,
          `div[class*="cursor-pointer"]:has-text("${value}")`
        ];

        let optionFound = false;
        for (const optionSelector of optionSelectors) {
          try {
            const option = await page.$(optionSelector);
            if (option) {
              await option.click();
              console.log(`    ✅ Выбрана опция ${fieldName}: ${value}`);
              optionFound = true;
              break;
            }
          } catch (error) {
            // Продолжаем поиск
          }
        }

        if (!optionFound) {
          console.log(`    ⚠️ Опция "${value}" не найдена в результатах поиска ${fieldName}`);
          
          // Показываем доступные опции для отладки
          const allOptions = await page.$$('[role="option"], div[class*="cursor-pointer"]');
          console.log(`    📋 Доступные опции в ${fieldName}:`);
          for (let i = 0; i < Math.min(allOptions.length, 5); i++) {
            const text = await allOptions[i].textContent();
            if (text && text.trim()) {
              console.log(`      - "${text.trim()}"`);
            }
          }
        }
      } else {
        console.log(`    ⚠️ Поле поиска не найдено для ${fieldName}`);
      }

      // Закрываем dropdown, кликнув вне его
      await page.click('body');
      await page.waitForTimeout(500);

    } catch (error) {
      console.log(`    ❌ Ошибка при выборе ${fieldName}:`, error);
    }
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

    // Ожидание появления счетчика результатов
    const resultSelectors = [
      // Точный селектор для счетчика результатов
      'span.font-medium.text-white',
      // Альтернативные селекторы
      'text=/Найдено:\\s*\\d+/i',
      'text=/Found:\\s*\\d+/i',
      '[class*="result" i]',
      '[data-testid*="result" i]',
      'text="Найдено"',
      'text="Found"',
      '[class*="gift" i]',
      '[class*="item" i]'
    ];

    for (const selector of resultSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
        console.log(`  ✅ Результаты загружены (селектор: ${selector})`);
        
        // Дополнительная пауза для полной загрузки
        await page.waitForTimeout(1000);
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
    console.log('  🔍 Поиск точного счетчика результатов...');

    // Быстрый поиск по конкретному селектору (самый частый случай)
    try {
      const element = await page.$('span.font-medium.text-white');
      if (element) {
        const text = await element.textContent();
        if (text) {
          const match = text.match(/[\d,]+/);
          if (match) {
            // Убираем запятые и парсим число
            const cleanNumber = match[0].replace(/,/g, '');
            const count = parseInt(cleanNumber, 10);
            console.log(`  📊 Найдено количество из селектора "span.font-medium.text-white": ${count} (текст: "${text}")`);
            return count;
          }
        }
      }
    } catch (error) {
      console.log('  ⚠️ Не удалось найти span.font-medium.text-white');
    }

    // Резервный поиск по тексту "Найдено: X"
    try {
      const foundText = await page.textContent('text=/Найдено:\\s*[\\d,]+/i');
      if (foundText) {
        const match = foundText.match(/Найдено:\s*([\d,]+)/i);
        if (match) {
          // Убираем запятые и парсим число
          const cleanNumber = match[1].replace(/,/g, '');
          const count = parseInt(cleanNumber, 10);
          console.log(`  📊 Найдено количество из текста "Найдено: X": ${count}`);
          return count;
        }
      }
    } catch (error) {
      console.log('  ⚠️ Не удалось найти текст "Найдено: X"');
    }

    // Дополнительные селекторы как резерв
    const countSelectors = [
      '[class*="count" i]',
      '[data-testid*="count" i]'
    ];

    for (const selector of countSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await element.textContent();
          if (text) {
            const match = text.match(/[\d,]+/);
            if (match) {
              // Убираем запятые и парсим число
              const cleanNumber = match[0].replace(/,/g, '');
              const count = parseInt(cleanNumber, 10);
              console.log(`  📊 Найдено количество из селектора "${selector}": ${count} (текст: "${text}")`);
              return count;
            }
          }
        }
      } catch (error) {
        // Продолжаем поиск
      }
    }

    // В крайнем случае считаем элементы карточек подарков
    const itemSelectors = [
      'img[src*="gift"]',
      'img[alt*="gift" i]',
      '[class*="gift" i] img',
      '[class*="item" i] img'
    ];

    for (const selector of itemSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0 && elements.length < 100) { // Ограничиваем разумным числом
          console.log(`  📊 Найдено элементов через селектор "${selector}": ${elements.length}`);
          return elements.length;
        }
      } catch (error) {
        // Продолжаем поиск
      }
    }

    console.log('  ⚠️ Не удалось определить количество подарков');
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

  public async getLastGiftLink(criteria: SearchCriteria): Promise<string | undefined> {
    if (!this.browser) {
      throw new Error('Браузер не инициализирован. Вызовите initialize() сначала.');
    }

    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      console.log(`🔗 Получение ссылки на последний подарок: ${criteria.gift_name}${criteria.model ? ` (${criteria.model})` : ''}`);
      
      const page = await this.browser.newPage();
      
      // Настройка страницы
      await this.setupPage(page);
      
      // Переход на сайт
      await page.goto(this.config.baseUrl, { 
        waitUntil: 'networkidle',
        timeout: this.config.timeout 
      });

      // Выполнение поиска
      await this.performSearch(page, criteria);

      // Получение ссылки на последний подарок
      const lastGiftLink = await this.extractLastGiftLink(page);
      
      await page.close();

      const responseTime = Date.now() - startTime;
      this.updateStats(true, responseTime);

      console.log(`✅ Ссылка получена за ${responseTime}ms${lastGiftLink ? `: ${lastGiftLink}` : ' (не найдена)'}`);
      return lastGiftLink;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateStats(false, responseTime);
      
      const parserError: ParserError = {
        message: error instanceof Error ? error.message : 'Неизвестная ошибка',
        code: 'LINK_EXTRACTION_FAILED',
        timestamp: new Date()
      };

      console.error('❌ Ошибка получения ссылки:', parserError.message);
      throw parserError;
    }
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

  private async extractLastGiftLink(page: Page): Promise<string | undefined> {
    console.log('  🔗 Поиск ссылки на последний подарок...');

    try {
      // Принудительно закрываем модальное окно подписки
      await this.closeSubscriptionModal(page);
      
      // Дополнительная проверка и закрытие через JavaScript
      await page.evaluate(() => {
        // Удаляем все модальные окна
        const modals = document.querySelectorAll('[id*="modal"], [class*="modal"], [id*="subscribe"]');
        modals.forEach(modal => {
          if (modal instanceof HTMLElement) {
            modal.style.display = 'none';
            modal.remove();
          }
        });
        
        // Удаляем overlay элементы
        const overlays = document.querySelectorAll('[class*="overlay"], [class*="backdrop"]');
        overlays.forEach(overlay => {
          if (overlay instanceof HTMLElement) {
            overlay.style.display = 'none';
            overlay.remove();
          }
        });
      });

      // Ищем блок с подарками
      const giftsContainer = await page.$('div.grid.gap-2.md\\:gap-3.grid-cols-3.sm\\:grid-cols-4.md\\:grid-cols-5.lg\\:grid-cols-6.mb-5');
      
      if (!giftsContainer) {
        console.log('  ⚠️ Контейнер с подарками не найден');
        return undefined;
      }

      // Находим все карточки подарков
      const giftCards = await giftsContainer.$$('div > div');
      
      if (giftCards.length === 0) {
        console.log('  ⚠️ Карточки подарков не найдены');
        return undefined;
      }

      // Берем последнюю карточку
      const lastGiftCard = giftCards[giftCards.length - 1];
      
      // Кликаем на последний подарок с принудительным кликом
      console.log('  🖱️ Кликаем на последний подарок...');
      
      try {
        // Пробуем обычный клик
        await lastGiftCard.click({ timeout: 5000 });
      } catch (clickError) {
        console.log('  ⚠️ Обычный клик не сработал, пробуем принудительный...');
        // Принудительный клик через JavaScript
        await page.evaluate((element) => {
          if (element && element instanceof HTMLElement) {
            element.click();
          }
        }, lastGiftCard);
      }
      
      // Ждем загрузки страницы подарка
      await page.waitForTimeout(3000);
      
      // Ищем ссылку на Telegram
      const telegramLink = await page.$('a[href*="t.me/nft/"]');
      
      if (telegramLink) {
        const href = await telegramLink.getAttribute('href');
        if (href) {
          console.log(`  ✅ Найдена ссылка на подарок: ${href}`);
          return href;
        }
      }

      // Альтернативный способ - ищем в URL страницы
      const currentUrl = page.url();
      const urlMatch = currentUrl.match(/\/gifts\/([^\/]+)/);
      if (urlMatch) {
        const giftId = urlMatch[1];
        const telegramUrl = `https://t.me/nft/${giftId}`;
        console.log(`  ✅ Ссылка получена из URL: ${telegramUrl}`);
        return telegramUrl;
      }

      console.log('  ⚠️ Ссылка на Telegram не найдена');
      return undefined;

    } catch (error) {
      console.log(`  ⚠️ Ошибка при получении ссылки на подарок: ${error}`);
      return undefined;
    }
  }

  private async closeSubscriptionModal(page: Page): Promise<void> {
    try {
      // Ищем модальное окно подписки
      const modal = await page.$('#subscribe-modal-portal');
      if (modal) {
        console.log('  🚫 Закрываем модальное окно подписки...');
        
        // Пробуем несколько способов закрытия
        const closeSelectors = [
          'button[aria-label="Close"]',
          'button[aria-label="close"]', 
          'button:has-text("×")',
          'button:has-text("✕")',
          'button[class*="close"]',
          'button[class*="Close"]',
          '[data-testid="close"]',
          '.close-button',
          'button[type="button"]:has(svg)'
        ];
        
        let closed = false;
        for (const selector of closeSelectors) {
          try {
            const closeButton = await page.$(selector);
            if (closeButton) {
              await closeButton.click();
              await page.waitForTimeout(1000);
              closed = true;
              break;
            }
          } catch (e) {
            // Продолжаем с следующим селектором
          }
        }
        
        // Если кнопка не найдена, пробуем Escape
        if (!closed) {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(1000);
        }
        
        // Принудительно скрываем модальное окно через JavaScript
        await page.evaluate(() => {
          const modal = document.getElementById('subscribe-modal-portal');
          if (modal) {
            modal.style.display = 'none';
            modal.remove();
          }
        });
        
        // Проверяем, что модальное окно закрылось
        const isModalVisible = await page.$('#subscribe-modal-portal');
        if (!isModalVisible) {
          console.log('  ✅ Модальное окно закрыто');
        } else {
          console.log('  ⚠️ Модальное окно все еще видимо, продолжаем...');
        }
      }
    } catch (error) {
      console.log('  ⚠️ Не удалось закрыть модальное окно:', error);
    }
  }
}
