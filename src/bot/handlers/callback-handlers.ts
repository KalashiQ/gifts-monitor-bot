import TelegramBot from 'node-telegram-bot-api';
import { PresetModel } from '../../database/models/preset.model';
import { ParserService } from '../../services/parser-service';
import { MonitoringService } from '../../services/monitoring-service';
import { MessageFormatter } from '../message-formatter';
import { InputValidator } from '../validators';
import { SessionManager } from '../session-manager';
import { UserState } from '../../types/bot';
import { 
  presetActions, 
  presetsListKeyboard, 
  editPresetKeyboard, 
  confirmDeleteKeyboard,
  checkResultsKeyboard,
  monitoringKeyboard,
  monitoringSettingsKeyboard,
  parseCallbackData 
} from '../keyboards';
import { mainMenu } from '../keyboards';

export class CallbackHandlers {
  private bot: TelegramBot;
  private presetModel: PresetModel;
  private parserService: ParserService;
  private monitoringService?: MonitoringService;
  private sessionManager: SessionManager;

  // Вспомогательная функция для преобразования Preset в PresetDisplayData
  private convertToPresetDisplayData(preset: any): any {
    return {
      ...preset,
      model: preset.model || undefined,
      background: preset.background || undefined,
      pattern: preset.pattern || undefined,
      last_checked: undefined,
      last_count: undefined
    };
  }

  constructor(
    bot: TelegramBot,
    presetModel: PresetModel,
    parserService: ParserService,
    sessionManager: SessionManager,
    monitoringService?: MonitoringService
  ) {
    this.bot = bot;
    this.presetModel = presetModel;
    this.parserService = parserService;
    this.monitoringService = monitoringService;
    this.sessionManager = sessionManager;
  }

  // Основной обработчик callback запросов
  public async handleCallbackQuery(query: TelegramBot.CallbackQuery): Promise<void> {
    const chatId = query.message?.chat.id;
    const messageId = query.message?.message_id;
    const data = query.data;

    if (!chatId || !messageId || !data) {
      return;
    }

    try {
      const callbackData = parseCallbackData(data);
      await this.processCallbackAction(chatId, messageId, callbackData, query);
    } catch (error) {
      console.error('Error handling callback:', error);
      await this.bot.answerCallbackQuery(query.id, { text: 'Произошла ошибка' });
    }
  }

  // Обработка различных действий callback
  private async processCallbackAction(
    chatId: number, 
    messageId: number, 
    data: any, 
    query: TelegramBot.CallbackQuery
  ): Promise<void> {
    switch (data.action) {
      case 'view_preset':
        await this.handleViewPreset(chatId, messageId, data.presetId);
        break;
      case 'toggle_preset':
        await this.handleTogglePreset(chatId, messageId, data.presetId, query);
        break;
      case 'edit_preset':
        await this.handleEditPreset(chatId, messageId, data.presetId);
        break;
      case 'delete_preset':
        await this.handleDeletePreset(chatId, messageId, data.presetId);
        break;
      case 'check_preset':
        await this.handleCheckPreset(chatId, messageId, data.presetId, query);
        break;
      case 'confirm_delete':
        await this.handleConfirmDelete(chatId, messageId, data.presetId, query);
        break;
      case 'cancel_delete':
        await this.handleCancelDelete(chatId, messageId, data.presetId);
        break;
      case 'back_to_menu':
        await this.handleBackToMenu(chatId, messageId);
        break;
      case 'start_monitoring':
        await this.handleStartMonitoring(chatId, messageId, query);
        break;
      case 'stop_monitoring':
        await this.handleStopMonitoring(chatId, messageId, query);
        break;
      case 'manual_check':
        await this.handleManualCheck(chatId, messageId, query);
        break;
      case 'monitoring_stats':
        await this.handleMonitoringStats(chatId, messageId);
        break;
      case 'monitoring_settings':
        await this.handleMonitoringSettings(chatId, messageId);
        break;
      case 'set_interval':
        await this.handleSetInterval(chatId, messageId, data.interval, query);
        break;
      case 'set_24_7':
        await this.handleSet24_7(chatId, messageId, query);
        break;
      case 'back_to_monitoring':
        await this.handleBackToMonitoring(chatId, messageId);
        break;
      case 'back_to_presets':
        await this.handleBackToPresets(chatId, messageId);
        break;
      case 'prev_page':
        await this.handlePrevPage(chatId, messageId, data.page);
        break;
      case 'next_page':
        await this.handleNextPage(chatId, messageId, data.page);
        break;
      case 'edit_gift':
        await this.handleEditGift(chatId, messageId, data.presetId);
        break;
      case 'edit_model':
        await this.handleEditModel(chatId, messageId, data.presetId);
        break;
      case 'edit_background':
        await this.handleEditBackground(chatId, messageId, data.presetId);
        break;
      case 'edit_pattern':
        await this.handleEditPattern(chatId, messageId, data.presetId);
        break;
      case 'search_presets':
        await this.handleSearchPresets(chatId, messageId);
        break;
      case 'filter_active':
        await this.handleFilterActive(chatId, messageId, data.filter);
        break;
      case 'filter_inactive':
        await this.handleFilterInactive(chatId, messageId, data.filter);
        break;
      case 'filter_all':
        await this.handleFilterAll(chatId, messageId, data.filter);
        break;
      case 'noop':
        await this.bot.answerCallbackQuery(query.id);
        break;
      default:
        await this.bot.answerCallbackQuery(query.id, { text: 'Неизвестное действие' });
    }
  }

