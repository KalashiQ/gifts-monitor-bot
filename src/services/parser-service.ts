import { PeekTgParser } from '../parser/peek-tg-parser';
import { ParserConfig, SearchCriteria, SearchResult, ParserStats } from '../types/parser';
import { Database } from '../database/database';
import { Preset } from '../types/database';

export class ParserService {
  private parser: PeekTgParser;
  private database: Database;
  private isInitialized: boolean = false;

  constructor(config: ParserConfig, database: Database) {
    this.parser = new PeekTgParser(config);
    this.database = database;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.parser.initialize();
      this.isInitialized = true;
      console.log('✅ ParserService инициализирован');
    } catch (error) {
      console.error('❌ Ошибка инициализации ParserService:', error);
      throw error;
    }
  }

  public async close(): Promise<void> {
    if (this.isInitialized) {
      await this.parser.close();
      this.isInitialized = false;
      console.log('🔌 ParserService закрыт');
    }
  }

  public async searchGifts(criteria: SearchCriteria): Promise<SearchResult> {
    if (!this.isInitialized) {
      throw new Error('ParserService не инициализирован');
    }

    try {
      return await this.parser.searchGiftsWithRetry(criteria);
    } catch (error) {
      console.error('❌ Ошибка поиска подарков:', error);
      throw error;
    }
  }

  public async searchGiftsForPreset(preset: Preset): Promise<SearchResult> {
    const criteria: SearchCriteria = {
      gift_name: preset.gift_name,
      model: preset.model || undefined,
      background: preset.background || undefined,
      pattern: preset.pattern || undefined
    };

    return this.searchGifts(criteria);
  }

  public async searchAllActivePresets(): Promise<Array<{ preset: Preset; result: SearchResult }>> {
    if (!this.isInitialized) {
      throw new Error('ParserService не инициализирован');
    }

    try {
      const activePresets = await this.database.presets.getAllActive();
      const results: Array<{ preset: Preset; result: SearchResult }> = [];

      console.log(`🔍 Поиск для ${activePresets.length} активных пресетов...`);

      for (const preset of activePresets) {
        try {
          console.log(`  📋 Обработка пресета: ${preset.gift_name} (ID: ${preset.id})`);
          const result = await this.searchGiftsForPreset(preset);
          results.push({ preset, result });

          // Небольшая задержка между запросами
          await this.delay(1000);

        } catch (error) {
          console.error(`❌ Ошибка поиска для пресета ${preset.id}:`, error);
          // Продолжаем обработку других пресетов
        }
      }

      console.log(`✅ Обработано ${results.length} пресетов`);
      return results;

    } catch (error) {
      console.error('❌ Ошибка поиска всех пресетов:', error);
      throw error;
    }
  }

  public async checkPresetChanges(preset: Preset): Promise<{
    hasChanged: boolean;
    oldCount: number;
    newCount: number;
    result: SearchResult;
  }> {
    try {
      // Получаем последнюю запись для пресета
      const lastHistory = await this.database.monitoringHistory.getLatestByPresetId(preset.id);
      const oldCount = lastHistory?.count || 0;

      // Выполняем новый поиск
      const result = await this.searchGiftsForPreset(preset);
      const newCount = result.count;

      // Проверяем изменения
      const hasChanged = newCount !== oldCount;

      // Сохраняем новую запись в историю
      await this.database.monitoringHistory.create(preset.id, newCount, hasChanged);

      return {
        hasChanged,
        oldCount,
        newCount,
        result
      };

    } catch (error) {
      console.error(`❌ Ошибка проверки изменений для пресета ${preset.id}:`, error);
      throw error;
    }
  }

  public async checkAllPresetChanges(): Promise<Array<{
    preset: Preset;
    hasChanged: boolean;
    oldCount: number;
    newCount: number;
    result: SearchResult;
  }>> {
    if (!this.isInitialized) {
      throw new Error('ParserService не инициализирован');
    }

    try {
      const activePresets = await this.database.presets.getAllActive();
      const results: Array<{
        preset: Preset;
        hasChanged: boolean;
        oldCount: number;
        newCount: number;
        result: SearchResult;
      }> = [];

      console.log(`🔄 Проверка изменений для ${activePresets.length} активных пресетов...`);

      for (const preset of activePresets) {
        try {
          console.log(`  📋 Проверка пресета: ${preset.gift_name} (ID: ${preset.id})`);
          const changeResult = await this.checkPresetChanges(preset);
          results.push({
            preset,
            ...changeResult
          });

          if (changeResult.hasChanged) {
            console.log(`  🎉 Изменение обнаружено: ${preset.gift_name} - ${changeResult.oldCount} → ${changeResult.newCount}`);
          }

          // Небольшая задержка между запросами
          await this.delay(1000);

        } catch (error) {
          console.error(`❌ Ошибка проверки пресета ${preset.id}:`, error);
          // Продолжаем обработку других пресетов
        }
      }

      const changedCount = results.filter(r => r.hasChanged).length;
      console.log(`✅ Проверка завершена: ${changedCount} изменений из ${results.length} пресетов`);
      return results;

    } catch (error) {
      console.error('❌ Ошибка проверки всех пресетов:', error);
      throw error;
    }
  }

  public getStats(): ParserStats {
    return this.parser.getStats();
  }

  public resetStats(): void {
    this.parser.resetStats();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
