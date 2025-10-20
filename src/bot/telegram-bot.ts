import TelegramBot from 'node-telegram-bot-api';
import { BotConfig } from '../types/bot';
import { SessionManager } from './session-manager';
import { CommandHandlers } from './handlers/command-handlers';
import { CallbackHandlers } from './handlers/callback-handlers';
import { PresetModel } from '../database/models/preset.model';
import { ParserService } from '../services/parser-service';
import { MonitoringService } from '../services/monitoring-service';
import { AccessControlMiddleware } from './middleware/access-control';
import { createAccessControlConfig } from '../config/access-control';

export class TelegramBotService {
  private bot: TelegramBot;
  private sessionManager: SessionManager;
  private commandHandlers: CommandHandlers;
  private callbackHandlers: CallbackHandlers;
  private presetModel: PresetModel;
  private parserService: ParserService;
  private monitoringService?: MonitoringService;
  private accessControl: AccessControlMiddleware;
  private isRunning: boolean = false;

  constructor(
    config: BotConfig,
    presetModel: PresetModel,
    parserService: ParserService,
    monitoringService?: MonitoringService
  ) {
    this.bot = new TelegramBot(config.token, { 
      polling: config.polling !== false 
    });
    this.sessionManager = new SessionManager();
    this.presetModel = presetModel;
    this.parserService = parserService;
    this.monitoringService = monitoringService;
    this.accessControl = new AccessControlMiddleware(createAccessControlConfig(), this.bot);
    
    this.commandHandlers = new CommandHandlers(
      this.bot,
      this.sessionManager,
      this.presetModel,
      this.monitoringService
    );
    
    this.callbackHandlers = new CallbackHandlers(
      this.bot,
      this.presetModel,
      this.parserService,
      this.sessionManager,
      this.monitoringService
    );

    this.setupEventHandlers();
  }

  // Настройка обработчиков событий
  private setupEventHandlers(): void {
    // Обработчик команды /start
    this.bot.onText(/\/start/, this.accessControl.checkAccess(async (msg) => {
      await this.commandHandlers.handleStart(msg);
    }));

    // Обработчик команды /help
    this.bot.onText(/\/help/, this.accessControl.checkAccess(async (msg) => {
      await this.commandHandlers.handleHelp(msg);
    }));

    // Обработчик команды /menu
    this.bot.onText(/\/menu/, this.accessControl.checkAccess(async (msg) => {
      await this.commandHandlers.handleMenu(msg);
    }));

    // Обработчик команды /monitoring
    this.bot.onText(/\/monitoring/, this.accessControl.checkAccess(async (msg) => {
      await this.commandHandlers.handleMonitoring(msg);
    }));

    // Обработчик команды /monitoring_start
    this.bot.onText(/\/monitoring_start/, this.accessControl.checkAccess(async (msg) => {
      await this.commandHandlers.handleMonitoringStart(msg);
    }));

    // Обработчик команды /monitoring_stop
    this.bot.onText(/\/monitoring_stop/, this.accessControl.checkAccess(async (msg) => {
      await this.commandHandlers.handleMonitoringStop(msg);
    }));

    // Обработчик текстовых сообщений
    this.bot.on('message', this.accessControl.checkAccess(async (msg) => {
      if (msg.text && !msg.text.startsWith('/')) {
        await this.commandHandlers.handleTextMessage(msg);
      }
    }));

    // Обработчик callback запросов
    this.bot.on('callback_query', this.accessControl.checkCallbackAccess(async (query) => {
      await this.callbackHandlers.handleCallbackQuery(query);
    }));

    // Обработчик ошибок
    this.bot.on('error', (error) => {
      console.error('Bot error:', error);
    });

    // Обработчик polling ошибок
    this.bot.on('polling_error', (error) => {
      console.error('Polling error:', error);
    });

    // Обработчик webhook ошибок
    this.bot.on('webhook_error', (error) => {
      console.error('Webhook error:', error);
    });
  }