  // Просмотр пресета
  private async handleViewPreset(chatId: number, messageId: number, presetId: number): Promise<void> {
    try {
      const validation = InputValidator.validatePresetId(presetId);
      if (!validation.isValid) {
        await this.bot.answerCallbackQuery('', { text: validation.error! });
        return;
      }

      const preset = await this.presetModel.getById(presetId);
      const presetMessage = MessageFormatter.formatPreset(this.convertToPresetDisplayData(preset));

      await this.bot.editMessageText(presetMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: presetActions(presetId, preset.is_active)
      });
    } catch (error) {
      console.error('Error viewing preset:', error);
      await this.bot.answerCallbackQuery('', { text: 'Ошибка при загрузке пресета' });
    }
  }

  // Переключение статуса пресета
  private async handleTogglePreset(
    chatId: number, 
    messageId: number, 
    presetId: number, 
    query: TelegramBot.CallbackQuery
  ): Promise<void> {
    try {
      const validation = InputValidator.validatePresetId(presetId);
      if (!validation.isValid) {
        await this.bot.answerCallbackQuery(query.id, { text: validation.error! });
        return;
      }

      const preset = await this.presetModel.toggleActive(presetId);
      const presetMessage = MessageFormatter.formatPreset(this.convertToPresetDisplayData(preset));

      await this.bot.editMessageText(presetMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: presetActions(presetId, preset.is_active)
      });

      const statusText = preset.is_active ? 'активирован' : 'остановлен';
      await this.bot.answerCallbackQuery(query.id, { text: `Пресет ${statusText}` });
    } catch (error) {
      console.error('Error toggling preset:', error);
      await this.bot.answerCallbackQuery(query.id, { text: 'Ошибка при изменении статуса' });
    }
  }

  // Редактирование пресета
  private async handleEditPreset(chatId: number, messageId: number, presetId: number): Promise<void> {
    try {
      const validation = InputValidator.validatePresetId(presetId);
      if (!validation.isValid) {
        await this.bot.answerCallbackQuery('', { text: validation.error! });
        return;
      }

      const preset = await this.presetModel.getById(presetId);
      const editMessage = 
        `✏️ <b>Редактирование пресета</b>\n\n` +
        `🎁 <b>${preset.gift_name}</b>\n\n` +
        `Выберите, что хотите изменить:`;

      await this.bot.editMessageText(editMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: editPresetKeyboard(presetId)
      });
    } catch (error) {
      console.error('Error editing preset:', error);
      await this.bot.answerCallbackQuery('', { text: 'Ошибка при загрузке пресета' });
    }
  }

  // Удаление пресета
  private async handleDeletePreset(chatId: number, messageId: number, presetId: number): Promise<void> {
    try {
      const validation = InputValidator.validatePresetId(presetId);
      if (!validation.isValid) {
        await this.bot.answerCallbackQuery('', { text: validation.error! });
        return;
      }

      const preset = await this.presetModel.getById(presetId);
      const confirmMessage = MessageFormatter.formatConfirmation(
        'удалить этот пресет',
        `🎁 <b>${preset.gift_name}</b>\n\nЭто действие нельзя отменить!`
      );

      await this.bot.editMessageText(confirmMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: confirmDeleteKeyboard(presetId)
      });
    } catch (error) {
      console.error('Error deleting preset:', error);
      await this.bot.answerCallbackQuery('', { text: 'Ошибка при загрузке пресета' });
    }
  }

  // Подтверждение удаления
  private async handleConfirmDelete(
    chatId: number, 
    messageId: number, 
    presetId: number, 
    query: TelegramBot.CallbackQuery
  ): Promise<void> {
    try {
      const validation = InputValidator.validatePresetId(presetId);
      if (!validation.isValid) {
        await this.bot.answerCallbackQuery(query.id, { text: validation.error! });
        return;
      }

      const preset = await this.presetModel.getById(presetId);
      await this.presetModel.delete(presetId);

      const successMessage = MessageFormatter.formatPresetDeleted(preset.gift_name);
      await this.bot.editMessageText(successMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '⬅️ Назад к пресетам', callback_data: JSON.stringify({ action: 'back_to_presets' }) }]] }
      });

      await this.bot.answerCallbackQuery(query.id, { text: 'Пресет удален' });
    } catch (error) {
      console.error('Error confirming delete:', error);
      await this.bot.answerCallbackQuery(query.id, { text: 'Ошибка при удалении пресета' });
    }
  }

  // Отмена удаления
  private async handleCancelDelete(chatId: number, messageId: number, presetId: number): Promise<void> {
    try {
      const preset = await this.presetModel.getById(presetId);
      const presetMessage = MessageFormatter.formatPreset(this.convertToPresetDisplayData(preset));

      await this.bot.editMessageText(presetMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: presetActions(presetId, preset.is_active)
      });
    } catch (error) {
      console.error('Error canceling delete:', error);
    }
  }

  // Проверка пресета
  private async handleCheckPreset(
    chatId: number, 
    messageId: number, 
    presetId: number, 
    query: TelegramBot.CallbackQuery
  ): Promise<void> {
    try {
      const validation = InputValidator.validatePresetId(presetId);
      if (!validation.isValid) {
        await this.bot.answerCallbackQuery(query.id, { text: validation.error! });
        return;
      }

      const preset = await this.presetModel.getById(presetId);
      
      // Показываем сообщение о проверке
      await this.bot.editMessageText(
        `🔍 Проверяю пресет "${preset.gift_name}"...\n\n⏳ Пожалуйста, подождите...`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML'
        }
      );

      // Выполняем проверку
      const result = await this.parserService.searchGifts({
        gift_name: preset.gift_name,
        model: preset.model || undefined,
        background: preset.background || undefined,
        pattern: preset.pattern || undefined
      });

      const resultMessage = MessageFormatter.formatCheckResult(preset, result.count);
      await this.bot.editMessageText(resultMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: checkResultsKeyboard(presetId)
      });

      await this.bot.answerCallbackQuery(query.id, { text: 'Проверка завершена' });
    } catch (error) {
      console.error('Error checking preset:', error);
      await this.bot.editMessageText(
        `❌ Ошибка при проверке пресета "${presetId}"`,
        {
          chat_id: chatId,
          message_id: messageId
        }
      );
      await this.bot.answerCallbackQuery(query.id, { text: 'Ошибка при проверке' });
    }
  }

  // Возврат в главное меню
  private async handleBackToMenu(chatId: number, _messageId: number): Promise<void> {
    await this.bot.sendMessage(chatId, '🏠 Главное меню', {
      reply_markup: mainMenu
    });
  }

  // Возврат к списку пресетов
  private async handleBackToPresets(chatId: number, messageId: number): Promise<void> {
    try {
      const presets = await this.presetModel.getByUserId(chatId);
      const displayData = presets.map(preset => this.convertToPresetDisplayData(preset));

      const message = MessageFormatter.formatPresetsList(displayData);
      const keyboard = presetsListKeyboard(displayData);

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    } catch (error) {
      console.error('Error going back to presets:', error);
      await this.bot.editMessageText(
        '❌ Ошибка при загрузке пресетов',
        {
          chat_id: chatId,
          message_id: messageId
        }
      );
    }
  }

  // Предыдущая страница
  private async handlePrevPage(chatId: number, messageId: number, page: number): Promise<void> {
    try {
      const presets = await this.presetModel.getByUserId(chatId);
      const displayData = presets.map(preset => this.convertToPresetDisplayData(preset));

      const message = MessageFormatter.formatPresetsList(displayData, page);
      const keyboard = presetsListKeyboard(displayData, page);

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    } catch (error) {
      console.error('Error handling prev page:', error);
    }
  }

  // Следующая страница
  private async handleNextPage(chatId: number, messageId: number, page: number): Promise<void> {
    try {
      const presets = await this.presetModel.getByUserId(chatId);
      const displayData = presets.map(preset => this.convertToPresetDisplayData(preset));

      const message = MessageFormatter.formatPresetsList(displayData, page);
      const keyboard = presetsListKeyboard(displayData, page);

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    } catch (error) {
      console.error('Error handling next page:', error);
    }
  }

  // Редактирование названия подарка
  private async handleEditGift(chatId: number, messageId: number, presetId: number): Promise<void> {
    try {
      const preset = await this.presetModel.getById(presetId);
      const editMessage = 
        `✏️ <b>Редактирование названия подарка</b>\n\n` +
        `Текущее название: <b>${preset.gift_name}</b>\n\n` +
        `Введите новое название подарка:`;

      await this.bot.editMessageText(editMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '❌ Отмена', callback_data: JSON.stringify({ action: 'edit_preset', presetId }) }]] }
      });

      // Устанавливаем состояние для редактирования
      this.sessionManager.updateState(chatId, UserState.EDITING_PRESET_GIFT);
      this.sessionManager.setData(chatId, 'editing_preset_id', presetId);
    } catch (error) {
      console.error('Error editing gift:', error);
    }
  }

  // Редактирование модели
  private async handleEditModel(chatId: number, messageId: number, presetId: number): Promise<void> {
    try {
      const preset = await this.presetModel.getById(presetId);
      const currentModel = preset.model || 'не указана';
      const editMessage = 
        `✏️ <b>Редактирование модели</b>\n\n` +
        `Текущая модель: <b>${currentModel}</b>\n\n` +
        `Введите новую модель или "удалить" для очистки:`;

      await this.bot.editMessageText(editMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '❌ Отмена', callback_data: JSON.stringify({ action: 'edit_preset', presetId }) }]] }
      });

      this.sessionManager.updateState(chatId, UserState.EDITING_PRESET_MODEL);
      this.sessionManager.setData(chatId, 'editing_preset_id', presetId);
    } catch (error) {
      console.error('Error editing model:', error);
    }
  }

  // Редактирование фона
  private async handleEditBackground(chatId: number, messageId: number, presetId: number): Promise<void> {
    try {
      const preset = await this.presetModel.getById(presetId);
      const currentBackground = preset.background || 'не указан';
      const editMessage = 
        `✏️ <b>Редактирование фона</b>\n\n` +
        `Текущий фон: <b>${currentBackground}</b>\n\n` +
        `Введите новый фон или "удалить" для очистки:`;

      await this.bot.editMessageText(editMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '❌ Отмена', callback_data: JSON.stringify({ action: 'edit_preset', presetId }) }]] }
      });

      this.sessionManager.updateState(chatId, UserState.EDITING_PRESET_BACKGROUND);
      this.sessionManager.setData(chatId, 'editing_preset_id', presetId);
    } catch (error) {
      console.error('Error editing background:', error);
    }
  }

  // Редактирование узора
  private async handleEditPattern(chatId: number, messageId: number, presetId: number): Promise<void> {
    try {
      const preset = await this.presetModel.getById(presetId);
      const currentPattern = preset.pattern || 'не указан';
      const editMessage = 
        `✏️ <b>Редактирование узора</b>\n\n` +
        `Текущий узор: <b>${currentPattern}</b>\n\n` +
        `Введите новый узор или "удалить" для очистки:`;

      await this.bot.editMessageText(editMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '❌ Отмена', callback_data: JSON.stringify({ action: 'edit_preset', presetId }) }]] }
      });

      this.sessionManager.updateState(chatId, UserState.EDITING_PRESET_PATTERN);
      this.sessionManager.setData(chatId, 'editing_preset_id', presetId);
    } catch (error) {
      console.error('Error editing pattern:', error);
    }
  }

  // Поиск пресетов
  private async handleSearchPresets(chatId: number, messageId: number): Promise<void> {
    const searchMessage = 
      `🔍 <b>Поиск пресетов</b>\n\n` +
      `Введите название подарка для поиска:`;

    await this.bot.editMessageText(searchMessage, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '❌ Отмена', callback_data: JSON.stringify({ action: 'back_to_presets' }) }]] }
    });
  }

  // Фильтр активных пресетов
  private async handleFilterActive(chatId: number, messageId: number, _filter: any): Promise<void> {
    try {
      const presets = await this.presetModel.getActiveByUserId(chatId);
      const displayData = presets.map(preset => this.convertToPresetDisplayData(preset));

      const message = MessageFormatter.formatPresetsList(displayData, 0, 5, 'Активные пресеты');
      const keyboard = presetsListKeyboard(displayData, 0, 5);

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    } catch (error) {
      console.error('Error filtering active presets:', error);
    }
  }

  // Фильтр неактивных пресетов
  private async handleFilterInactive(chatId: number, messageId: number, _filter: any): Promise<void> {
    try {
      const allPresets = await this.presetModel.getByUserId(chatId);
      const presets = allPresets.filter(p => !p.is_active);
      const displayData = presets.map(preset => this.convertToPresetDisplayData(preset));

      const message = MessageFormatter.formatPresetsList(displayData, 0, 5, 'Неактивные пресеты');
      const keyboard = presetsListKeyboard(displayData, 0, 5);

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    } catch (error) {
      console.error('Error filtering inactive presets:', error);
    }
  }

  // Показать все пресеты
  private async handleFilterAll(chatId: number, messageId: number, _filter: any): Promise<void> {
    try {
      const presets = await this.presetModel.getByUserId(chatId);
      const displayData = presets.map(preset => this.convertToPresetDisplayData(preset));

      const message = MessageFormatter.formatPresetsList(displayData, 0, 5, 'Все пресеты');
      const keyboard = presetsListKeyboard(displayData, 0, 5);

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    } catch (error) {
      console.error('Error showing all presets:', error);
    }
  }

  // Обработчики мониторинга
  private async handleStartMonitoring(chatId: number, messageId: number, query: TelegramBot.CallbackQuery): Promise<void> {
    if (!this.monitoringService) {
      await this.bot.answerCallbackQuery(query.id, { text: '❌ Сервис мониторинга недоступен' });
      return;
    }

    try {
      await this.monitoringService.start();
      await this.bot.answerCallbackQuery(query.id, { text: '✅ Мониторинг запущен' });
      
      const stats = this.monitoringService.getStats();
      const message = `🔄 *Мониторинг запущен*\n\n` +
                     `📊 *Статус:* 🟢 Активен\n` +
                     `📈 *Всего проверок:* ${stats.totalChecks}\n` +
                     `✅ *Успешных:* ${stats.successfulChecks}\n` +
                     `❌ *Неудачных:* ${stats.failedChecks}\n` +
                     `🎯 *Обнаружено изменений:* ${stats.totalChanges}\n\n` +
                     `Мониторинг будет проверять ваши пресеты каждую минуту и отправлять уведомления об изменениях.`;

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: monitoringKeyboard
      });
    } catch (error) {
      console.error('Error starting monitoring:', error);
      await this.bot.answerCallbackQuery(query.id, { text: '❌ Ошибка запуска мониторинга' });
    }
  }

  private async handleStopMonitoring(chatId: number, messageId: number, query: TelegramBot.CallbackQuery): Promise<void> {
    if (!this.monitoringService) {
      await this.bot.answerCallbackQuery(query.id, { text: '❌ Сервис мониторинга недоступен' });
      return;
    }

    try {
      await this.monitoringService.stop();
      await this.bot.answerCallbackQuery(query.id, { text: '⏹️ Мониторинг остановлен' });
      
      const stats = this.monitoringService.getStats();
      const message = `⏹️ *Мониторинг остановлен*\n\n` +
                     `📊 *Статус:* 🔴 Остановлен\n` +
                     `📈 *Всего проверок:* ${stats.totalChecks}\n` +
                     `✅ *Успешных:* ${stats.successfulChecks}\n` +
                     `❌ *Неудачных:* ${stats.failedChecks}\n` +
                     `🎯 *Обнаружено изменений:* ${stats.totalChanges}\n\n` +
                     `Мониторинг остановлен. Для возобновления нажмите "Запустить мониторинг".`;

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: monitoringKeyboard
      });
    } catch (error) {
      console.error('Error stopping monitoring:', error);
      await this.bot.answerCallbackQuery(query.id, { text: '❌ Ошибка остановки мониторинга' });
    }
  }

  private async handleManualCheck(chatId: number, messageId: number, query: TelegramBot.CallbackQuery): Promise<void> {
    if (!this.monitoringService) {
      await this.bot.answerCallbackQuery(query.id, { text: '❌ Сервис мониторинга недоступен' });
      return;
    }

    try {
      await this.bot.answerCallbackQuery(query.id, { text: '🔄 Запуск ручной проверки...' });
      
      const message = `🔄 *Ручная проверка*\n\n` +
                     `Проверяем все активные пресеты...\n` +
                     `Это может занять несколько минут.`;

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML'
      });

      await this.monitoringService.performMonitoringCycle();
      
      const stats = this.monitoringService.getStats();
      const resultMessage = `✅ *Ручная проверка завершена*\n\n` +
                           `📊 *Статус:* ${stats.isRunning ? '🟢 Активен' : '🔴 Остановлен'}\n` +
                           `📈 *Всего проверок:* ${stats.totalChecks}\n` +
                           `✅ *Успешных:* ${stats.successfulChecks}\n` +
                           `❌ *Неудачных:* ${stats.failedChecks}\n` +
                           `🎯 *Обнаружено изменений:* ${stats.totalChanges}\n` +
                           `⏰ *Последняя проверка:* ${stats.lastCheck ? stats.lastCheck.toLocaleString('ru-RU') : 'Никогда'}`;

      await this.bot.editMessageText(resultMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: monitoringKeyboard
      });
    } catch (error) {
      console.error('Error performing manual check:', error);
      await this.bot.answerCallbackQuery(query.id, { text: '❌ Ошибка ручной проверки' });
    }
  }

  private async handleMonitoringStats(chatId: number, messageId: number): Promise<void> {
    if (!this.monitoringService) {
      await this.bot.editMessageText('❌ Сервис мониторинга недоступен', {
        chat_id: chatId,
        message_id: messageId
      });
      return;
    }

    try {
      const stats = this.monitoringService.getStats();
      const message = MessageFormatter.formatMonitoringStats(stats);

      // Сохраняем ID сообщения для автоматического обновления
      this.monitoringService.setStatsMessageId(chatId, messageId);

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: monitoringKeyboard
      });
    } catch (error) {
      console.error('Error showing monitoring stats:', error);
    }
  }

  private async handleMonitoringSettings(chatId: number, messageId: number): Promise<void> {
    const message = `⚙️ *Настройки мониторинга*\n\n` +
                   `Выберите интервал проверки:\n\n` +
                   `⏰ *Каждую минуту* - максимальная частота\n` +
                   `⏰ *Каждые 5 минут* - оптимальная частота\n` +
                   `⏰ *Каждые 15 минут* - экономичная частота\n` +
                   `⏰ *Каждый час* - минимальная частота\n` +
                   `🔄 *Круглосуточный* - каждую минуту 24/7`;

    await this.bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML',
      reply_markup: monitoringSettingsKeyboard
    });
  }

  private async handleSetInterval(chatId: number, messageId: number, interval: string, query: TelegramBot.CallbackQuery): Promise<void> {
    if (!this.monitoringService) {
      await this.bot.answerCallbackQuery(query.id, { text: '❌ Сервис мониторинга недоступен' });
      return;
    }

    try {
      const cronExpression = `*/${interval} * * * *`;
      this.monitoringService.updateConfig({ cronExpression });
      
      await this.bot.answerCallbackQuery(query.id, { text: `✅ Интервал установлен: каждые ${interval} минут` });
      
      const message = `⚙️ *Настройки мониторинга*\n\n` +
                     `✅ *Интервал установлен:* каждые ${interval} минут\n` +
                     `🕐 *Cron выражение:* \`${cronExpression}\`\n\n` +
                     `Мониторинг будет проверять ваши пресеты с выбранной частотой.`;

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: monitoringSettingsKeyboard
      });
    } catch (error) {
      console.error('Error setting interval:', error);
      await this.bot.answerCallbackQuery(query.id, { text: '❌ Ошибка установки интервала' });
    }
  }

  private async handleSet24_7(chatId: number, messageId: number, query: TelegramBot.CallbackQuery): Promise<void> {
    if (!this.monitoringService) {
      await this.bot.answerCallbackQuery(query.id, { text: '❌ Сервис мониторинга недоступен' });
      return;
    }

    try {
      const cronExpression = '*/1 * * * *'; // Каждую минуту
      this.monitoringService.updateConfig({ cronExpression });
      
      await this.bot.answerCallbackQuery(query.id, { text: '✅ Круглосуточный мониторинг активирован' });
      
      const message = `🔄 *Круглосуточный мониторинг*\n\n` +
                     `✅ *Режим:* 24/7 (каждую минуту)\n` +
                     `🕐 *Cron выражение:* \`${cronExpression}\`\n\n` +
                     `Мониторинг будет работать круглосуточно и проверять ваши пресеты каждую минуту.`;

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: monitoringSettingsKeyboard
      });
    } catch (error) {
      console.error('Error setting 24/7 monitoring:', error);
      await this.bot.answerCallbackQuery(query.id, { text: '❌ Ошибка активации круглосуточного мониторинга' });
    }
  }

  private async handleBackToMonitoring(chatId: number, messageId: number): Promise<void> {
    if (!this.monitoringService) {
      await this.bot.editMessageText('❌ Сервис мониторинга недоступен', {
        chat_id: chatId,
        message_id: messageId
      });
      return;
    }

    try {
      const stats = this.monitoringService.getStats();
      const message = `🔄 *Управление мониторингом*\n\n` +
                     `📊 *Статус:* ${stats.isRunning ? '🟢 Активен' : '🔴 Остановлен'}\n` +
                     `📈 *Всего проверок:* ${stats.totalChecks}\n` +
                     `✅ *Успешных:* ${stats.successfulChecks}\n` +
                     `❌ *Неудачных:* ${stats.failedChecks}\n` +
                     `🎯 *Обнаружено изменений:* ${stats.totalChanges}\n` +
                     `⏰ *Последняя проверка:* ${stats.lastCheck ? stats.lastCheck.toLocaleString('ru-RU') : 'Никогда'}\n\n` +
                     `Выберите действие:`;

      // Сохраняем ID сообщения для автоматического обновления
      this.monitoringService.setStatsMessageId(chatId, messageId);

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: monitoringKeyboard
      });
    } catch (error) {
      console.error('Error showing monitoring menu:', error);
    }
  }
}
