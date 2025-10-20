import { ParserService } from '../../src/services/parser-service';
import { ParserConfig } from '../../src/types/parser';
import { Database } from '../../src/database/database';
import { Preset } from '../../src/types/database';

// Мокаем PeekTgParser
jest.mock('../../src/parser/peek-tg-parser', () => ({
  PeekTgParser: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    close: jest.fn(),
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

describe('ParserService', () => {
  let parserService: ParserService;
  let mockDatabase: jest.Mocked<Database>;
  let mockParser: any;

  const config: ParserConfig = {
    baseUrl: 'https://peek.tg/search',
    timeout: 10000,
    retryAttempts: 2,
    retryDelay: 1000,
    headless: true
  };

  beforeEach(() => {
    // Создаем мок базы данных
    mockDatabase = {
      presets: {
        getAllActive: jest.fn(),
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
      initialize: jest.fn(),
      close: jest.fn(),
      getConnection: jest.fn()
    } as jest.Mocked<Database>;

    parserService = new ParserService(config, mockDatabase);

    // Получаем мок парсера
    const { PeekTgParser } = require('../../src/parser/peek-tg-parser');
    mockParser = new PeekTgParser();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await parserService.initialize();
      expect(mockParser.initialize).toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      await parserService.initialize();
      await parserService.initialize();
      expect(mockParser.initialize).toHaveBeenCalledTimes(1);
    });

    it('should close successfully', async () => {
      await parserService.initialize();
      await parserService.close();
      expect(mockParser.close).toHaveBeenCalled();
    });
  });

  describe('searchGifts', () => {
    beforeEach(async () => {
      await parserService.initialize();
    });

    it('should throw error if not initialized', async () => {
      const uninitializedService = new ParserService(config, mockDatabase);
      await expect(uninitializedService.searchGifts({ gift_name: 'Test' }))
        .rejects.toThrow('ParserService не инициализирован');
    });

    it('should search gifts successfully', async () => {
      const mockResult = {
        count: 5,
        items: [],
        searchCriteria: { gift_name: 'Spring Basket' },
        timestamp: new Date()
      };

      mockParser.searchGiftsWithRetry.mockResolvedValue(mockResult);

      const criteria = { gift_name: 'Spring Basket' };
      const result = await parserService.searchGifts(criteria);

      expect(result).toEqual(mockResult);
      expect(mockParser.searchGiftsWithRetry).toHaveBeenCalledWith(criteria);
    });
  });

  describe('searchGiftsForPreset', () => {
    beforeEach(async () => {
      await parserService.initialize();
    });

    it('should search gifts for preset', async () => {
      const preset: Preset = {
        id: 1,
        user_id: 123,
        gift_name: 'Spring Basket',
        model: 'Ritual Goat',
        background: 'Black',
        pattern: 'All patterns',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockResult = {
        count: 5,
        items: [],
        searchCriteria: {
          gift_name: 'Spring Basket',
          model: 'Ritual Goat',
          background: 'Black',
          pattern: 'All patterns'
        },
        timestamp: new Date()
      };

      mockParser.searchGiftsWithRetry.mockResolvedValue(mockResult);

      const result = await parserService.searchGiftsForPreset(preset);

      expect(result).toEqual(mockResult);
      expect(mockParser.searchGiftsWithRetry).toHaveBeenCalledWith({
        gift_name: 'Spring Basket',
        model: 'Ritual Goat',
        background: 'Black',
        pattern: 'All patterns'
      });
    });

    it('should handle preset with null values', async () => {
      const preset: Preset = {
        id: 1,
        user_id: 123,
        gift_name: 'Spring Basket',
        model: null,
        background: null,
        pattern: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockResult = {
        count: 5,
        items: [],
        searchCriteria: { gift_name: 'Spring Basket' },
        timestamp: new Date()
      };

      mockParser.searchGiftsWithRetry.mockResolvedValue(mockResult);

      const result = await parserService.searchGiftsForPreset(preset);

      expect(result).toEqual(mockResult);
      expect(mockParser.searchGiftsWithRetry).toHaveBeenCalledWith({
        gift_name: 'Spring Basket'
      });
    });
  });

  describe('searchAllActivePresets', () => {
    beforeEach(async () => {
      await parserService.initialize();
    });

    it('should search all active presets', async () => {
      const presets: Preset[] = [
        {
          id: 1,
          user_id: 123,
          gift_name: 'Spring Basket',
          model: 'Ritual Goat',
          background: 'Black',
          pattern: 'All patterns',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 2,
          user_id: 123,
          gift_name: 'Summer Gift',
          model: null,
          background: null,
          pattern: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockDatabase.presets.getAllActive.mockResolvedValue(presets);

      const mockResult1 = {
        count: 5,
        items: [],
        searchCriteria: { gift_name: 'Spring Basket', model: 'Ritual Goat', background: 'Black', pattern: 'All patterns' },
        timestamp: new Date()
      };

      const mockResult2 = {
        count: 3,
        items: [],
        searchCriteria: { gift_name: 'Summer Gift' },
        timestamp: new Date()
      };

      mockParser.searchGiftsWithRetry
        .mockResolvedValueOnce(mockResult1)
        .mockResolvedValueOnce(mockResult2);

      const results = await parserService.searchAllActivePresets();

      expect(results).toHaveLength(2);
      expect(results[0].preset.id).toBe(1);
      expect(results[0].result).toEqual(mockResult1);
      expect(results[1].preset.id).toBe(2);
      expect(results[1].result).toEqual(mockResult2);
    });

    it('should handle errors for individual presets', async () => {
      const presets: Preset[] = [
        {
          id: 1,
          user_id: 123,
          gift_name: 'Spring Basket',
          model: null,
          background: null,
          pattern: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 2,
          user_id: 123,
          gift_name: 'Summer Gift',
          model: null,
          background: null,
          pattern: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockDatabase.presets.getAllActive.mockResolvedValue(presets);

      const mockResult = {
        count: 5,
        items: [],
        searchCriteria: { gift_name: 'Spring Basket' },
        timestamp: new Date()
      };

      mockParser.searchGiftsWithRetry
        .mockResolvedValueOnce(mockResult)
        .mockRejectedValueOnce(new Error('Search failed'));

      const results = await parserService.searchAllActivePresets();

      expect(results).toHaveLength(1);
      expect(results[0].preset.id).toBe(1);
    });
  });

  describe('checkPresetChanges', () => {
    beforeEach(async () => {
      await parserService.initialize();
    });

    it('should detect changes in preset', async () => {
      const preset: Preset = {
        id: 1,
        user_id: 123,
        gift_name: 'Spring Basket',
        model: null,
        background: null,
        pattern: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      const lastHistory = {
        id: 1,
        preset_id: 1,
        count: 5,
        checked_at: new Date(),
        has_changed: false
      };

      const mockResult = {
        count: 8,
        items: [],
        searchCriteria: { gift_name: 'Spring Basket' },
        timestamp: new Date()
      };

      mockDatabase.monitoringHistory.getLatestByPresetId.mockResolvedValue(lastHistory);
      mockParser.searchGiftsWithRetry.mockResolvedValue(mockResult);
      mockDatabase.monitoringHistory.create.mockResolvedValue({
        id: 2,
        preset_id: 1,
        count: 8,
        checked_at: new Date(),
        has_changed: true
      });

      const result = await parserService.checkPresetChanges(preset);

      expect(result.hasChanged).toBe(true);
      expect(result.oldCount).toBe(5);
      expect(result.newCount).toBe(8);
      expect(mockDatabase.monitoringHistory.create).toHaveBeenCalledWith(1, 8, true);
    });

    it('should handle preset with no previous history', async () => {
      const preset: Preset = {
        id: 1,
        user_id: 123,
        gift_name: 'Spring Basket',
        model: null,
        background: null,
        pattern: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockResult = {
        count: 5,
        items: [],
        searchCriteria: { gift_name: 'Spring Basket' },
        timestamp: new Date()
      };

      mockDatabase.monitoringHistory.getLatestByPresetId.mockResolvedValue(undefined);
      mockParser.searchGiftsWithRetry.mockResolvedValue(mockResult);
      mockDatabase.monitoringHistory.create.mockResolvedValue({
        id: 1,
        preset_id: 1,
        count: 5,
        checked_at: new Date(),
        has_changed: false
      });

      const result = await parserService.checkPresetChanges(preset);

      expect(result.hasChanged).toBe(false);
      expect(result.oldCount).toBe(0);
      expect(result.newCount).toBe(5);
    });
  });

  describe('stats', () => {
    beforeEach(async () => {
      await parserService.initialize();
    });

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
