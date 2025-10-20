import dotenv from 'dotenv';
import { Database } from './database/database';
import { PresetModel } from './database/models/preset.model';
import { ParserService } from './services/parser-service';
import { MonitoringService } from './services/monitoring-service';
import { TelegramBotService } from './bot/telegram-bot';
import { BotConfig } from './types/bot';
import { MonitoringConfig } from './types/monitoring';
import { createParserConfig } from './config/parser-config';
import * as fs from 'fs';
import * as path from 'path';

// Загружаем переменные окружения
dotenv.config();

// Функция для проверки и завершения дублирующих процессов
async function checkAndKillDuplicateProcesses(): Promise<void> {
  const pidFile = path.join(process.cwd(), 'bot.pid');
  
  try {
    // Проверяем, существует ли файл PID
    if (fs.existsSync(pidFile)) {
      const existingPid = fs.readFileSync(pidFile, 'utf8').trim();
      
      try {
        // Проверяем, запущен ли процесс с этим PID
        process.kill(parseInt(existingPid), 0);
        console.log(`⚠️ Найден запущенный процесс бота (PID: ${existingPid}). Завершаем его...`);
        
        // Завершаем старый процесс
        process.kill(parseInt(existingPid), 'SIGTERM');
        
        // Ждем немного для корректного завершения
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Проверяем, завершился ли процесс
        try {
          process.kill(parseInt(existingPid), 0);
          // Если дошли сюда, процесс все еще работает - принудительно завершаем
          process.kill(parseInt(existingPid), 'SIGKILL');
          console.log(`🔴 Принудительно завершен процесс ${existingPid}`);
        } catch (e) {
          console.log(`✅ Процесс ${existingPid} успешно завершен`);
        }
      } catch (e) {
        // Процесс не существует, удаляем файл PID
        console.log(`ℹ️ Процесс ${existingPid} не найден, удаляем файл PID`);
        fs.unlinkSync(pidFile);
      }
    }
    
    // Создаем новый файл PID
    fs.writeFileSync(pidFile, process.pid.toString());
    console.log(`📝 Создан файл PID: ${process.pid}`);
    
  } catch (error) {
    console.error('❌ Ошибка при проверке дублирующих процессов:', error);
  }
}

// Функция для очистки файла PID при завершении
function cleanupPidFile(): void {
  const pidFile = path.join(process.cwd(), 'bot.pid');
  try {
    if (fs.existsSync(pidFile)) {
      fs.unlinkSync(pidFile);
      console.log('🧹 Файл PID очищен');
    }
  } catch (error) {
    console.error('❌ Ошибка при очистке файла PID:', error);
  }
}

async function main() {
  try {
    console.log('🚀 Starting Gifts Monitor Bot...');

    // Проверяем и завершаем дублирующие процессы
    await checkAndKillDuplicateProcesses();

    // Проверяем наличие токена бота
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables');
    }

    // Проверяем формат токена
    if (!botToken.match(/^\d+:[A-Za-z0-9_-]+$/)) {
      throw new Error('TELEGRAM_BOT_TOKEN has invalid format. Expected format: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz');
    }

    console.log(`🤖 Bot token: ${botToken.substring(0, 10)}...`);

    // Инициализируем базу данных
    console.log('📊 Initializing database...');
    const database = new Database({ path: process.env.DATABASE_PATH || './data/gifts-monitor.db' });
    await database.initialize();

    // Создаем модели
    const presetModel = new PresetModel(database.getConnection());

    // Инициализируем сервис парсера
    console.log('🔍 Initializing parser service...');
    const parserConfig = createParserConfig();
    const parserService = new ParserService(parserConfig, database);
    await parserService.initialize();

    // Создаем конфигурацию бота
    const botConfig: BotConfig = {
      token: botToken,
      polling: true
    };

    // Создаем конфигурацию мониторинга
    const monitoringConfig: MonitoringConfig = {
      enabled: process.env.MONITORING_ENABLED !== 'false', // По умолчанию включен
      cronExpression: process.env.MONITORING_CRON || '*/1 * * * *', // Каждую минуту
      checkIntervalMinutes: parseInt(process.env.MONITORING_INTERVAL || '1'),
      retryAttempts: parseInt(process.env.MONITORING_RETRY_ATTEMPTS || '3'),
      retryDelayMs: parseInt(process.env.MONITORING_RETRY_DELAY || '1000')
    };

    // Инициализируем бота
    console.log('🤖 Initializing Telegram bot...');
    const bot = new TelegramBotService(botConfig, presetModel, parserService);

    // Выводим информацию о контроле доступа
    console.log('🔐 Access control status:');
    console.log(`   - Enabled: ${bot.isAccessControlEnabled()}`);
    console.log(`   - Allowed users: ${bot.getAllowedUsers().join(', ')}`);

    // Инициализируем сервис мониторинга
    console.log('📊 Initializing monitoring service...');
    const monitoringService = new MonitoringService(database, parserService, bot, monitoringConfig);
    await monitoringService.initialize();
    
    // Обновляем бота с мониторингом
    bot.setMonitoringService(monitoringService);

    // Запускаем бота
    await bot.start();

    // Запускаем мониторинг если включен
    if (monitoringConfig.enabled) {
      console.log('🔄 Starting monitoring service...');
      await monitoringService.start();
    } else {
      console.log('⚠️ Monitoring is disabled');
    }

    // Обработка сигналов для graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      cleanupPidFile();
      await monitoringService.cleanup();
      await bot.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      cleanupPidFile();
      await monitoringService.cleanup();
      await bot.stop();
      process.exit(0);
    });

    // Обработка необработанных ошибок
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });

    console.log('✅ Bot is running successfully!');
    console.log('Press Ctrl+C to stop the bot');

  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    cleanupPidFile();
    process.exit(1);
  }
}

// Запускаем приложение
main().catch((error) => {
  console.error('Fatal error:', error);
  cleanupPidFile();
  process.exit(1);
});
