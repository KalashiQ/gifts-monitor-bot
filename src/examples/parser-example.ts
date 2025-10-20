import { ParserService } from '../services/parser-service';
import { Database } from '../database/database';
import { createParserConfig } from '../config/parser-config';
import { SearchCriteria } from '../types/parser';

async function parserExample(): Promise<void> {
  console.log('🚀 Запуск примера работы с парсером peek.tg...\n');

  // Инициализация базы данных
  const database = new Database({ path: './data/example.db' });
  
  try {
    await database.initialize();
    console.log('✅ База данных инициализирована\n');

    // Создание парсера
    const parserConfig = createParserConfig();
    const parserService = new ParserService(parserConfig, database);

    await parserService.initialize();
    console.log('✅ Парсер инициализирован\n');

    // Пример 1: Простой поиск
    console.log('📋 Пример 1: Простой поиск подарков');
    const simpleCriteria: SearchCriteria = {
      gift_name: 'Spring Basket'
    };

    try {
      const simpleResult = await parserService.searchGifts(simpleCriteria);
      console.log(`  ✅ Найдено ${simpleResult.count} подарков`);
      console.log(`  📅 Время поиска: ${simpleResult.timestamp.toLocaleString()}`);
    } catch (error) {
      console.log(`  ❌ Ошибка поиска: ${error}`);
    }

    // Пример 2: Поиск с полными критериями
    console.log('\n📋 Пример 2: Поиск с полными критериями');
    const fullCriteria: SearchCriteria = {
      gift_name: 'Spring Basket',
      model: 'Ritual Goat',
      background: 'Black',
      pattern: 'All patterns'
    };

    try {
      const fullResult = await parserService.searchGifts(fullCriteria);
      console.log(`  ✅ Найдено ${fullResult.count} подарков`);
      console.log(`  🎁 Критерии: ${JSON.stringify(fullResult.searchCriteria, null, 2)}`);
      
      if (fullResult.items.length > 0) {
        console.log(`  📦 Первый подарок: ${fullResult.items[0].name}`);
      }
    } catch (error) {
      console.log(`  ❌ Ошибка поиска: ${error}`);
    }

    // Пример 3: Создание пресета и поиск для него
    console.log('\n📋 Пример 3: Создание пресета и поиск');
    try {
      const preset = await database.presets.create({
        user_id: 123,
        gift_name: 'Summer Gift',
        model: 'Magic Cat',
        background: 'White',
        pattern: 'Stars',
        is_active: true
      });

      console.log(`  ✅ Создан пресет: ${preset.gift_name} (ID: ${preset.id})`);

      const presetResult = await parserService.searchGiftsForPreset(preset);
      console.log(`  🔍 Найдено ${presetResult.count} подарков для пресета`);
    } catch (error) {
      console.log(`  ❌ Ошибка работы с пресетом: ${error}`);
    }

    // Пример 4: Проверка изменений
    console.log('\n📋 Пример 4: Проверка изменений');
    try {
      const activePresets = await database.presets.getAllActive();
      console.log(`  📊 Активных пресетов: ${activePresets.length}`);

      if (activePresets.length > 0) {
        const preset = activePresets[0];
        console.log(`  🔄 Проверка изменений для: ${preset.gift_name}`);

        const changeResult = await parserService.checkPresetChanges(preset);
        console.log(`  📈 Изменения: ${changeResult.hasChanged ? 'да' : 'нет'}`);
        console.log(`  📊 Количество: ${changeResult.oldCount} → ${changeResult.newCount}`);
      }
    } catch (error) {
      console.log(`  ❌ Ошибка проверки изменений: ${error}`);
    }

    // Пример 5: Статистика парсера
    console.log('\n📋 Пример 5: Статистика парсера');
    const stats = parserService.getStats();
    console.log(`  📊 Всего запросов: ${stats.totalRequests}`);
    console.log(`  ✅ Успешных: ${stats.successfulRequests}`);
    console.log(`  ❌ Неудачных: ${stats.failedRequests}`);
    console.log(`  ⏱️ Среднее время ответа: ${stats.averageResponseTime.toFixed(2)}ms`);

    console.log('\n🎉 Пример работы с парсером завершен!');

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await database.close();
    console.log('\n🔌 Соединение с базой данных закрыто');
  }
}

// Запуск примера, если файл выполняется напрямую
if (require.main === module) {
  parserExample().catch(console.error);
}

export { parserExample };
