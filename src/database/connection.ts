import sqlite3 from 'sqlite3';
import { DatabaseConfig } from '../types/database';
import path from 'path';
import fs from 'fs';

export class DatabaseConnection {
  private db: sqlite3.Database | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Создаем папку для базы данных если её нет
      const dbDir = path.dirname(this.config.path);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.config.path, (err) => {
        if (err) {
          console.error('Ошибка подключения к базе данных:', err);
          reject(err);
        } else {
          console.log('Подключение к базе данных установлено');
          // Включаем foreign key constraints
          this.db!.run('PRAGMA foreign_keys = ON', (pragmaErr) => {
            if (pragmaErr) {
              console.error('Ошибка включения foreign key constraints:', pragmaErr);
            }
            resolve();
          });
        }
      });
    });
  }

  public async disconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Ошибка закрытия базы данных:', err);
            reject(err);
          } else {
            console.log('Соединение с базой данных закрыто');
            this.db = null;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  public getDatabase(): sqlite3.Database {
    if (!this.db) {
      throw new Error('База данных не подключена');
    }
    return this.db;
  }

  public async run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('База данных не подключена'));
        return;
      }

      this.db.run(sql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  public async get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('База данных не подключена'));
        return;
      }

      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row as T);
        }
      });
    });
  }

  public async all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('База данных не подключена'));
        return;
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }
}
