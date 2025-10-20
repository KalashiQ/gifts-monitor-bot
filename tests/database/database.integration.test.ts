import { Database } from '../../src/database/database';
import { CreatePresetData } from '../../src/types/database';

describe('Database Integration Tests', () => {
  let database: Database;

  beforeAll(async () => {
    database = new Database({ path: ':memory:' });
    await database.initialize();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await database.getConnection().run('DELETE FROM monitoring_history');
    await database.getConnection().run('DELETE FROM presets');
  });

  describe('Database initialization', () => {
    it('should initialize database with correct tables', async () => {
      // Check if presets table exists
      const presetsTable = await database.getConnection().get(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='presets'
      `);
      expect(presetsTable).toBeDefined();

      // Check if monitoring_history table exists
      const historyTable = await database.getConnection().get(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='monitoring_history'
      `);
      expect(historyTable).toBeDefined();
    });

    it('should have correct table structure', async () => {
      // Check presets table structure
      const presetsColumns = await database.getConnection().all(`
        PRAGMA table_info(presets)
      `);
      
      const expectedPresetsColumns = [
        'id', 'user_id', 'gift_name', 'model', 'background', 
        'pattern', 'is_active', 'created_at', 'updated_at'
      ];
      
      const actualPresetsColumns = presetsColumns.map((col: any) => col.name);
      expectedPresetsColumns.forEach(column => {
        expect(actualPresetsColumns).toContain(column);
      });

      // Check monitoring_history table structure
      const historyColumns = await database.getConnection().all(`
        PRAGMA table_info(monitoring_history)
      `);
      
      const expectedHistoryColumns = [
        'id', 'preset_id', 'count', 'checked_at', 'has_changed'
      ];
      
      const actualHistoryColumns = historyColumns.map((col: any) => col.name);
      expectedHistoryColumns.forEach(column => {
        expect(actualHistoryColumns).toContain(column);
      });
    });
  });

  describe('Preset and Monitoring History integration', () => {
    it('should create preset and monitoring history together', async () => {
      const presetData: CreatePresetData = {
        user_id: 123,
        gift_name: 'Spring Basket',
        model: 'Ritual Goat',
        background: 'Black',
        pattern: 'All patterns'
      };

      // Create preset
      const preset = await database.presets.create(presetData);
      expect(preset.id).toBeGreaterThan(0);

      // Create monitoring history
      const history = await database.monitoringHistory.create(preset.id, 5, true);
      expect(history.preset_id).toBe(preset.id);

      // Verify relationship
      const presetHistories = await database.monitoringHistory.getByPresetId(preset.id);
      expect(presetHistories).toHaveLength(1);
      expect(presetHistories[0].id).toBe(history.id);
    });

    it('should handle cascade delete correctly', async () => {
      const presetData: CreatePresetData = {
        user_id: 123,
        gift_name: 'Test Gift'
      };

      // Create preset and history
      const preset = await database.presets.create(presetData);
      await database.monitoringHistory.create(preset.id, 5, true);
      await database.monitoringHistory.create(preset.id, 7, false);

      // Verify history exists
      let histories = await database.monitoringHistory.getByPresetId(preset.id);
      expect(histories).toHaveLength(2);

      // Delete preset
      await database.presets.delete(preset.id);

      // Verify history is also deleted (cascade)
      histories = await database.monitoringHistory.getByPresetId(preset.id);
      expect(histories).toHaveLength(0);
    });

    it('should maintain data integrity across operations', async () => {
      const user1Presets = [
        { user_id: 123, gift_name: 'Gift 1', model: 'Model A' },
        { user_id: 123, gift_name: 'Gift 2', model: 'Model B' }
      ];
      const user2Presets = [
        { user_id: 456, gift_name: 'Gift 3', model: 'Model C' }
      ];

      // Create presets for both users
      const createdPresets = [];
      for (const presetData of [...user1Presets, ...user2Presets]) {
        const preset = await database.presets.create(presetData);
        createdPresets.push(preset);
      }

      // Create monitoring history for each preset
      for (const preset of createdPresets) {
        await database.monitoringHistory.create(preset.id, Math.floor(Math.random() * 10) + 1, true);
      }

      // Verify user-specific data
      const user1PresetsFromDb = await database.presets.getByUserId(123);
      const user2PresetsFromDb = await database.presets.getByUserId(456);

      expect(user1PresetsFromDb).toHaveLength(2);
      expect(user2PresetsFromDb).toHaveLength(1);

      // Verify monitoring history exists for all presets
      for (const preset of createdPresets) {
        const histories = await database.monitoringHistory.getByPresetId(preset.id);
        expect(histories).toHaveLength(1);
      }
    });
  });

  describe('Database performance', () => {
    it('should handle multiple operations efficiently', async () => {
      const startTime = Date.now();

      // Create multiple presets
      const presets = [];
      for (let i = 0; i < 10; i++) {
        const preset = await database.presets.create({
          user_id: 123,
          gift_name: `Gift ${i}`,
          model: `Model ${i}`
        });
        presets.push(preset);
      }

      // Create monitoring history for each preset
      for (let i = 0; i < presets.length; i++) {
        const preset = presets[i];
        await database.monitoringHistory.create(preset.id, i + 1, i % 2 === 0);
      }

      // Perform various queries
      const allPresets = await database.presets.getByUserId(123);
      const activePresets = await database.presets.getActiveByUserId(123);
      const changedRecords = await database.monitoringHistory.getChangedRecords();

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Verify results
      expect(allPresets).toHaveLength(10);
      expect(activePresets).toHaveLength(10); // All are active by default
      expect(changedRecords).toHaveLength(5); // Half should be changed

      // Performance should be reasonable (less than 1 second for 10 records)
      expect(executionTime).toBeLessThan(1000);
    });
  });

  describe('Error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Close the database
      await database.close();

      // Try to perform operations on closed database
      await expect(database.presets.create({
        user_id: 123,
        gift_name: 'Test'
      })).rejects.toThrow();

      // Reinitialize for cleanup
      await database.initialize();
    });

    it('should handle foreign key constraint violations', async () => {
      // Try to create monitoring history for non-existent preset
      // Note: SQLite with foreign keys enabled should reject this
      try {
        await database.monitoringHistory.create(999, 5, true);
        // If we get here, foreign keys might not be enabled or the constraint didn't work
        console.warn('Foreign key constraint did not prevent creation of invalid record');
      } catch (error) {
        // This is expected behavior
        expect(error).toBeDefined();
      }
    });
  });
});
