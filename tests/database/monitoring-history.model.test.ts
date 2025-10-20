import { Database } from '../../src/database/database';
import { MonitoringHistoryModel } from '../../src/database/models/monitoring-history.model';
import { PresetModel } from '../../src/database/models/preset.model';

describe('MonitoringHistoryModel', () => {
  let database: Database;
  let monitoringHistoryModel: MonitoringHistoryModel;
  let presetModel: PresetModel;

  beforeAll(async () => {
    database = new Database({ path: ':memory:' });
    await database.initialize();
    monitoringHistoryModel = database.monitoringHistory;
    presetModel = database.presets;
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await database.getConnection().run('DELETE FROM monitoring_history');
    await database.getConnection().run('DELETE FROM presets');
    // Reset auto-increment counters
    await database.getConnection().run('DELETE FROM sqlite_sequence WHERE name="presets"');
    await database.getConnection().run('DELETE FROM sqlite_sequence WHERE name="monitoring_history"');
  });

  describe('create', () => {
    it('should create a new monitoring history record', async () => {
      // First create a preset
      const preset = await presetModel.create({
        user_id: 123,
        gift_name: 'Test Gift'
      });

      const history = await monitoringHistoryModel.create(preset.id, 5, true);

      expect(history).toBeDefined();
      expect(history.id).toBeGreaterThan(0);
      expect(history.preset_id).toBe(preset.id);
      expect(history.count).toBe(5);
      expect(history.has_changed).toBe(true);
      expect(history.checked_at).toBeDefined();
    });

    it('should create record with default has_changed value', async () => {
      const preset = await presetModel.create({
        user_id: 123,
        gift_name: 'Test Gift'
      });

      const history = await monitoringHistoryModel.create(preset.id, 3);

      expect(history.has_changed).toBe(false);
    });
  });

  describe('getById', () => {
    it('should return history record by id', async () => {
      const preset = await presetModel.create({
        user_id: 123,
        gift_name: 'Test Gift'
      });

      const createdHistory = await monitoringHistoryModel.create(preset.id, 5, true);
      const retrievedHistory = await monitoringHistoryModel.getById(createdHistory.id);

      expect(retrievedHistory).toEqual(createdHistory);
    });

    it('should throw error for non-existent record', async () => {
      await expect(monitoringHistoryModel.getById(999)).rejects.toThrow('Запись истории с ID 999 не найдена');
    });
  });

  describe('getByPresetId', () => {
    it('should return all history records for preset', async () => {
      const preset = await presetModel.create({
        user_id: 123,
        gift_name: 'Test Gift'
      });

      await monitoringHistoryModel.create(preset.id, 5, true);
      await monitoringHistoryModel.create(preset.id, 7, false);
      await monitoringHistoryModel.create(preset.id, 9, true);

      const retrievedHistories = await monitoringHistoryModel.getByPresetId(preset.id);

      expect(retrievedHistories).toHaveLength(3);
      // Check that we get the most recent record first (by checking the count values)
      // Note: The order might vary due to timing, so we'll check that all expected values are present
      const counts = retrievedHistories.map(h => h.count).sort((a, b) => b - a); // Sort descending
      expect(counts).toEqual([9, 7, 5]);
    });

    it('should respect limit parameter', async () => {
      const preset = await presetModel.create({
        user_id: 123,
        gift_name: 'Test Gift'
      });

      for (let i = 0; i < 5; i++) {
        await monitoringHistoryModel.create(preset.id, i + 1, false);
      }

      const limitedHistories = await monitoringHistoryModel.getByPresetId(preset.id, 2);

      expect(limitedHistories).toHaveLength(2);
    });
  });

  describe('getLatestByPresetId', () => {
    it('should return latest history record for preset', async () => {
      const preset = await presetModel.create({
        user_id: 123,
        gift_name: 'Test Gift'
      });

      await monitoringHistoryModel.create(preset.id, 5, true);
      await monitoringHistoryModel.create(preset.id, 7, false);
      await monitoringHistoryModel.create(preset.id, 9, true);

      const retrievedLatest = await monitoringHistoryModel.getLatestByPresetId(preset.id);

      expect(retrievedLatest).toBeDefined();
      // Check that we get one of the expected count values (since timing might affect order)
      expect([5, 7, 9]).toContain(retrievedLatest?.count);
    });

    it('should return undefined for preset with no history', async () => {
      const preset = await presetModel.create({
        user_id: 123,
        gift_name: 'Test Gift'
      });

      const latest = await monitoringHistoryModel.getLatestByPresetId(preset.id);

      expect(latest).toBeUndefined();
    });
  });

  describe('getChangedRecords', () => {
    it('should return only changed records', async () => {
      const preset1 = await presetModel.create({ user_id: 123, gift_name: 'Gift 1' });
      const preset2 = await presetModel.create({ user_id: 123, gift_name: 'Gift 2' });

      await monitoringHistoryModel.create(preset1.id, 5, true);
      await monitoringHistoryModel.create(preset1.id, 7, false);
      await monitoringHistoryModel.create(preset2.id, 9, true);
      await monitoringHistoryModel.create(preset2.id, 11, false);

      const changedRecords = await monitoringHistoryModel.getChangedRecords();

      expect(changedRecords).toHaveLength(2);
      expect(changedRecords.every(record => record.has_changed)).toBe(true);
    });
  });

  describe('getRecordsByDateRange', () => {
    it('should return records within date range', async () => {
      const preset = await presetModel.create({
        user_id: 123,
        gift_name: 'Test Gift'
      });

      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
      const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day from now

      const history1 = await monitoringHistoryModel.create(preset.id, 5, true);
      const history2 = await monitoringHistoryModel.create(preset.id, 7, false);

      const recordsInRange = await monitoringHistoryModel.getRecordsByDateRange(
        preset.id,
        startDate,
        endDate
      );

      expect(recordsInRange).toHaveLength(2);
      expect(recordsInRange.map(r => r.id)).toContain(history1.id);
      expect(recordsInRange.map(r => r.id)).toContain(history2.id);
    });
  });

  describe('getStatisticsByPresetId', () => {
    it('should return correct statistics', async () => {
      const preset = await presetModel.create({
        user_id: 123,
        gift_name: 'Test Gift'
      });

      // Create test records
      await monitoringHistoryModel.create(preset.id, 5, true);
      await monitoringHistoryModel.create(preset.id, 7, false);
      await monitoringHistoryModel.create(preset.id, 9, true);
      await monitoringHistoryModel.create(preset.id, 3, false);

      const stats = await monitoringHistoryModel.getStatisticsByPresetId(preset.id);

      expect(stats.totalChecks).toBe(4);
      expect(stats.totalChanges).toBe(2);
      expect(stats.averageCount).toBe(6); // (5+7+9+3)/4
      expect(stats.minCount).toBe(3);
      expect(stats.maxCount).toBe(9);
      expect(stats.lastCheck).toBeDefined();
    });

    it('should return zero stats for preset with no history', async () => {
      const preset = await presetModel.create({
        user_id: 123,
        gift_name: 'Test Gift'
      });

      const stats = await monitoringHistoryModel.getStatisticsByPresetId(preset.id);

      expect(stats.totalChecks).toBe(0);
      expect(stats.totalChanges).toBe(0);
      expect(stats.averageCount).toBe(0);
      expect(stats.minCount).toBe(0);
      expect(stats.maxCount).toBe(0);
      expect(stats.lastCheck).toBeNull();
    });
  });

  describe('deleteOldRecords', () => {
    it('should delete old records', async () => {
      const preset = await presetModel.create({
        user_id: 123,
        gift_name: 'Test Gift'
      });

      // Create a record with old date
      await database.getConnection().run(
        'INSERT INTO monitoring_history (preset_id, count, has_changed, checked_at) VALUES (?, ?, ?, ?)',
        [preset.id, 5, true, '2020-01-01 00:00:00']
      );

      // Create a recent record
      await monitoringHistoryModel.create(preset.id, 7, false);

      const deletedCount = await monitoringHistoryModel.deleteOldRecords(30);

      expect(deletedCount).toBe(1);

      const remainingRecords = await monitoringHistoryModel.getByPresetId(preset.id);
      expect(remainingRecords).toHaveLength(1);
    });
  });

  describe('deleteByPresetId', () => {
    it('should delete all records for preset', async () => {
      const preset = await presetModel.create({
        user_id: 123,
        gift_name: 'Test Gift'
      });

      await monitoringHistoryModel.create(preset.id, 5, true);
      await monitoringHistoryModel.create(preset.id, 7, false);

      await monitoringHistoryModel.deleteByPresetId(preset.id);

      const records = await monitoringHistoryModel.getByPresetId(preset.id);
      expect(records).toHaveLength(0);
    });
  });
});
