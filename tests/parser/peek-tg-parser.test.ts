import { PeekTgParser } from '../../src/parser/peek-tg-parser';
import { ParserConfig, SearchCriteria } from '../../src/types/parser';

// Мокаем Playwright
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn()
  }
}));

describe('PeekTgParser', () => {
  let parser: PeekTgParser;
  let mockBrowser: any;
  let mockPage: any;

  const config: ParserConfig = {
    baseUrl: 'https://peek.tg/search',
    timeout: 10000,
    retryAttempts: 2,
    retryDelay: 1000,
    headless: true
  };

  beforeEach(() => {
    // Создаем моки для браузера и страницы
    mockPage = {
      goto: jest.fn(),
      waitForSelector: jest.fn(),
      $: jest.fn(),
      $$: jest.fn(),
      setExtraHTTPHeaders: jest.fn(),
      setViewportSize: jest.fn(),
      route: jest.fn(),
      close: jest.fn()
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn()
    };

    // Мокаем chromium.launch
    const { chromium } = require('playwright');
    chromium.launch.mockResolvedValue(mockBrowser);

    parser = new PeekTgParser(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize browser successfully', async () => {
      await parser.initialize();
      expect(mockBrowser).toBeDefined();
    });

    it('should close browser successfully', async () => {
      await parser.initialize();
      await parser.close();
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('searchGifts', () => {
    beforeEach(async () => {
      await parser.initialize();
    });

    it('should throw error if browser not initialized', async () => {
      const uninitializedParser = new PeekTgParser(config);
      const criteria: SearchCriteria = {
        gift_name: 'Spring Basket'
      };

      await expect(uninitializedParser.searchGifts(criteria))
        .rejects.toThrow('Браузер не инициализирован');
    });

    it('should perform search with basic criteria', async () => {
      // Настраиваем моки для успешного поиска
      mockPage.goto.mockResolvedValue(undefined);
      mockPage.waitForSelector.mockResolvedValue(undefined);
      mockPage.$.mockImplementation((selector: string) => {
        if (selector.includes('input') || selector.includes('gift')) {
          return Promise.resolve({
            fill: jest.fn().mockResolvedValue(undefined)
          });
        }
        if (selector.includes('button')) {
          return Promise.resolve({
            click: jest.fn().mockResolvedValue(undefined)
          });
        }
        return Promise.resolve(null);
      });
      mockPage.$$.mockResolvedValue([]);

      const criteria: SearchCriteria = {
        gift_name: 'Spring Basket'
      };

      const result = await parser.searchGifts(criteria);

      expect(result).toBeDefined();
      expect(result.searchCriteria).toEqual(criteria);
      expect(result.count).toBe(0); // Пустой результат из-за мока
      expect(mockPage.goto).toHaveBeenCalledWith(config.baseUrl, expect.any(Object));
    });

    it('should perform search with all criteria', async () => {
      // Настраиваем моки для успешного поиска
      mockPage.goto.mockResolvedValue(undefined);
      mockPage.waitForSelector.mockResolvedValue(undefined);
      mockPage.$.mockImplementation((selector: string) => {
        if (selector.includes('input') || selector.includes('select')) {
          return Promise.resolve({
            fill: jest.fn().mockResolvedValue(undefined)
          });
        }
        if (selector.includes('button')) {
          return Promise.resolve({
            click: jest.fn().mockResolvedValue(undefined)
          });
        }
        return Promise.resolve(null);
      });
      mockPage.$$.mockResolvedValue([]);

      const criteria: SearchCriteria = {
        gift_name: 'Spring Basket',
        model: 'Ritual Goat',
        background: 'Black',
        pattern: 'All patterns'
      };

      const result = await parser.searchGifts(criteria);

      expect(result).toBeDefined();
      expect(result.searchCriteria).toEqual(criteria);
      expect(mockPage.goto).toHaveBeenCalledWith(config.baseUrl, expect.any(Object));
    });

    it('should handle search errors', async () => {
      mockPage.goto.mockRejectedValue(new Error('Network error'));

      const criteria: SearchCriteria = {
        gift_name: 'Spring Basket'
      };

      await expect(parser.searchGifts(criteria))
        .rejects.toThrow('Network error');
    });
  });

  describe('searchGiftsWithRetry', () => {
    beforeEach(async () => {
      await parser.initialize();
    });

    it('should retry on failure', async () => {
      mockPage.goto
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce(undefined);
      
      mockPage.waitForSelector.mockResolvedValue(undefined);
      mockPage.$.mockImplementation((selector: string) => {
        if (selector.includes('input')) {
          return Promise.resolve({
            fill: jest.fn().mockResolvedValue(undefined)
          });
        }
        if (selector.includes('button')) {
          return Promise.resolve({
            click: jest.fn().mockResolvedValue(undefined)
          });
        }
        return Promise.resolve(null);
      });
      mockPage.$$.mockResolvedValue([]);

      const criteria: SearchCriteria = {
        gift_name: 'Spring Basket'
      };

      const result = await parser.searchGiftsWithRetry(criteria);

      expect(result).toBeDefined();
      expect(mockPage.goto).toHaveBeenCalledTimes(2);
    });

    it('should fail after all retries', async () => {
      mockPage.goto.mockRejectedValue(new Error('Persistent error'));

      const criteria: SearchCriteria = {
        gift_name: 'Spring Basket'
      };

      await expect(parser.searchGiftsWithRetry(criteria))
        .rejects.toThrow();
    });
  });

  describe('stats', () => {
    beforeEach(async () => {
      await parser.initialize();
    });

    it('should track statistics', async () => {
      const initialStats = parser.getStats();
      expect(initialStats.totalRequests).toBe(0);

      // Мокаем успешный поиск
      mockPage.goto.mockResolvedValue(undefined);
      mockPage.waitForSelector.mockResolvedValue(undefined);
      mockPage.$.mockImplementation((selector: string) => {
        if (selector.includes('input') || selector.includes('gift')) {
          return Promise.resolve({
            fill: jest.fn().mockResolvedValue(undefined)
          });
        }
        if (selector.includes('button')) {
          return Promise.resolve({
            click: jest.fn().mockResolvedValue(undefined)
          });
        }
        return Promise.resolve(null);
      });
      mockPage.$$.mockResolvedValue([]);

      const criteria: SearchCriteria = {
        gift_name: 'Spring Basket'
      };

      await parser.searchGifts(criteria);

      const stats = parser.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.successfulRequests).toBe(1);
      expect(stats.failedRequests).toBe(0);
    });

    it('should reset statistics', async () => {
      // Мокаем успешный поиск
      mockPage.goto.mockResolvedValue(undefined);
      mockPage.waitForSelector.mockResolvedValue(undefined);
      mockPage.$.mockImplementation((selector: string) => {
        if (selector.includes('input') || selector.includes('gift')) {
          return Promise.resolve({
            fill: jest.fn().mockResolvedValue(undefined)
          });
        }
        if (selector.includes('button')) {
          return Promise.resolve({
            click: jest.fn().mockResolvedValue(undefined)
          });
        }
        return Promise.resolve(null);
      });
      mockPage.$$.mockResolvedValue([]);

      const criteria: SearchCriteria = {
        gift_name: 'Spring Basket'
      };

      await parser.searchGifts(criteria);
      parser.resetStats();

      const stats = parser.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
    });
  });
});
