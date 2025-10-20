import { Preset, MonitoringHistory } from '../types/database';
import { PresetDisplayData } from '../types/bot';
import { MonitoringStats } from '../types/monitoring';

export class MessageFormatter {
  // Форматирование приветственного сообщения
  public static formatWelcomeMessage(userName: string): string {
    return `🎉 <b>Добро пожаловать, ${userName}!</b>

🤖 Я бот для мониторинга NFT подарков на peek.tg

<b>Что я умею:</b>
🎁 Создавать пресеты для поиска подарков
🔍 Проверять количество доступных подарков
📊 Показывать статистику изменений
⚙️ Настраивать автоматический мониторинг

<b>Начните с создания первого пресета!</b>

Выберите действие из меню ниже 👇`;
  }

  // Форматирование сообщения о помощи
  public static formatHelpMessage(): string {
    return `ℹ️ <b>Справка по использованию бота</b>

<b>Основные команды:</b>
🎁 <b>Добавить пресет</b> - создать новый пресет для мониторинга
📋 <b>Мои пресеты</b> - просмотр и управление пресетами
🔍 <b>Проверить сейчас</b> - запустить проверку всех активных пресетов
📊 <b>Статистика</b> - просмотр статистики мониторинга
⚙️ <b>Настройки</b> - настройка уведомлений и интервалов

<b>Создание пресета:</b>
1. Выберите "Добавить пресет"
2. Введите название подарка (обязательно)
3. При необходимости укажите модель, фон, узор
4. Пресет будет автоматически активирован

<b>Управление пресетами:</b>
• Включить/выключить мониторинг
• Редактировать параметры поиска
• Удалить ненужные пресеты
• Просматривать историю изменений

<b>Поддержка:</b>
Если у вас есть вопросы, обратитесь к администратору.`;
  }

  // Форматирование пресета для отображения
  public static formatPreset(preset: PresetDisplayData): string {
    const status = preset.is_active ? '🟢 Активен' : '🔴 Неактивен';
    const lastChecked = preset.last_checked 
      ? `\n📅 Последняя проверка: ${this.formatDate(preset.last_checked)}`
      : '';
    const lastCount = preset.last_count !== undefined 
      ? `\n🔢 Последний результат: ${preset.last_count} подарков`
      : '';

    return `🎁 <b>${preset.gift_name}</b>
${status}${lastChecked}${lastCount}

<b>Параметры поиска:</b>
${preset.model ? `🎭 Модель: ${preset.model}` : '🎭 Модель: не указана'}
${preset.background ? `🖼️ Фон: ${preset.background}` : '🖼️ Фон: не указан'}
${preset.pattern ? `🎨 Узор: ${preset.pattern}` : '🎨 Узор: не указан'}

📅 Создан: ${this.formatDate(preset.created_at)}`;
  }

  // Форматирование списка пресетов
  public static formatPresetsList(presets: PresetDisplayData[], page: number = 0, pageSize: number = 5, title?: string): string {
    if (presets.length === 0) {
      const header = title || 'Мои пресеты';
      return `📋 <b>${header}</b>

❌ У вас пока нет пресетов.

Создайте первый пресет, выбрав "Добавить пресет" в главном меню!`;
    }

    const totalPages = Math.ceil(presets.length / pageSize);
    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    const pagePresets = presets.slice(startIndex, endIndex);

    const header = title || 'Мои пресеты';
    let message = `📋 <b>${header}</b>\n`;
    message += `Страница ${page + 1} из ${totalPages}\n\n`;

    pagePresets.forEach((preset, index) => {
      const status = preset.is_active ? '🟢' : '🔴';
      const lastCount = preset.last_count !== undefined ? ` (${preset.last_count})` : '';
      message += `${startIndex + index + 1}. ${status} <b>${preset.gift_name}</b>${lastCount}\n`;
    });

    return message;
  }

  // Форматирование результата проверки
  public static formatCheckResult(preset: Preset, count: number, previousCount?: number): string {
    let message = `🔍 <b>Результат проверки</b>\n\n`;
    message += `🎁 <b>${preset.gift_name}</b>\n`;
    
    // Добавляем модель, если указана
    if (preset.model) {
      message += `🎨 <b>Модель:</b> ${preset.model}\n`;
    }
    
    // Добавляем фон, если указан
    if (preset.background) {
      message += `🖼️ <b>Фон:</b> ${preset.background}\n`;
    }
    
    // Добавляем узор, если указан
    if (preset.pattern) {
      message += `🎭 <b>Узор:</b> ${preset.pattern}\n`;
    }
    
    message += `🔢 Найдено подарков: <b>${count}</b>\n`;

    if (previousCount !== undefined) {
      const difference = count - previousCount;
      const changeIcon = difference > 0 ? '📈' : difference < 0 ? '📉' : '➡️';
      const changeText = difference > 0 
        ? `+${difference}` 
        : difference < 0 
        ? `${difference}` 
        : 'без изменений';
      
      message += `${changeIcon} Изменение: ${changeText}\n`;
    }

    message += `\n⏰ Проверено: ${this.formatDate(new Date())}`;

    return message;
  }

