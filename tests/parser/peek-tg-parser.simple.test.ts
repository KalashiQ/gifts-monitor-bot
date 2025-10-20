import { PeekTgParser } from '../../src/parser/peek-tg-parser';
import { ParserConfig, SearchCriteria } from '../../src/types/parser';

// Мокаем Playwright
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue({
      newPage: jest.fn().mockResolvedValue({
        goto: jest.fn(),
        waitForSelector: jest.fn(),
        $: jest.fn(),
        $$: jest.fn(),
        setExtraHTTPHeaders: jest.fn(),
        setViewportSize: jest.fn(),
        route: jest.fn(),
        close: jest.fn()
      }),
      close: jest.fn()
    })
  }
}));

describe('PeekTgParser Simple Tests', () => {
  let parser: PeekTgParser;

  const config: ParserConfig = {
    baseUrl: 'https://peek.tg/search',
    timeout: 10000,
    retryAttempts: 2,
    retryDelay: 1000,
    headless: true
  };

  beforeEach(() => {
    parser = new PeekTgParser(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create parser instance', () => {
      expect(parser).toBeDefined();
    });

    it('should initialize browser successfully', async () => {
      await expect(parser.initialize()).resolves.not.toThrow();
    });

    it('should close browser successfully', async () => {
      await parser.initialize();
      await expect(parser.close()).resolves.not.toThrow();
    });
  });

  describe('stats', () => {
    it('should return initial stats', () => {
      const stats = parser.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
      expect(stats.averageResponseTime).toBe(0);
    });

    it('should reset stats', () => {
      parser.resetStats();
      const stats = parser.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
      expect(stats.averageResponseTime).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should throw error if browser not initialized', async () => {
      const criteria: SearchCriteria = {
        gift_name: 'Spring Basket'
      };

      await expect(parser.searchGifts(criteria))
        .rejects.toThrow('Браузер не инициализирован');
    });
  });
});
