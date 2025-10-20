import TelegramBot from 'node-telegram-bot-api';
import { SessionManager } from '../session-manager';
import { UserState } from '../../types/bot';
import { PresetModel } from '../../database/models/preset.model';
import { ParserService } from '../../services/parser-service';
import { MessageFormatter } from '../message-formatter';
import { InputValidator } from '../validators';
import { mainMenu, cancelKeyboard, skipKeyboard } from '../keyboards';

export class CommandHandlers {
  private bot: TelegramBot;
  private sessionManager: SessionManager;
  private presetModel: PresetModel;
  private parserService: ParserService;

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
    sessionManager: SessionManager,
    presetModel: PresetModel,
    parserService: ParserService
  ) {
    this.bot = bot;
    this.sessionManager = sessionManager;
    this.presetModel = presetModel;
    this.parserService = parserService;
  }

  // Обработчик команды /start
  public async handleStart(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userName = msg.from?.first_name || 'Пользователь';

    this.sessionManager.resetSession(chatId);
    
    const welcomeMessage = MessageFormatter.formatWelcomeMessage(userName);
    await this.bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'HTML',
      reply_markup: mainMenu
    });
  }

  // Обработчик команды /help
  public async handleHelp(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const helpMessage = MessageFormatter.formatHelpMessage();
    
    await this.bot.sendMessage(chatId, helpMessage, {
      parse_mode: 'HTML',
      reply_markup: mainMenu
    });
  }

  // Обработчик команды /menu
  public async handleMenu(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    this.sessionManager.resetSession(chatId);
    
    await this.bot.sendMessage(chatId, '🏠 Главное меню', {
      reply_markup: mainMenu
    });
  }

  // Обработчик команды /stats
  public async handleStats(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    
    try {
      const presets = await this.presetModel.getByUserId(chatId);
      const activePresets = presets.filter(p => p.is_active);
      
      // Получаем статистику из истории мониторинга
      const stats = {
        totalPresets: presets.length,
        activePresets: activePresets.length,
        totalChecks: 0, // TODO: реализовать подсчет из истории
        changesDetected: 0, // TODO: реализовать подсчет изменений
        lastCheck: undefined as Date | undefined
      };

      const statsMessage = MessageFormatter.formatStats(stats);
      await this.bot.sendMessage(chatId, statsMessage, {
        parse_mode: 'HTML',
        reply_markup: mainMenu
      });
    } catch (error) {
      console.error('Error getting stats:', error);
      await this.bot.sendMessage(chatId, MessageFormatter.formatError('Не удалось получить статистику'));
    }
  }

  // Обработчик текстовых сообщений
  public async handleTextMessage(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    const session = this.sessionManager.getSession(chatId);

    // Проверяем на команды главного меню
    if (text === '🎁 Добавить пресет') {
      await this.handleAddPreset(chatId);
      return;
    }

    if (text === '📋 Мои пресеты') {
      await this.handleMyPresets(chatId);
      return;
    }

    if (text === '🔍 Проверить сейчас') {
      await this.handleCheckNow(chatId);
      return;
    }

    if (text === '📊 Статистика') {
      await this.handleStats(msg);
      return;
    }

    if (text === '⚙️ Настройки') {
      await this.handleSettings(chatId);
      return;
    }

    if (text === 'ℹ️ Помощь') {
      await this.handleHelp(msg);
      return;
    }

    // Обработка состояний пользователя
    switch (session.state) {
      case UserState.ADDING_PRESET_GIFT:
        await this.handleGiftNameInput(chatId, text);
        break;
      case UserState.ADDING_PRESET_MODEL:
        await this.handleModelInput(chatId, text);
        break;
      case UserState.ADDING_PRESET_BACKGROUND:
        await this.handleBackgroundInput(chatId, text);
        break;
      case UserState.ADDING_PRESET_PATTERN:
        await this.handlePatternInput(chatId, text);
        break;
      case UserState.EDITING_PRESET:
        await this.handlePresetEdit(chatId, text);
        break;
      default:
        await this.handleUnknownCommand(chatId, text);
    }
  }

  // Обработчик добавления пресета
  private async handleAddPreset(chatId: number): Promise<void> {
    this.sessionManager.updateState(chatId, UserState.ADDING_PRESET_GIFT);
    this.sessionManager.clearData(chatId);

    await this.bot.sendMessage(chatId, 
      '🎁 <b>Создание нового пресета</b>\n\n' +
      'Введите название подарка (обязательно):',
      {
        parse_mode: 'HTML',
        reply_markup: cancelKeyboard
      }
    );
  }

  // Обработчик ввода названия подарка
  private async handleGiftNameInput(chatId: number, text: string): Promise<void> {
    const validation = InputValidator.validateGiftName(text);
    if (!validation.isValid) {
      await this.bot.sendMessage(chatId, validation.error!, {
        reply_markup: cancelKeyboard
      });
      return;
    }

    this.sessionManager.setData(chatId, 'gift_name', text.trim());
    this.sessionManager.updateState(chatId, UserState.ADDING_PRESET_MODEL);

    await this.bot.sendMessage(chatId,
      '🎭 <b>Модель подарка</b>\n\n' +
      'Введите модель подарка или нажмите "Пропустить":',
      {
        parse_mode: 'HTML',
        reply_markup: skipKeyboard
      }
    );
  }

  // Обработчик ввода модели
  private async handleModelInput(chatId: number, text: string): Promise<void> {
    if (text === '⏭️ Пропустить') {
      this.sessionManager.setData(chatId, 'model', null);
    } else {
      const validation = InputValidator.validateModel(text);
      if (!validation.isValid) {
        await this.bot.sendMessage(chatId, validation.error!, {
          reply_markup: skipKeyboard
        });
        return;
      }
      this.sessionManager.setData(chatId, 'model', text.trim());
    }

    this.sessionManager.updateState(chatId, UserState.ADDING_PRESET_BACKGROUND);

    await this.bot.sendMessage(chatId,
      '🖼️ <b>Фон подарка</b>\n\n' +
      'Введите фон подарка или нажмите "Пропустить":',
      {
        parse_mode: 'HTML',
        reply_markup: skipKeyboard
      }
    );
  }

  // Обработчик ввода фона
  private async handleBackgroundInput(chatId: number, text: string): Promise<void> {
    if (text === '⏭️ Пропустить') {
      this.sessionManager.setData(chatId, 'background', null);
    } else {
      const validation = InputValidator.validateBackground(text);
      if (!validation.isValid) {
        await this.bot.sendMessage(chatId, validation.error!, {
          reply_markup: skipKeyboard
        });
        return;
      }
      this.sessionManager.setData(chatId, 'background', text.trim());
    }

    this.sessionManager.updateState(chatId, UserState.ADDING_PRESET_PATTERN);

    await this.bot.sendMessage(chatId,
      '🎨 <b>Узор подарка</b>\n\n' +
      'Введите узор подарка или нажмите "Пропустить":',
      {
        parse_mode: 'HTML',
        reply_markup: skipKeyboard
      }
    );
  }

  // Обработчик ввода узора
  private async handlePatternInput(chatId: number, text: string): Promise<void> {
    if (text === '⏭️ Пропустить') {
      this.sessionManager.setData(chatId, 'pattern', null);
    } else {
      const validation = InputValidator.validatePattern(text);
      if (!validation.isValid) {
        await this.bot.sendMessage(chatId, validation.error!, {
          reply_markup: skipKeyboard
        });
        return;
      }
      this.sessionManager.setData(chatId, 'pattern', text.trim());
    }

    // Создаем пресет
    await this.createPreset(chatId);
  }

  // Создание пресета
  private async createPreset(chatId: number): Promise<void> {
    try {
      const session = this.sessionManager.getSession(chatId);
      const presetData = {
        user_id: chatId,
        gift_name: session.data.gift_name,
        model: session.data.model,
        background: session.data.background,
        pattern: session.data.pattern,
        is_active: true
      };

      const preset = await this.presetModel.create(presetData);
      this.sessionManager.resetSession(chatId);

      const successMessage = MessageFormatter.formatPresetCreated(preset);
      await this.bot.sendMessage(chatId, successMessage, {
        parse_mode: 'HTML',
        reply_markup: mainMenu
      });
    } catch (error) {
      console.error('Error creating preset:', error);
      await this.bot.sendMessage(chatId, MessageFormatter.formatError('Не удалось создать пресет'));
    }
  }

  // Обработчик просмотра пресетов
  private async handleMyPresets(chatId: number): Promise<void> {
    try {
      const presets = await this.presetModel.getByUserId(chatId);
      const displayData = presets.map(preset => this.convertToPresetDisplayData(preset));

      const message = MessageFormatter.formatPresetsList(displayData);
      const keyboard = presets.length > 0 
        ? { inline_keyboard: presets.slice(0, 5).map(preset => [
            {
              text: `${preset.is_active ? '🟢' : '🔴'} ${preset.gift_name}`,
              callback_data: JSON.stringify({ action: 'view_preset', presetId: preset.id })
            }
          ]) }
        : undefined;

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard || mainMenu
      });
    } catch (error) {
      console.error('Error getting presets:', error);
      await this.bot.sendMessage(chatId, MessageFormatter.formatError('Не удалось получить список пресетов'));
    }
  }

  // Обработчик проверки сейчас
  private async handleCheckNow(chatId: number): Promise<void> {
    try {
      const presets = await this.presetModel.getActiveByUserId(chatId);
      
      if (presets.length === 0) {
        await this.bot.sendMessage(chatId, 
          '❌ У вас нет активных пресетов для проверки.\n\n' +
          'Создайте пресет, выбрав "Добавить пресет" в главном меню.',
          { reply_markup: mainMenu }
        );
        return;
      }

      await this.bot.sendMessage(chatId, 
        `🔍 Проверяю ${presets.length} пресетов...\n\n⏳ Пожалуйста, подождите...`
      );

      // Запускаем проверку для каждого пресета
      for (const preset of presets) {
        try {
          const result = await this.parserService.searchGifts({
            gift_name: preset.gift_name,
            model: preset.model || undefined,
            background: preset.background || undefined,
            pattern: preset.pattern || undefined
          });

          const resultMessage = MessageFormatter.formatCheckResult(preset, result.count);
          await this.bot.sendMessage(chatId, resultMessage, {
            parse_mode: 'HTML'
          });
        } catch (error) {
          console.error(`Error checking preset ${preset.id}:`, error);
          await this.bot.sendMessage(chatId, 
            `❌ Ошибка при проверке пресета "${preset.gift_name}"`
          );
        }
      }

      await this.bot.sendMessage(chatId, 
        '✅ Проверка завершена!',
        { reply_markup: mainMenu }
      );
    } catch (error) {
      console.error('Error during check:', error);
      await this.bot.sendMessage(chatId, MessageFormatter.formatError('Не удалось выполнить проверку'));
    }
  }

  // Обработчик настроек
  private async handleSettings(chatId: number): Promise<void> {
    const settingsMessage = 
      '⚙️ <b>Настройки</b>\n\n' +
      '🔔 Уведомления: включены\n' +
      '⏰ Интервал проверки: каждые 30 минут\n' +
      '📊 Статистика: доступна\n\n' +
      'Настройки будут доступны в следующих версиях.';

    await this.bot.sendMessage(chatId, settingsMessage, {
      parse_mode: 'HTML',
      reply_markup: mainMenu
    });
  }

  // Обработчик редактирования пресета
  private async handlePresetEdit(chatId: number, _text: string): Promise<void> {
    // TODO: реализовать редактирование пресета
    await this.bot.sendMessage(chatId, 'Функция редактирования в разработке');
  }

  // Обработчик неизвестной команды
  private async handleUnknownCommand(chatId: number, _text: string): Promise<void> {
    await this.bot.sendMessage(chatId, 
      '❓ Неизвестная команда. Используйте меню для навигации.',
      { reply_markup: mainMenu }
    );
  }
}
