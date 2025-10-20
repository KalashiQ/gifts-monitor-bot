import TelegramBot from 'node-telegram-bot-api';
import { AccessControlConfig } from '../../config/access-control';

export class AccessControlMiddleware {
  private config: AccessControlConfig;
  private bot: TelegramBot;

  constructor(config: AccessControlConfig, bot: TelegramBot) {
    this.config = config;
    this.bot = bot;
  }

  /**
   * Проверяет, имеет ли пользователь доступ к боту
   */
  public isUserAllowed(userId: number): boolean {
    if (!this.config.enabled) {
      return true; // Если контроль доступа отключен, разрешаем всем
    }

    return this.config.allowedUserIds.includes(userId);
  }

  /**
   * Middleware для проверки доступа к командам
   */
  public checkAccess = (handler: (msg: TelegramBot.Message) => Promise<void>) => {
    return async (msg: TelegramBot.Message): Promise<void> => {
      const userId = msg.from?.id;
      
      if (!userId) {
        console.warn('Access control: User ID not found in message');
        return;
      }

      if (!this.isUserAllowed(userId)) {
        console.log(`Access denied for user ${userId} (${msg.from?.first_name || 'Unknown'})`);
        
        const accessDeniedMessage = 
          '🚫 <b>Доступ запрещен</b>\n\n' +
          'У вас нет прав для использования этого бота.\n' +
          'Обратитесь к администратору для получения доступа.';

        try {
          await this.bot.sendMessage(msg.chat.id, accessDeniedMessage, {
            parse_mode: 'HTML'
          });
        } catch (error) {
          console.error('Error sending access denied message:', error);
        }
        
        return;
      }

      // Если доступ разрешен, выполняем обработчик
      await handler(msg);
    };
  };

  /**
   * Middleware для проверки доступа к callback запросам
   */
  public checkCallbackAccess = (handler: (query: TelegramBot.CallbackQuery) => Promise<void>) => {
    return async (query: TelegramBot.CallbackQuery): Promise<void> => {
      const userId = query.from?.id;
      
      if (!userId) {
        console.warn('Access control: User ID not found in callback query');
        return;
      }

      if (!this.isUserAllowed(userId)) {
        console.log(`Access denied for callback from user ${userId} (${query.from?.first_name || 'Unknown'})`);
        
        const accessDeniedMessage = 
          '🚫 <b>Доступ запрещен</b>\n\n' +
          'У вас нет прав для использования этого бота.\n' +
          'Обратитесь к администратору для получения доступа.';

        try {
          await this.bot.answerCallbackQuery(query.id, {
            text: 'Доступ запрещен',
            show_alert: true
          });
          
          await this.bot.sendMessage(query.message?.chat?.id || 0, accessDeniedMessage, {
            parse_mode: 'HTML'
          });
        } catch (error) {
          console.error('Error handling access denied callback:', error);
        }
        
        return;
      }

      // Если доступ разрешен, выполняем обработчик
      await handler(query);
    };
  };

  /**
   * Получает список разрешенных пользователей
   */
  public getAllowedUsers(): number[] {
    return [...this.config.allowedUserIds];
  }

  /**
   * Добавляет пользователя в список разрешенных
   */
  public addAllowedUser(userId: number): void {
    if (!this.config.allowedUserIds.includes(userId)) {
      this.config.allowedUserIds.push(userId);
      console.log(`Added user ${userId} to allowed list`);
    }
  }

  /**
   * Удаляет пользователя из списка разрешенных
   */
  public removeAllowedUser(userId: number): void {
    const index = this.config.allowedUserIds.indexOf(userId);
    if (index > -1) {
      this.config.allowedUserIds.splice(index, 1);
      console.log(`Removed user ${userId} from allowed list`);
    }
  }

  /**
   * Проверяет, включен ли контроль доступа
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Включает/выключает контроль доступа
   */
  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    console.log(`Access control ${enabled ? 'enabled' : 'disabled'}`);
  }
}
