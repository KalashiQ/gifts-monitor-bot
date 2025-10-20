import { DatabaseConnection } from './connection';

export class DatabaseMigrations {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  public async runMigrations(): Promise<void> {
    console.log('Запуск миграций базы данных...');
    
    await this.createPresetsTable();
    await this.createMonitoringHistoryTable();
    
    console.log('Миграции базы данных завершены');
  }

  private async createPresetsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS presets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        gift_name TEXT NOT NULL,
        model TEXT,
        background TEXT,
        pattern TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await this.db.run(sql);
    console.log('Таблица presets создана/обновлена');
  }

  private async createMonitoringHistoryTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS monitoring_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        preset_id INTEGER NOT NULL,
        count INTEGER NOT NULL,
        checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        has_changed BOOLEAN DEFAULT 0,
        FOREIGN KEY (preset_id) REFERENCES presets (id) ON DELETE CASCADE
      )
    `;

    await this.db.run(sql);
    console.log('Таблица monitoring_history создана/обновлена');
  }

  public async createIndexes(): Promise<void> {
    console.log('Создание индексов...');
    
    // Индекс для поиска пресетов по пользователю
    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_presets_user_id 
      ON presets(user_id)
    `);

    // Индекс для поиска активных пресетов
    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_presets_is_active 
      ON presets(is_active)
    `);

    // Индекс для истории мониторинга по пресету
    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_monitoring_history_preset_id 
      ON monitoring_history(preset_id)
    `);

    // Индекс для истории мониторинга по дате
    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_monitoring_history_checked_at 
      ON monitoring_history(checked_at)
    `);

    console.log('Индексы созданы');
  }
}
