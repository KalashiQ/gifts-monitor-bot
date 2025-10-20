import { DatabaseConnection } from '../connection';
import { Preset, CreatePresetData, UpdatePresetData, PresetSearchCriteria } from '../../types/database';

export class PresetModel {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  public async create(data: CreatePresetData): Promise<Preset> {
    const sql = `
      INSERT INTO presets (user_id, gift_name, model, background, pattern, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      data.user_id,
      data.gift_name,
      data.model || null,
      data.background || null,
      data.pattern || null,
      data.is_active !== undefined ? data.is_active : true
    ];

    const result = await this.db.run(sql, params);
    const id = result.lastID;

    if (!id) {
      throw new Error('Не удалось создать пресет');
    }

    return this.getById(id);
  }

  public async getById(id: number): Promise<Preset> {
    const sql = 'SELECT * FROM presets WHERE id = ?';
    const preset = await this.db.get<any>(sql, [id]);
    
    if (!preset) {
      throw new Error(`Пресет с ID ${id} не найден`);
    }

    return {
      ...preset,
      is_active: Boolean(preset.is_active),
      created_at: new Date(preset.created_at),
      updated_at: new Date(preset.updated_at)
    };
  }

  public async getByUserId(userId: number): Promise<Preset[]> {
    const sql = 'SELECT * FROM presets WHERE user_id = ? ORDER BY created_at DESC';
    const presets = await this.db.all<any>(sql, [userId]);
    return presets.map(preset => ({
      ...preset,
      is_active: Boolean(preset.is_active),
      created_at: new Date(preset.created_at),
      updated_at: new Date(preset.updated_at)
    }));
  }

  public async getActiveByUserId(userId: number): Promise<Preset[]> {
    const sql = 'SELECT * FROM presets WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC';
    const presets = await this.db.all<any>(sql, [userId]);
    return presets.map(preset => ({
      ...preset,
      is_active: Boolean(preset.is_active),
      created_at: new Date(preset.created_at),
      updated_at: new Date(preset.updated_at)
    }));
  }

  public async getAllActive(): Promise<Preset[]> {
    const sql = 'SELECT * FROM presets WHERE is_active = 1 ORDER BY created_at DESC';
    const presets = await this.db.all<any>(sql);
    return presets.map(preset => ({
      ...preset,
      is_active: Boolean(preset.is_active),
      created_at: new Date(preset.created_at),
      updated_at: new Date(preset.updated_at)
    }));
  }

  public async update(id: number, data: UpdatePresetData): Promise<Preset> {
    const updateFields: string[] = [];
    const params: any[] = [];

    if (data.gift_name !== undefined) {
      updateFields.push('gift_name = ?');
      params.push(data.gift_name);
    }
    if (data.model !== undefined) {
      updateFields.push('model = ?');
      params.push(data.model);
    }
    if (data.background !== undefined) {
      updateFields.push('background = ?');
      params.push(data.background);
    }
    if (data.pattern !== undefined) {
      updateFields.push('pattern = ?');
      params.push(data.pattern);
    }
    if (data.is_active !== undefined) {
      updateFields.push('is_active = ?');
      params.push(data.is_active);
    }

    if (updateFields.length === 0) {
      return this.getById(id);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const sql = `UPDATE presets SET ${updateFields.join(', ')} WHERE id = ?`;
    await this.db.run(sql, params);

    return this.getById(id);
  }

  public async delete(id: number): Promise<void> {
    const sql = 'DELETE FROM presets WHERE id = ?';
    await this.db.run(sql, [id]);
  }

  public async findByCriteria(criteria: PresetSearchCriteria): Promise<Preset[]> {
    const conditions: string[] = ['gift_name = ?'];
    const params: any[] = [criteria.gift_name];

    if (criteria.model) {
      conditions.push('model = ?');
      params.push(criteria.model);
    }
    if (criteria.background) {
      conditions.push('background = ?');
      params.push(criteria.background);
    }
    if (criteria.pattern) {
      conditions.push('pattern = ?');
      params.push(criteria.pattern);
    }

    const sql = `SELECT * FROM presets WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
    const presets = await this.db.all<any>(sql, params);
    return presets.map(preset => ({
      ...preset,
      is_active: Boolean(preset.is_active),
      created_at: new Date(preset.created_at),
      updated_at: new Date(preset.updated_at)
    }));
  }

  public async toggleActive(id: number): Promise<Preset> {
    const preset = await this.getById(id);
    return this.update(id, { is_active: !preset.is_active });
  }

  public async countByUserId(userId: number): Promise<number> {
    const sql = 'SELECT COUNT(*) as count FROM presets WHERE user_id = ?';
    const result = await this.db.get<{ count: number }>(sql, [userId]);
    return result?.count || 0;
  }

  public async countActiveByUserId(userId: number): Promise<number> {
    const sql = 'SELECT COUNT(*) as count FROM presets WHERE user_id = ? AND is_active = 1';
    const result = await this.db.get<{ count: number }>(sql, [userId]);
    return result?.count || 0;
  }
}
