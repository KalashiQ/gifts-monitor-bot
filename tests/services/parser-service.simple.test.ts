import { ParserService } from '../../src/services/parser-service';
import { ParserConfig } from '../../src/types/parser';

// Мокаем PeekTgParser
jest.mock('../../src/parser/peek-tg-parser', () => ({
  PeekTgParser: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    searchGiftsWithRetry: jest.fn(),
    getStats: jest.fn().mockReturnValue({
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    }),
    resetStats: jest.fn()
  }))
}));

// Мокаем Database
jest.mock('../../src/database/database', () => ({
  Database: jest.fn().mockImplementation(() => ({
    presets: {
      getAllActive: jest.fn().mockResolvedValue([]),
      getByUserId: jest.fn(),
      create: jest.fn(),
      getById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByCriteria: jest.fn(),
      toggleActive: jest.fn(),
      countByUserId: jest.fn(),
      countActiveByUserId: jest.fn()
    },
    monitoringHistory: {
      getLatestByPresetId: jest.fn(),
      create: jest.fn(),
      getByPresetId: jest.fn(),
      getById: jest.fn(),
      getChangedRecords: jest.fn(),
      getChangedRecordsByPresetId: jest.fn(),
      getRecordsByDateRange: jest.fn(),
      getStatisticsByPresetId: jest.fn(),
      deleteOldRecords: jest.fn(),
      deleteByPresetId: jest.fn()
    },
    initialize: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    getConnection: jest.fn()
  }))
}));

describe('ParserService Simple Tests', () => {
  let parserService: ParserService;
  let mockDatabase: any;
  let mockParser: any;

  const config: ParserConfig = {
    baseUrl: 'https://peek.tg/search',
    timeout: 10000,
    retryAttempts: 2,
    retryDelay: 1000,
    headless: true
  };

  beforeEach(() => {
    const { Database } = require('../../src/database/database');
    mockDatabase = new Database();
    
    const { PeekTgParser } = require('../../src/parser/peek-tg-parser');
    mockParser = new PeekTgParser();
    
    parserService = new ParserService(config, mockDatabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create service instance', () => {
      expect(parserService).toBeDefined();
    });

    it('should initialize successfully', async () => {
      await expect(parserService.initialize()).resolves.not.toThrow();
    });

    it('should not initialize twice', async () => {
      await parserService.initialize();
      await parserService.initialize();
      expect(mockParser.initialize).toHaveBeenCalledTimes(1);
    });

    it('should close successfully', async () => {
      await parserService.initialize();
      await expect(parserService.close()).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should throw error if not initialized', async () => {
      const uninitializedService = new ParserService(config, mockDatabase);
      await expect(uninitializedService.searchGifts({ gift_name: 'Test' }))
        .rejects.toThrow('ParserService не инициализирован');
    });
  });

  describe('stats', () => {
    it('should get stats from parser', () => {
      const stats = parserService.getStats();
      expect(stats).toBeDefined();
      expect(mockParser.getStats).toHaveBeenCalled();
    });

    it('should reset stats', () => {
      parserService.resetStats();
      expect(mockParser.resetStats).toHaveBeenCalled();
    });
  });
});
