import * as cron from 'node-cron';
import { Database } from '../database/database';
import { ParserService } from './parser-service';
import { TelegramBotService } from '../bot/telegram-bot';
import { MessageFormatter } from '../bot/message-formatter';
import { Preset } from '../types/database';

export interface MonitoringConfig {
  enabled: boolean;
  cronExpression: string;
  checkIntervalMinutes: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export interface MonitoringStats {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  totalChanges: number;
  lastCheck: Date | null;
  isRunning: boolean;
}

export class MonitoringService {
  private database: Database;
  private parserService: ParserService;
  private telegramBot: TelegramBotService;
  private config: MonitoringConfig;
  private cronJob: cron.ScheduledTask | null = null;
  private stats: MonitoringStats;
  private isInitialized: boolean = false;
  private statsMessageIds: Map<number, number> = new Map(); // userId -> messageId

  constructor(
    database: Database,
    parserService: ParserService,
    telegramBot: TelegramBotService,
    config: MonitoringConfig
  ) {
    this.database = database;
    this.parserService = parserService;
    this.telegramBot = telegramBot;
    this.config = config;
    this.stats = {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      totalChanges: 0,
      lastCheck: null,
      isRunning: false
    };
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.parserService.initialize();
      this.isInitialized = true;
      console.log('✅ MonitoringService инициализирован');
    } catch (error) {
      console.error('❌ Ошибка инициализации MonitoringService:', error);
      throw error;
    }
  }

