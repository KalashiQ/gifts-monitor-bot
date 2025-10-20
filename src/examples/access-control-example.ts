import dotenv from 'dotenv';
import { Database } from '../database/database';
import { PresetModel } from '../database/models/preset.model';
import { ParserService } from '../services/parser-service';
import { TelegramBotService } from '../bot/telegram-bot';
import { BotConfig } from '../types/bot';
import { createParserConfig } from '../config/parser-config';

// Загружаем переменные окружения
dotenv.config();

async function accessControlExample() {
  try {
    console.log('🔐 Access Control Example');
    console.log('========================');

    // Инициализируем базу данных
    const database = new Database({ path: './data/example.db' });
    await database.initialize();

    // Создаем модели
    const presetModel = new PresetModel(database.getConnection());

    // Инициализируем сервис парсера
    const parserConfig = createParserConfig();
    const parserService = new ParserService(parserConfig, database);
    await parserService.initialize();

    // Создаем конфигурацию бота
    const botConfig: BotConfig = {
      token: process.env.TELEGRAM_BOT_TOKEN || '',
      polling: false // Не запускаем polling для примера
    };

    // Создаем бота
    const bot = new TelegramBotService(botConfig, presetModel, parserService);

    console.log('\n📊 Access Control Status:');
    console.log(`   - Enabled: ${bot.isAccessControlEnabled()}`);
    console.log(`   - Allowed users: ${bot.getAllowedUsers().join(', ')}`);

    // Тестируем проверку доступа
    const testUserIds = [5753792825, 8078808957, 1234567890, 9876543210];
    
    console.log('\n🧪 Testing access control:');
    for (const userId of testUserIds) {
      const isAllowed = bot.isUserAllowed(userId);
      console.log(`   - User ${userId}: ${isAllowed ? '✅ Allowed' : '❌ Denied'}`);
    }

    // Демонстрация управления доступом
    console.log('\n🔧 Access Control Management:');
    
    // Добавляем нового пользователя
    const newUserId = 9999999999;
    console.log(`\n➕ Adding user ${newUserId}...`);
    bot.addAllowedUser(newUserId);
    console.log(`   - User ${newUserId} added: ${bot.isUserAllowed(newUserId) ? '✅ Allowed' : '❌ Denied'}`);
    
    // Удаляем пользователя
    console.log(`\n➖ Removing user ${newUserId}...`);
    bot.removeAllowedUser(newUserId);
    console.log(`   - User ${newUserId} removed: ${bot.isUserAllowed(newUserId) ? '✅ Allowed' : '❌ Denied'}`);

    // Включаем/выключаем контроль доступа
    console.log('\n🔄 Toggling access control:');
    console.log(`   - Current status: ${bot.isAccessControlEnabled()}`);
    
    bot.setAccessControlEnabled(false);
    console.log(`   - After disabling: ${bot.isAccessControlEnabled()}`);
    console.log(`   - User 1234567890 (not in list): ${bot.isUserAllowed(1234567890) ? '✅ Allowed' : '❌ Denied'}`);
    
    bot.setAccessControlEnabled(true);
    console.log(`   - After re-enabling: ${bot.isAccessControlEnabled()}`);
    console.log(`   - User 1234567890 (not in list): ${bot.isUserAllowed(1234567890) ? '✅ Allowed' : '❌ Denied'}`);

    console.log('\n✅ Access control example completed!');

  } catch (error) {
    console.error('❌ Error in access control example:', error);
  }
}

// Запускаем пример
if (require.main === module) {
  accessControlExample().catch(console.error);
}

export { accessControlExample };
