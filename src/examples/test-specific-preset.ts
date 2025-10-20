import { ParserService } from '../services/parser-service';
import { Database } from '../database/database';
import { createParserConfig } from '../config/parser-config';
import { SearchCriteria } from '../types/parser';

async function testSpecificPreset(): Promise<void> {
  console.log('🧪 Тестирование конкретного пресета...\n');
  console.log('📋 Пресет:');
  console.log('  🎁 Подарок: Spring Basket');
  console.log('  🐐 Модель: Ritual Goat');
  console.log('  ⚫ Фон: Black');
  console.log('  🎨 Узор: не указан\n');

  // Инициализация базы данных
  const database = new Database({ path: './data/test-preset.db' });
  
  try {
    await database.initialize();
    console.log('✅ База данных инициализирована\n');

    // Создание парсера
    const parserConfig = createParserConfig();
    const parserService = new ParserService(parserConfig, database);

    await parserService.initialize();
    console.log('✅ Парсер инициализирован\n');

    // Создание тестового пресета
    console.log('📝 Создание тестового пресета...');
    const preset = await database.presets.create({
      user_id: 999,
      gift_name: 'Spring Basket',
      model: 'Ritual Goat',
      background: 'Black',
      pattern: undefined, // не указываем узор
      is_active: true
    });
    console.log(`  ✅ Создан пресет ID: ${preset.id}\n`);

    // Тест 1: Поиск с полными критериями
    console.log('🔍 Тест 1: Поиск с полными критериями');
    const fullCriteria: SearchCriteria = {
      gift_name: 'Spring Basket',
      model: 'Ritual Goat',
      background: 'Black'
    };

    let firstResult: any = null;
    try {
      const startTime = Date.now();
      firstResult = await parserService.searchGifts(fullCriteria);
      const searchTime = Date.now() - startTime;

      console.log(`  ✅ Результат поиска:`);
      console.log(`    📊 Найдено подарков: ${firstResult.count}`);
      console.log(`    ⏱️ Время поиска: ${searchTime}ms`);
      console.log(`    📅 Время: ${firstResult.timestamp.toLocaleString()}`);
      
      if (firstResult.items.length > 0) {
        console.log(`    📦 Найденные подарки:`);
        firstResult.items.slice(0, 3).forEach((item: any, index: number) => {
          console.log(`      ${index + 1}. ${item.name} (ID: ${item.id})`);
          if (item.rarity) {
            console.log(`         Редкость: ${item.rarity}`);
          }
        });
        if (firstResult.items.length > 3) {
          console.log(`      ... и еще ${firstResult.items.length - 3} подарков`);
        }
      }
    } catch (error) {
      console.log(`  ❌ Ошибка поиска: ${error}`);
    }

    console.log('\n');

    // Тест 2: Поиск через пресет
    console.log('🔍 Тест 2: Поиск через пресет');
    try {
      const startTime = Date.now();
      const presetResult = await parserService.searchGiftsForPreset(preset);
      const searchTime = Date.now() - startTime;

      console.log(`  ✅ Результат поиска через пресет:`);
      console.log(`    📊 Найдено подарков: ${presetResult.count}`);
      console.log(`    ⏱️ Время поиска: ${searchTime}ms`);
      console.log(`    🎯 Критерии: ${JSON.stringify(presetResult.searchCriteria, null, 4)}`);
    } catch (error) {
      console.log(`  ❌ Ошибка поиска через пресет: ${error}`);
    }

    console.log('\n');

    // Тест 3: Проверка изменений
    console.log('🔄 Тест 3: Проверка изменений');
    try {
      const changeResult = await parserService.checkPresetChanges(preset);
      
      console.log(`  ✅ Результат проверки изменений:`);
      console.log(`    📈 Изменения: ${changeResult.hasChanged ? 'ДА' : 'НЕТ'}`);
      console.log(`    📊 Количество: ${changeResult.oldCount} → ${changeResult.newCount}`);
      
      if (changeResult.hasChanged) {
        const diff = changeResult.newCount - changeResult.oldCount;
        console.log(`    🎉 Разница: ${diff > 0 ? '+' : ''}${diff} подарков`);
      }
    } catch (error) {
      console.log(`  ❌ Ошибка проверки изменений: ${error}`);
    }

    console.log('\n');

    // Тест 4: Статистика парсера
    console.log('📊 Тест 4: Статистика парсера');
    const stats = parserService.getStats();
    console.log(`  📈 Статистика:`);
    console.log(`    🔢 Всего запросов: ${stats.totalRequests}`);
    console.log(`    ✅ Успешных: ${stats.successfulRequests}`);
    console.log(`    ❌ Неудачных: ${stats.failedRequests}`);
    console.log(`    ⏱️ Среднее время ответа: ${stats.averageResponseTime.toFixed(2)}ms`);
    
    if (stats.lastRequestTime) {
      console.log(`    🕐 Последний запрос: ${stats.lastRequestTime.toLocaleString()}`);
    }

    console.log('\n');

    // Тест 5: Повторный поиск для проверки стабильности
    console.log('🔄 Тест 5: Повторный поиск для проверки стабильности');
    try {
      const startTime = Date.now();
      const repeatResult = await parserService.searchGifts(fullCriteria);
      const searchTime = Date.now() - startTime;

      console.log(`  ✅ Результат повторного поиска:`);
      console.log(`    📊 Найдено подарков: ${repeatResult.count}`);
      console.log(`    ⏱️ Время поиска: ${searchTime}ms`);
      
      // Сравнение с первым результатом
      const firstCount = firstResult?.count || 0;
      const secondCount = repeatResult.count;
      const isConsistent = firstCount === secondCount;
      
      console.log(`    🔄 Консистентность: ${isConsistent ? 'ДА' : 'НЕТ'}`);
      if (!isConsistent) {
        console.log(`    ⚠️ Разница в результатах: ${firstCount} vs ${secondCount}`);
      }
    } catch (error) {
      console.log(`  ❌ Ошибка повторного поиска: ${error}`);
    }

    console.log('\n🎉 Тестирование пресета завершено!');

  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
  } finally {
    await database.close();
    console.log('\n🔌 Соединение с базой данных закрыто');
  }
}

// Запуск теста, если файл выполняется напрямую
if (require.main === module) {
  testSpecificPreset().catch(console.error);
}

export { testSpecificPreset };
