import { Database } from '../database/database';
import { CreatePresetData } from '../types/database';

async function databaseExample(): Promise<void> {
  console.log('🚀 Запуск примера работы с базой данных...\n');

  // Инициализация базы данных
  const database = new Database({ path: './data/example.db' });
  
  try {
    await database.initialize();
    console.log('✅ База данных инициализирована\n');

    // Создание пресетов
    const presetsData: CreatePresetData[] = [
      {
        user_id: 123,
        gift_name: 'Spring Basket',
        model: 'Ritual Goat',
        background: 'Black',
        pattern: 'All patterns',
        is_active: true
      },
      {
        user_id: 123,
        gift_name: 'Summer Gift',
        model: 'Magic Cat',
        background: 'White',
        pattern: 'Stars',
        is_active: true
      },
      {
        user_id: 456,
        gift_name: 'Autumn Present',
        model: 'Forest Spirit',
        background: 'Green',
        pattern: 'Leaves',
        is_active: false
      }
    ];

    console.log('📝 Создание пресетов...');
    const createdPresets = [];
    for (const presetData of presetsData) {
      const preset = await database.presets.create(presetData);
      createdPresets.push(preset);
      console.log(`  ✅ Создан пресет: ${preset.gift_name} (ID: ${preset.id})`);
    }

    // Создание истории мониторинга
    console.log('\n📊 Создание истории мониторинга...');
    for (const preset of createdPresets) {
      const count = Math.floor(Math.random() * 10) + 1;
      const hasChanged = Math.random() > 0.5;
      
      await database.monitoringHistory.create(preset.id, count, hasChanged);
      console.log(`  ✅ Запись для "${preset.gift_name}": ${count} подарков, изменений: ${hasChanged ? 'да' : 'нет'}`);
    }

    // Получение данных
    console.log('\n📋 Получение данных...');
    
    // Все пресеты пользователя 123
    const user123Presets = await database.presets.getByUserId(123);
    console.log(`  👤 Пресеты пользователя 123: ${user123Presets.length} шт.`);
    
    // Активные пресеты
    const activePresets = await database.presets.getAllActive();
    console.log(`  🔥 Активные пресеты: ${activePresets.length} шт.`);
    
    // Записи с изменениями
    const changedRecords = await database.monitoringHistory.getChangedRecords();
    console.log(`  📈 Записей с изменениями: ${changedRecords.length} шт.`);

    // Статистика для первого пресета
    if (createdPresets.length > 0) {
      const stats = await database.monitoringHistory.getStatisticsByPresetId(createdPresets[0].id);
      console.log(`\n📊 Статистика для "${createdPresets[0].gift_name}":`);
      console.log(`  • Всего проверок: ${stats.totalChecks}`);
      console.log(`  • Изменений: ${stats.totalChanges}`);
      console.log(`  • Среднее количество: ${stats.averageCount.toFixed(2)}`);
      console.log(`  • Минимум: ${stats.minCount}`);
      console.log(`  • Максимум: ${stats.maxCount}`);
    }

    // Поиск по критериям
    console.log('\n🔍 Поиск по критериям...');
    const searchResults = await database.presets.findByCriteria({
      gift_name: 'Spring Basket',
      model: 'Ritual Goat'
    });
    console.log(`  🎯 Найдено пресетов: ${searchResults.length} шт.`);

    // Обновление пресета
    console.log('\n✏️ Обновление пресета...');
    if (createdPresets.length > 0) {
      const updatedPreset = await database.presets.update(createdPresets[0].id, {
        gift_name: 'Updated Spring Basket',
        is_active: false
      });
      console.log(`  ✅ Обновлен пресет: ${updatedPreset.gift_name} (активен: ${updatedPreset.is_active})`);
    }

    // Подсчет пресетов
    const totalCount = await database.presets.countByUserId(123);
    const activeCount = await database.presets.countActiveByUserId(123);
    console.log(`\n📊 Статистика пользователя 123:`);
    console.log(`  • Всего пресетов: ${totalCount}`);
    console.log(`  • Активных: ${activeCount}`);

    console.log('\n🎉 Пример работы с базой данных завершен!');

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await database.close();
    console.log('\n🔌 Соединение с базой данных закрыто');
  }
}

// Запуск примера, если файл выполняется напрямую
if (require.main === module) {
  databaseExample().catch(console.error);
}

export { databaseExample };
