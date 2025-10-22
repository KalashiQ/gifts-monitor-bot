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
  // Кладем PID рядом с БД, чтобы PM2 cwd не влиял
  const rawDbPath = process.env.DATABASE_PATH || './data/gifts-monitor.db';
  const resolvedDbPath = path.isAbsolute(rawDbPath) ? rawDbPath : path.resolve(process.cwd(), rawDbPath);
  const pidFile = path.join(path.dirname(resolvedDbPath), 'bot.pid');
  
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
  const rawDbPath = process.env.DATABASE_PATH || './data/gifts-monitor.db';
  const resolvedDbPath = path.isAbsolute(rawDbPath) ? rawDbPath : path.resolve(process.cwd(), rawDbPath);
  const pidFile = path.join(path.dirname(resolvedDbPath), 'bot.pid');
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

    // Инициализируем базу данных (абсолютный путь и гарантированная директория)
    console.log('📊 Initializing database...');
    const rawDbPath = process.env.DATABASE_PATH || './data/gifts-monitor.db';
    const dbPath = path.isAbsolute(rawDbPath) ? rawDbPath : path.resolve(process.cwd(), rawDbPath);
    const dbDir = path.dirname(dbPath);
    try {
      fs.mkdirSync(dbDir, { recursive: true });
    } catch (e) {
      console.error('❌ Failed to create database directory:', dbDir, e);
      throw e;
    }
    console.log(`🗄️ Database path: ${dbPath}`);
    const database = new Database({ path: dbPath });
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
    
    // Проверяем доступность Telegram API перед запуском
    console.log('🔍 Testing Telegram API connectivity...');
    try {
      const testResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      if (!testResponse.ok) {
        throw new Error(`Telegram API test failed: ${testResponse.status} ${testResponse.statusText}`);
      }
      const testData = await testResponse.json();
      if (!testData.ok) {
        throw new Error(`Telegram API error: ${testData.description}`);
      }
      console.log('✅ Telegram API is accessible');
    } catch (error) {
      console.error('❌ Telegram API test failed:', error);
      console.error('This might indicate network connectivity issues.');
      throw error;
    }

    // Создаем конфигурацию мониторинга
    const monitoringConfig: MonitoringConfig = {
      enabled: process.env.MONITORING_ENABLED === 'true', // По умолчанию выключен
      cronExpression: process.env.MONITORING_CRON || '*/1 * * * *', // Каждую минуту
      checkIntervalMinutes: parseInt(process.env.MONITORING_INTERVAL || '1'),
      retryAttempts: parseInt(process.env.MONITORING_RETRY_ATTEMPTS || '3'),
      retryDelayMs: parseInt(process.env.MONITORING_RETRY_DELAY || '1000')
    };

    // Инициализируем бота
    console.log('🤖 Initializing Telegram bot...');
    const bot = new TelegramBotService(botConfig, presetModel, parserService);
    
    // Добавляем дополнительную обработку ошибок для бота
    process.on('unhandledRejection', (reason, promise) => {
      if (reason && typeof reason === 'object' && 'code' in reason && reason.code === 'EFATAL') {
        console.error('❌ Fatal network error detected. This might be due to:');
        console.error('   - Network connectivity issues');
        console.error('   - Telegram API temporary unavailability');
        console.error('   - Firewall blocking requests');
        console.error('   - DNS resolution problems');
        console.error('   - Proxy configuration issues');
        console.error('   - Rate limiting by Telegram');
        console.error('');
        console.error('💡 Try the following solutions:');
        console.error('   1. Check your internet connection');
        console.error('   2. Wait a few minutes and try again');
        console.error('   3. Check if Telegram API is accessible: https://api.telegram.org');
        console.error('   4. Verify your bot token is correct');
        console.error('   5. Check firewall/proxy settings');
      }
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

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