  public async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('MonitoringService не инициализирован');
    }

    if (!this.config.enabled) {
      console.log('⚠️ Мониторинг отключен в конфигурации');
      return;
    }

    if (this.cronJob) {
      console.log('⚠️ Мониторинг уже запущен');
      return;
    }

    try {
      this.cronJob = cron.schedule(this.config.cronExpression, async () => {
        await this.performMonitoringCycle();
      });

      this.cronJob.start();
      this.stats.isRunning = true;
      console.log(`🔄 Мониторинг запущен по расписанию: ${this.config.cronExpression}`);
    } catch (error) {
      console.error('❌ Ошибка запуска мониторинга:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob.destroy();
      this.cronJob = null;
      this.stats.isRunning = false;
      console.log('⏹️ Мониторинг остановлен');
    }
    
    // Очищаем список статистических сообщений
    this.statsMessageIds.clear();
  }

  public async performMonitoringCycle(): Promise<void> {
    if (!this.isInitialized) {
      console.error('❌ MonitoringService не инициализирован');
      return;
    }

    console.log('🔄 Начало цикла мониторинга...');
    this.stats.totalChecks++;
    this.stats.lastCheck = new Date();

    try {
      // Получаем все активные пресеты
      const activePresets = await this.database.presets.getAllActive();
      
      if (activePresets.length === 0) {
        console.log('📭 Нет активных пресетов для мониторинга');
        this.stats.successfulChecks++;
        return;
      }

      console.log(`📋 Найдено ${activePresets.length} активных пресетов`);

      // Проверяем изменения для каждого пресета
      const changes = await this.checkAllPresetChanges(activePresets);
      
      // Отправляем уведомления о изменениях
      try {
        await this.sendChangeNotifications(changes);
        this.stats.successfulChecks++;
        console.log('✅ Цикл мониторинга завершен успешно');
      } catch (notificationError: any) {
        // Ошибки уведомлений не считаем критическими
        if (notificationError.response?.body?.error_code === 409) {
          console.log('⚠️ Конфликт с другим экземпляром бота при отправке уведомлений. Мониторинг продолжается.');
          this.stats.successfulChecks++; // Считаем успешным, так как проверка прошла
        } else {
          console.error('❌ Ошибка отправки уведомлений:', notificationError.message);
          this.stats.failedChecks++;
        }
      }

      // Обновляем статистические сообщения
      await this.updateStatsMessages();

    } catch (error: any) {
      this.stats.failedChecks++;
      console.error('❌ Критическая ошибка в цикле мониторинга:', error.message);
    }
  }

  private async checkAllPresetChanges(presets: Preset[]): Promise<Array<{
    preset: Preset;
    hasChanged: boolean;
    oldCount: number;
    newCount: number;
    result: any;
  }>> {
    const changes: Array<{
      preset: Preset;
      hasChanged: boolean;
      oldCount: number;
      newCount: number;
      result: any;
    }> = [];

    for (const preset of presets) {
      try {
        console.log(`  📋 Проверка пресета: ${preset.gift_name} (ID: ${preset.id})`);
        
        const changeResult = await this.parserService.checkPresetChanges(preset);
        changes.push({
          preset,
          ...changeResult
        });

        if (changeResult.hasChanged) {
          console.log(`  🎉 Изменение обнаружено: ${preset.gift_name} - ${changeResult.oldCount} → ${changeResult.newCount}`);
          this.stats.totalChanges++;
        }

        // Задержка между проверками
        await this.delay(this.config.retryDelayMs);

      } catch (error) {
        console.error(`❌ Ошибка проверки пресета ${preset.id}:`, error);
        // Продолжаем с другими пресетами
      }
    }

    return changes;
  }

  private async sendChangeNotifications(changes: Array<{
    preset: Preset;
    hasChanged: boolean;
    oldCount: number;
    newCount: number;
    result: any;
  }>): Promise<void> {
    const changedPresets = changes.filter(c => c.hasChanged);

    if (changedPresets.length === 0) {
      console.log('📭 Изменений не обнаружено');
      return;
    }

    console.log(`📢 Отправка уведомлений о ${changedPresets.length} изменениях...`);

    let successCount = 0;
    let errorCount = 0;

    for (const change of changedPresets) {
      try {
        await this.sendChangeNotification(change);
        successCount++;
        await this.delay(1000); // Задержка между уведомлениями
      } catch (error: any) {
        errorCount++;
        if (error.response?.body?.error_code === 409) {
          console.log(`⚠️ Пропущено уведомление для пресета ${change.preset.id} из-за конфликта с другим экземпляром бота`);
        } else {
          console.error(`❌ Ошибка отправки уведомления для пресета ${change.preset.id}:`, error.message);
        }
      }
    }

    console.log(`📊 Результат отправки уведомлений: ${successCount} успешно, ${errorCount} ошибок`);
  }

  private async sendChangeNotification(change: {
    preset: Preset;
    hasChanged: boolean;
    oldCount: number;
    newCount: number;
    result: any;
  }): Promise<void> {
    const { preset, oldCount, newCount } = change;
    
    try {
      // Получаем ссылку на последний подарок только при изменениях
      let giftLink: string | undefined;
      if (change.hasChanged) {
        try {
          console.log(`🔗 Получение ссылки на подарок для пресета "${preset.gift_name}"...`);
          giftLink = await this.parserService.getLastGiftLink(preset);
          if (giftLink) {
            console.log(`✅ Ссылка получена: ${giftLink}`);
          } else {
            console.log(`⚠️ Ссылка не найдена для пресета "${preset.gift_name}"`);
          }
        } catch (linkError) {
          console.log(`⚠️ Ошибка получения ссылки на подарок: ${linkError}`);
          // Продолжаем без ссылки
        }
      }
      
      // Формируем сообщение
      const message = this.formatChangeNotification(preset, oldCount, newCount, giftLink);
      
      // Отправляем уведомление пользователю
      await this.telegramBot.sendMessage(preset.user_id, message);
      
      console.log(`📤 Уведомление отправлено пользователю ${preset.user_id} о пресете "${preset.gift_name}"${giftLink ? ` со ссылкой` : ''}`);
    } catch (error: any) {
      if (error.response?.body?.error_code === 409) {
        console.log(`⚠️ Конфликт с другим экземпляром бота для пользователя ${preset.user_id}. Пропускаем уведомление.`);
      } else {
        console.error(`❌ Ошибка отправки уведомления пользователю ${preset.user_id}:`, error.message);
      }
      throw error; // Пробрасываем ошибку для обработки на верхнем уровне
    }
  }

  private formatChangeNotification(
    preset: Preset,
    oldCount: number,
    newCount: number,
    giftLink?: string
  ): string {
    const changeDirection = newCount > oldCount ? '📈' : '📉';
    const changeText = newCount > oldCount ? 'увеличилось' : 'уменьшилось';
    
    let message = `🎁 *Изменение количества подарков*\n\n`;
    message += `🎯 *Пресет:* ${preset.gift_name}\n`;
    
    if (preset.model) {
      message += `🤖 *Модель:* ${preset.model}\n`;
    }
    if (preset.background) {
      message += `🎨 *Фон:* ${preset.background}\n`;
    }
    if (preset.pattern) {
      message += `🔍 *Узор:* ${preset.pattern}\n`;
    }
    
    message += `\n${changeDirection} Количество ${changeText}: *${oldCount}* → *${newCount}*\n`;
    message += `📊 Разница: *${Math.abs(newCount - oldCount)}*\n`;
    
    // Добавляем ссылку на конкретный подарок, если есть
    if (giftLink) {
      message += `\n🎁 [Посмотреть последний подарок](${giftLink})`;
    }
    
    // Добавляем ссылку на поиск
    const searchUrl = this.generateSearchUrl(preset);
    message += `\n🔗 [Посмотреть все на peek.tg](${searchUrl})`;
    
    return message;
  }

  private generateSearchUrl(preset: Preset): string {
    const baseUrl = 'https://peek.tg/gifts';
    const params = new URLSearchParams();
    
    params.set('gift', preset.gift_name);
    if (preset.model) {
      params.set('model', preset.model);
    }
    if (preset.background) {
      params.set('background', preset.background);
    }
    if (preset.pattern) {
      params.set('pattern', preset.pattern);
    }
    
    return `${baseUrl}?${params.toString()}`;
  }

  public getStats(): MonitoringStats {
    return { ...this.stats };
  }

  // Сохранить ID сообщения со статистикой для пользователя
  public setStatsMessageId(userId: number, messageId: number): void {
    this.statsMessageIds.set(userId, messageId);
  }

  // Удалить ID сообщения со статистикой для пользователя
  public removeStatsMessageId(userId: number): void {
    this.statsMessageIds.delete(userId);
  }

  // Обновить статистические сообщения для всех пользователей
  private async updateStatsMessages(): Promise<void> {
    if (this.statsMessageIds.size === 0) {
      return;
    }

    const stats = this.getStats();
    const message = MessageFormatter.formatMonitoringStats(stats);

    for (const [userId, messageId] of this.statsMessageIds) {
      try {
        await this.telegramBot.editMessageText(userId, messageId, message, {
          parse_mode: 'HTML'
        });
      } catch (error) {
        // Если сообщение не найдено или пользователь заблокировал бота, удаляем из списка
        console.log(`⚠️ Не удалось обновить статистику для пользователя ${userId}, удаляем из списка`);
        this.statsMessageIds.delete(userId);
      }
    }
  }

  public updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Конфигурация мониторинга обновлена');
  }

  public async cleanup(): Promise<void> {
    await this.stop();
    if (this.isInitialized) {
      await this.parserService.close();
      this.isInitialized = false;
      console.log('🔌 MonitoringService закрыт');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
