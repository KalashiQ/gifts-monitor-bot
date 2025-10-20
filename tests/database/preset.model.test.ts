import { Database } from '../../src/database/database';
import { PresetModel } from '../../src/database/models/preset.model';
import { CreatePresetData, UpdatePresetData } from '../../src/types/database';

describe('PresetModel', () => {
  let database: Database;
  let presetModel: PresetModel;

  beforeAll(async () => {
    database = new Database({ path: ':memory:' });
    await database.initialize();
    presetModel = database.presets;
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await database.getConnection().run('DELETE FROM presets');
  });

  describe('create', () => {
    it('should create a new preset with all fields', async () => {
      const presetData: CreatePresetData = {
        user_id: 123,
        gift_name: 'Spring Basket',
        model: 'Ritual Goat',
        background: 'Black',
        pattern: 'All patterns',
        is_active: true
      };

      const preset = await presetModel.create(presetData);

      expect(preset).toBeDefined();
      expect(preset.id).toBeGreaterThan(0);
      expect(preset.user_id).toBe(123);
      expect(preset.gift_name).toBe('Spring Basket');
      expect(preset.model).toBe('Ritual Goat');
      expect(preset.background).toBe('Black');
      expect(preset.pattern).toBe('All patterns');
      expect(preset.is_active).toBe(true);
      expect(preset.created_at).toBeDefined();
      expect(preset.updated_at).toBeDefined();
    });

    it('should create a new preset with minimal fields', async () => {
      const presetData: CreatePresetData = {
        user_id: 456,
        gift_name: 'Summer Gift'
      };

      const preset = await presetModel.create(presetData);

      expect(preset).toBeDefined();
      expect(preset.user_id).toBe(456);
      expect(preset.gift_name).toBe('Summer Gift');
      expect(preset.model).toBeNull();
      expect(preset.background).toBeNull();
      expect(preset.pattern).toBeNull();
      expect(preset.is_active).toBe(true); // default value
    });
  });

  describe('getById', () => {
    it('should return preset by id', async () => {
      const presetData: CreatePresetData = {
        user_id: 123,
        gift_name: 'Test Gift'
      };

      const createdPreset = await presetModel.create(presetData);
      const retrievedPreset = await presetModel.getById(createdPreset.id);

      expect(retrievedPreset).toEqual(createdPreset);
    });

    it('should throw error for non-existent preset', async () => {
      await expect(presetModel.getById(999)).rejects.toThrow('Пресет с ID 999 не найден');
    });
  });

  describe('getByUserId', () => {
    it('should return all presets for user', async () => {
      const user1Presets = [
        { user_id: 123, gift_name: 'Gift 1' },
        { user_id: 123, gift_name: 'Gift 2' }
      ];
      const user2Presets = [
        { user_id: 456, gift_name: 'Gift 3' }
      ];

      for (const presetData of user1Presets) {
        await presetModel.create(presetData);
      }
      for (const presetData of user2Presets) {
        await presetModel.create(presetData);
      }

      const user1Results = await presetModel.getByUserId(123);
      const user2Results = await presetModel.getByUserId(456);

      expect(user1Results).toHaveLength(2);
      expect(user2Results).toHaveLength(1);
      expect(user1Results.every(p => p.user_id === 123)).toBe(true);
      expect(user2Results.every(p => p.user_id === 456)).toBe(true);
    });
  });

  describe('update', () => {
    it('should update preset fields', async () => {
      const presetData: CreatePresetData = {
        user_id: 123,
        gift_name: 'Original Gift',
        model: 'Original Model'
      };

      const createdPreset = await presetModel.create(presetData);
      
      const updateData: UpdatePresetData = {
        gift_name: 'Updated Gift',
        model: 'Updated Model',
        is_active: false
      };

      // Добавляем небольшую задержку чтобы убедиться что updated_at изменится
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updatedPreset = await presetModel.update(createdPreset.id, updateData);

      expect(updatedPreset.gift_name).toBe('Updated Gift');
      expect(updatedPreset.model).toBe('Updated Model');
      expect(updatedPreset.is_active).toBe(false);
      expect(updatedPreset.updated_at.getTime()).toBeGreaterThanOrEqual(createdPreset.updated_at.getTime());
    });

    it('should update only specified fields', async () => {
      const presetData: CreatePresetData = {
        user_id: 123,
        gift_name: 'Original Gift',
        model: 'Original Model',
        background: 'Original Background'
      };

      const createdPreset = await presetModel.create(presetData);
      
      const updateData: UpdatePresetData = {
        gift_name: 'Updated Gift'
      };

      const updatedPreset = await presetModel.update(createdPreset.id, updateData);

      expect(updatedPreset.gift_name).toBe('Updated Gift');
      expect(updatedPreset.model).toBe('Original Model'); // unchanged
      expect(updatedPreset.background).toBe('Original Background'); // unchanged
    });
  });

  describe('delete', () => {
    it('should delete preset', async () => {
      const presetData: CreatePresetData = {
        user_id: 123,
        gift_name: 'To Delete'
      };

      const createdPreset = await presetModel.create(presetData);
      await presetModel.delete(createdPreset.id);

      await expect(presetModel.getById(createdPreset.id)).rejects.toThrow();
    });
  });

  describe('findByCriteria', () => {
    it('should find presets by criteria', async () => {
      const presets = [
        { user_id: 123, gift_name: 'Spring Basket', model: 'Goat', background: 'Black' },
        { user_id: 123, gift_name: 'Spring Basket', model: 'Cat', background: 'White' },
        { user_id: 123, gift_name: 'Summer Gift', model: 'Goat', background: 'Black' }
      ];

      for (const presetData of presets) {
        await presetModel.create(presetData);
      }

      const results = await presetModel.findByCriteria({
        gift_name: 'Spring Basket',
        model: 'Goat',
        background: 'Black'
      });

      expect(results).toHaveLength(1);
      expect(results[0].gift_name).toBe('Spring Basket');
      expect(results[0].model).toBe('Goat');
      expect(results[0].background).toBe('Black');
    });
  });

  describe('toggleActive', () => {
    it('should toggle preset active status', async () => {
      const presetData: CreatePresetData = {
        user_id: 123,
        gift_name: 'Test Gift',
        is_active: true
      };

      const createdPreset = await presetModel.create(presetData);
      expect(createdPreset.is_active).toBe(true);

      const toggledPreset = await presetModel.toggleActive(createdPreset.id);
      expect(toggledPreset.is_active).toBe(false);

      const toggledAgain = await presetModel.toggleActive(createdPreset.id);
      expect(toggledAgain.is_active).toBe(true);
    });
  });

  describe('countByUserId', () => {
    it('should count presets for user', async () => {
      const user1Presets = [
        { user_id: 123, gift_name: 'Gift 1' },
        { user_id: 123, gift_name: 'Gift 2' },
        { user_id: 123, gift_name: 'Gift 3' }
      ];
      const user2Presets = [
        { user_id: 456, gift_name: 'Gift 4' }
      ];

      for (const presetData of user1Presets) {
        await presetModel.create(presetData);
      }
      for (const presetData of user2Presets) {
        await presetModel.create(presetData);
      }

      const user1Count = await presetModel.countByUserId(123);
      const user2Count = await presetModel.countByUserId(456);

      expect(user1Count).toBe(3);
      expect(user2Count).toBe(1);
    });
  });
});