  // Форматирование статистики
  public static formatStats(stats: {
    totalPresets: number;
    activePresets: number;
    totalChecks: number;
    changesDetected: number;
    lastCheck?: Date;
  }): string {
    let message = `📊 <b>Статистика мониторинга</b>\n\n`;
    message += `📋 Всего пресетов: <b>${stats.totalPresets}</b>\n`;
    message += `🟢 Активных: <b>${stats.activePresets}</b>\n`;
    message += `🔍 Всего проверок: <b>${stats.totalChecks}</b>\n`;
    message += `📈 Изменений обнаружено: <b>${stats.changesDetected}</b>\n`;

    if (stats.lastCheck) {
      message += `\n⏰ Последняя проверка: ${this.formatDate(stats.lastCheck)}`;
    }

    return message;
  }

  // Форматирование истории мониторинга
  public static formatHistory(history: MonitoringHistory[]): string {
    if (history.length === 0) {
      return `📊 <b>История мониторинга</b>\n\n❌ История пуста`;
    }

    let message = `📊 <b>История мониторинга</b>\n\n`;
    
    history.slice(0, 10).forEach((record, index) => {
      const changeIcon = record.has_changed ? '📈' : '➡️';
      const date = this.formatDate(record.checked_at);
      message += `${index + 1}. ${changeIcon} <b>${record.count}</b> подарков (${date})\n`;
    });

    if (history.length > 10) {
      message += `\n... и еще ${history.length - 10} записей`;
    }

    return message;
  }

  // Форматирование ошибки
  public static formatError(error: string): string {
    return `❌ <b>Ошибка</b>\n\n${error}\n\nПопробуйте еще раз или обратитесь к администратору.`;
  }

  // Форматирование успешного действия
  public static formatSuccess(message: string): string {
    return `✅ <b>Успешно!</b>\n\n${message}`;
  }

  // Форматирование подтверждения
  public static formatConfirmation(action: string, details?: string): string {
    let message = `⚠️ <b>Подтверждение</b>\n\n`;
    message += `Вы действительно хотите ${action}?`;
    
    if (details) {
      message += `\n\n${details}`;
    }

    return message;
  }

  // Форматирование даты
  private static formatDate(date: Date): string {
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Форматирование уведомления об изменении
  public static formatChangeNotification(preset: Preset, oldCount: number, newCount: number): string {
    const difference = newCount - oldCount;
    const changeText = difference > 0 
      ? `увеличилось на ${difference}` 
      : `уменьшилось на ${Math.abs(difference)}`;

    return `🔔 <b>Изменение обнаружено!</b>\n\n` +
           `🎁 <b>${preset.gift_name}</b>\n` +
           `🔢 Количество подарков ${changeText}\n` +
           `📊 Было: ${oldCount} → Стало: ${newCount}\n\n` +
           `⏰ ${this.formatDate(new Date())}`;
  }

  // Форматирование сообщения о создании пресета
  public static formatPresetCreated(preset: Preset): string {
    return `✅ <b>Пресет создан!</b>\n\n` +
           `🎁 <b>${preset.gift_name}</b>\n` +
           `${preset.model ? `🎭 Модель: ${preset.model}\n` : ''}` +
           `${preset.background ? `🖼️ Фон: ${preset.background}\n` : ''}` +
           `${preset.pattern ? `🎨 Узор: ${preset.pattern}\n` : ''}` +
           `\n🟢 Мониторинг активирован`;
  }

  // Форматирование сообщения об обновлении пресета
  public static formatPresetUpdated(preset: Preset): string {
    return `✅ <b>Пресет обновлен!</b>\n\n` +
           `🎁 <b>${preset.gift_name}</b>\n` +
           `${preset.model ? `🎭 Модель: ${preset.model}\n` : ''}` +
           `${preset.background ? `🖼️ Фон: ${preset.background}\n` : ''}` +
           `${preset.pattern ? `🎨 Узор: ${preset.pattern}\n` : ''}` +
           `\n${preset.is_active ? '🟢' : '🔴'} Мониторинг ${preset.is_active ? 'активен' : 'остановлен'}`;
  }

  // Форматирование сообщения об удалении пресета
  public static formatPresetDeleted(presetName: string): string {
    return `✅ <b>Пресет удален</b>\n\n` +
           `🎁 <b>${presetName}</b> больше не отслеживается`;
  }

  // Форматирование статистики мониторинга
  public static formatMonitoringStats(stats: MonitoringStats): string {
    const status = stats.isRunning ? '🟢 Активен' : '🔴 Остановлен';
    const lastCheck = stats.lastCheck 
      ? this.formatDate(stats.lastCheck) 
      : 'Никогда';

    return `📊 <b>Статистика мониторинга</b>\n\n` +
           `🔄 <b>Статус:</b> ${status}\n` +
           `📈 <b>Всего проверок:</b> ${stats.totalChecks}\n` +
           `✅ <b>Успешных:</b> ${stats.successfulChecks}\n` +
           `❌ <b>Неудачных:</b> ${stats.failedChecks}\n` +
           `🎯 <b>Обнаружено изменений:</b> ${stats.totalChanges}\n` +
           `⏰ <b>Последняя проверка:</b> ${lastCheck}\n\n` +
           `📊 <b>Эффективность:</b> ${stats.totalChecks > 0 
             ? Math.round((stats.successfulChecks / stats.totalChecks) * 100) 
             : 0}%`;
  }
}
