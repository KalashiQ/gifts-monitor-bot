import dotenv from 'dotenv';
import { Database } from './database/database';
import { PresetModel } from './database/models/preset.model';
import { ParserService } from './services/parser-service';
import { TelegramBotService } from './bot/telegram-bot';
import { BotConfig } from './types/bot';
import { createParserConfig } from './config/parser-config';

// Загружаем переменные окружения
dotenv.config();

async function main() {
  try {
    console.log('🚀 Starting Gifts Monitor Bot...');

    // Проверяем наличие токена бота
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables');
    }

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

    // Инициализируем бота
    console.log('🤖 Initializing Telegram bot...');
    const bot = new TelegramBotService(botConfig, presetModel, parserService);

    // Запускаем бота
    await bot.start();

    // Обработка сигналов для graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      await bot.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
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
    process.exit(1);
  }
}

// Запускаем приложение
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
