import { DatabaseConnection } from '../connection';
import { MonitoringHistory } from '../../types/database';

export class MonitoringHistoryModel {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  public async create(presetId: number, count: number, hasChanged: boolean = false): Promise<MonitoringHistory> {
    const sql = `
      INSERT INTO monitoring_history (preset_id, count, has_changed)
      VALUES (?, ?, ?)
    `;
    
    const params = [presetId, count, hasChanged];
    const result = await this.db.run(sql, params);
    const id = result.lastID;

    if (!id) {
      throw new Error('Не удалось создать запись истории мониторинга');
    }

    return this.getById(id);
  }

  public async getById(id: number): Promise<MonitoringHistory> {
    const sql = 'SELECT * FROM monitoring_history WHERE id = ?';
    const history = await this.db.get<MonitoringHistory>(sql, [id]);
    
    if (!history) {
      throw new Error(`Запись истории с ID ${id} не найдена`);
    }

    return history;
  }

  public async getByPresetId(presetId: number, limit?: number): Promise<MonitoringHistory[]> {
    let sql = 'SELECT * FROM monitoring_history WHERE preset_id = ? ORDER BY checked_at DESC';
    const params: any[] = [presetId];

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    return this.db.all<MonitoringHistory>(sql, params);
  }

  public async getLatestByPresetId(presetId: number): Promise<MonitoringHistory | undefined> {
    const sql = `
      SELECT * FROM monitoring_history 
      WHERE preset_id = ? 
      ORDER BY checked_at DESC 
      LIMIT 1
    `;
    
    return this.db.get<MonitoringHistory>(sql, [presetId]);
  }

  public async getChangedRecords(limit?: number): Promise<MonitoringHistory[]> {
    let sql = 'SELECT * FROM monitoring_history WHERE has_changed = 1 ORDER BY checked_at DESC';
    const params: any[] = [];

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    return this.db.all<MonitoringHistory>(sql, params);
  }

  public async getChangedRecordsByPresetId(presetId: number, limit?: number): Promise<MonitoringHistory[]> {
    let sql = 'SELECT * FROM monitoring_history WHERE preset_id = ? AND has_changed = 1 ORDER BY checked_at DESC';
    const params: any[] = [presetId];

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    return this.db.all<MonitoringHistory>(sql, params);
  }

  public async getRecordsByDateRange(
    presetId: number, 
    startDate: Date, 
    endDate: Date
  ): Promise<MonitoringHistory[]> {
    const sql = `
      SELECT * FROM monitoring_history 
      WHERE preset_id = ? 
      AND checked_at >= ? 
      AND checked_at <= ? 
      ORDER BY checked_at ASC
    `;
    
    return this.db.all<MonitoringHistory>(sql, [presetId, startDate, endDate]);
  }

  public async getStatisticsByPresetId(presetId: number): Promise<{
    totalChecks: number;
    totalChanges: number;
    averageCount: number;
    minCount: number;
    maxCount: number;
    lastCheck: Date | null;
  }> {
    const sql = `
      SELECT 
        COUNT(*) as totalChecks,
        SUM(CASE WHEN has_changed = 1 THEN 1 ELSE 0 END) as totalChanges,
        AVG(count) as averageCount,
        MIN(count) as minCount,
        MAX(count) as maxCount,
        MAX(checked_at) as lastCheck
      FROM monitoring_history 
      WHERE preset_id = ?
    `;
    
    const result = await this.db.get<{
      totalChecks: number;
      totalChanges: number;
      averageCount: number;
      minCount: number;
      maxCount: number;
      lastCheck: string | null;
    }>(sql, [presetId]);

    return {
      totalChecks: result?.totalChecks || 0,
      totalChanges: result?.totalChanges || 0,
      averageCount: result?.averageCount || 0,
      minCount: result?.minCount || 0,
      maxCount: result?.maxCount || 0,
      lastCheck: result?.lastCheck ? new Date(result.lastCheck) : null
    };
  }

  public async deleteOldRecords(daysToKeep: number = 30): Promise<number> {
    const sql = `
      DELETE FROM monitoring_history 
      WHERE checked_at < datetime('now', '-${daysToKeep} days')
    `;
    
    const result = await this.db.run(sql);
    return result.changes || 0;
  }

  public async deleteByPresetId(presetId: number): Promise<void> {
    const sql = 'DELETE FROM monitoring_history WHERE preset_id = ?';
    await this.db.run(sql, [presetId]);
  }
}