  // Запуск бота
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Bot is already running');
      return;
    }

    try {
      console.log('Starting Telegram bot...');
      
      // Получаем информацию о боте
      const botInfo = await this.bot.getMe();
      console.log(`Bot started: @${botInfo.username} (${botInfo.first_name})`);

      // Запускаем очистку неактивных сессий каждые 30 минут
      setInterval(() => {
        this.sessionManager.cleanupInactiveSessions(60); // 60 минут
      }, 30 * 60 * 1000);

      this.isRunning = true;
      console.log('Bot is running and ready to receive messages');
    } catch (error) {
      console.error('Failed to start bot:', error);
      throw error;
    }
  }

  // Остановка бота
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('Bot is not running');
      return;
    }

    try {
      console.log('Stopping Telegram bot...');
      await this.bot.stopPolling();
      this.isRunning = false;
      console.log('Bot stopped');
    } catch (error) {
      console.error('Error stopping bot:', error);
      throw error;
    }
  }

  // Отправка сообщения пользователю
  public async sendMessage(
    chatId: number, 
    text: string, 
    options?: TelegramBot.SendMessageOptions
  ): Promise<TelegramBot.Message> {
    return await this.bot.sendMessage(chatId, text, options);
  }

  // Редактирование сообщения
  public async editMessageText(
    chatId: number,
    messageId: number,
    text: string,
    options?: TelegramBot.EditMessageTextOptions
  ): Promise<TelegramBot.Message | boolean> {
    return await this.bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      ...options
    });
  }

  // Получение информации о боте
  public async getBotInfo(): Promise<TelegramBot.User> {
    return await this.bot.getMe();
  }

  // Получение статистики
  public getStats(): {
    isRunning: boolean;
    activeSessions: number;
    uptime: number;
  } {
    return {
      isRunning: this.isRunning,
      activeSessions: this.sessionManager.getActiveSessionsCount(),
      uptime: process.uptime()
    };
  }

  // Проверка состояния бота
  public isBotRunning(): boolean {
    return this.isRunning;
  }

  // Получение сессии пользователя
  public getUserSession(userId: number) {
    return this.sessionManager.getSession(userId);
  }

  // Сброс сессии пользователя
  public resetUserSession(userId: number): void {
    this.sessionManager.resetSession(userId);
  }

  // Отправка уведомления об изменении
  public async sendChangeNotification(
    chatId: number,
    presetName: string,
    oldCount: number,
    newCount: number
  ): Promise<void> {
    const message = `🔔 <b>Изменение обнаружено!</b>\n\n` +
                   `🎁 <b>${presetName}</b>\n` +
                   `🔢 Количество подарков изменилось\n` +
                   `📊 Было: ${oldCount} → Стало: ${newCount}\n\n` +
                   `⏰ ${new Date().toLocaleString('ru-RU')}`;

    try {
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'HTML'
      });
    } catch (error) {
      console.error('Error sending change notification:', error);
    }
  }


  // Массовая отправка уведомлений
  public async broadcastMessage(
    userIds: number[],
    message: string,
    options?: TelegramBot.SendMessageOptions
  ): Promise<void> {
    const promises = userIds.map(async (userId) => {
      try {
        await this.bot.sendMessage(userId, message, options);
      } catch (error) {
        console.error(`Error sending message to user ${userId}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  // Получение всех активных пользователей
  public getActiveUsers(): number[] {
    return this.sessionManager.getAllSessions().map(session => session.userId);
  }

  // Обновление мониторинга
  public setMonitoringService(monitoringService: MonitoringService): void {
    this.monitoringService = monitoringService;
    this.commandHandlers = new CommandHandlers(
      this.bot,
      this.sessionManager,
      this.presetModel,
      this.monitoringService
    );
    this.callbackHandlers = new CallbackHandlers(
      this.bot,
      this.presetModel,
      this.parserService,
      this.sessionManager,
      this.monitoringService
    );
  }

  // Методы управления доступом
  public isUserAllowed(userId: number): boolean {
    return this.accessControl.isUserAllowed(userId);
  }

  public getAllowedUsers(): number[] {
    return this.accessControl.getAllowedUsers();
  }

  public addAllowedUser(userId: number): void {
    this.accessControl.addAllowedUser(userId);
  }

  public removeAllowedUser(userId: number): void {
    this.accessControl.removeAllowedUser(userId);
  }

  public isAccessControlEnabled(): boolean {
    return this.accessControl.isEnabled();
  }

  public setAccessControlEnabled(enabled: boolean): void {
    this.accessControl.setEnabled(enabled);
  }
}
