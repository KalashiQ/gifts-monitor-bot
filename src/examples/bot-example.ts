import dotenv from 'dotenv';
import { DatabaseConnection } from '../database/connection';
import { Database } from '../database/database';
import { PresetModel } from '../database/models/preset.model';
import { ParserService } from '../services/parser-service';
import { TelegramBotService } from '../bot/telegram-bot';
import { createParserConfig } from '../config/parser-config';

// Загружаем переменные окружения
dotenv.config();

async function runBotExample() {
  try {
    console.log('🤖 Bot Example - Starting...');

    // Инициализируем базу данных
    const db = new DatabaseConnection({
      path: './data/example.db'
    });

    // Создаем объект базы данных
    const database = new Database({ path: './data/example.db' });

    // Создаем модели
    const presetModel = new PresetModel(db);
    // const monitoringHistoryModel = new MonitoringHistoryModel(db); // Не используется в этом примере

    // Инициализируем сервис парсера
    const parserConfig = createParserConfig();
    const parserService = new ParserService(parserConfig, database);
    await parserService.initialize();

    // Проверяем токен бота
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.log('❌ TELEGRAM_BOT_TOKEN not found in environment variables');
      console.log('Please set TELEGRAM_BOT_TOKEN in your .env file');
      return;
    }

    // Создаем и запускаем бота
    const bot = new TelegramBotService(
      { token: botToken, polling: true },
      presetModel,
      parserService
    );

    console.log('🚀 Starting bot...');
    await bot.start();

    // Получаем информацию о боте
    const botInfo = await bot.getBotInfo();
    console.log(`✅ Bot started: @${botInfo.username} (${botInfo.first_name})`);

    // Показываем статистику каждые 30 секунд
    const statsInterval = setInterval(() => {
      const stats = bot.getStats();
      console.log(`📊 Bot Stats: Running=${stats.isRunning}, Sessions=${stats.activeSessions}, Uptime=${Math.round(stats.uptime)}s`);
    }, 30000);

    // Обработка завершения
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      clearInterval(statsInterval);
      await bot.stop();
      process.exit(0);
    });

    console.log('✅ Bot is running! Press Ctrl+C to stop');

  } catch (error) {
    console.error('❌ Error running bot example:', error);
  }
}

// Запускаем пример
runBotExample();
