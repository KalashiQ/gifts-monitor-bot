import dotenv from 'dotenv';
import { Database } from '../database/database';
import { ParserService } from '../services/parser-service';
import { MonitoringService } from '../services/monitoring-service';
import { createParserConfig } from '../config/parser-config';
import { MonitoringConfig } from '../types/monitoring';

// Загружаем переменные окружения
dotenv.config();

async function monitoringExample() {
  try {
    console.log('🚀 Starting Monitoring Example...');

    // Инициализируем базу данных
    console.log('📊 Initializing database...');
    const database = new Database({ path: process.env.DATABASE_PATH || './data/gifts-monitor.db' });
    await database.initialize();

    // Создаем модели (не используется в этом примере)
    // const presetModel = new PresetModel(database.getConnection());

    // Инициализируем сервис парсера
    console.log('🔍 Initializing parser service...');
    const parserConfig = createParserConfig();
    const parserService = new ParserService(parserConfig, database);
    await parserService.initialize();

    // Создаем конфигурацию мониторинга
    const monitoringConfig: MonitoringConfig = {
      enabled: true,
      cronExpression: '*/1 * * * *', // Каждую минуту для примера
      checkIntervalMinutes: 1,
      retryAttempts: 3,
      retryDelayMs: 1000
    };

    // Создаем фиктивный бот для примера
    const mockBot = {
      sendMessage: async (userId: number, message: string) => {
        console.log(`📤 Mock notification to user ${userId}:`);
        console.log(message);
      }
    } as any;

    // Инициализируем сервис мониторинга
    console.log('📊 Initializing monitoring service...');
    const monitoringService = new MonitoringService(database, parserService, mockBot, monitoringConfig);
    await monitoringService.initialize();

    // Запускаем мониторинг
    console.log('🔄 Starting monitoring...');
    await monitoringService.start();

    // Ждем некоторое время для демонстрации
    console.log('⏳ Monitoring is running... Press Ctrl+C to stop');
    
    // Обработка сигналов для graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping monitoring...');
      await monitoringService.cleanup();
      process.exit(0);
    });

    // Показываем статистику каждые 30 секунд
    setInterval(() => {
      const stats = monitoringService.getStats();
      console.log('\n📊 Monitoring Stats:');
      console.log(`  Total checks: ${stats.totalChecks}`);
      console.log(`  Successful: ${stats.successfulChecks}`);
      console.log(`  Failed: ${stats.failedChecks}`);
      console.log(`  Changes detected: ${stats.totalChanges}`);
      console.log(`  Is running: ${stats.isRunning}`);
      console.log(`  Last check: ${stats.lastCheck || 'Never'}`);
    }, 30000);

  } catch (error) {
    console.error('❌ Error in monitoring example:', error);
    process.exit(1);
  }
}

// Запускаем пример
monitoringExample().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
