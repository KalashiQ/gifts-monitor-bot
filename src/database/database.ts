import { DatabaseConnection } from './connection';
import { DatabaseMigrations } from './migrations';
import { PresetModel } from './models/preset.model';
import { MonitoringHistoryModel } from './models/monitoring-history.model';
import { DatabaseConfig } from '../types/database';

export class Database {
  private connection: DatabaseConnection;
  private migrations: DatabaseMigrations;
  public presets: PresetModel;
  public monitoringHistory: MonitoringHistoryModel;

  constructor(config: DatabaseConfig) {
    this.connection = new DatabaseConnection(config);
    this.migrations = new DatabaseMigrations(this.connection);
    this.presets = new PresetModel(this.connection);
    this.monitoringHistory = new MonitoringHistoryModel(this.connection);
  }

  public async initialize(): Promise<void> {
    try {
      await this.connection.connect();
      await this.migrations.runMigrations();
      await this.migrations.createIndexes();
      console.log('База данных инициализирована успешно');
    } catch (error) {
      console.error('Ошибка инициализации базы данных:', error);
      throw error;
    }
  }

  public async close(): Promise<void> {
    await this.connection.disconnect();
  }

  public getConnection(): DatabaseConnection {
    return this.connection;
  }
}
