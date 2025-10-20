export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export class InputValidator {
  // Валидация названия подарка
  public static validateGiftName(giftName: string): ValidationResult {
    if (!giftName || giftName.trim().length === 0) {
      return {
        isValid: false,
        error: '❌ Название подарка не может быть пустым'
      };
    }

    if (giftName.trim().length < 2) {
      return {
        isValid: false,
        error: '❌ Название подарка должно содержать минимум 2 символа'
      };
    }

    if (giftName.trim().length > 100) {
      return {
        isValid: false,
        error: '❌ Название подарка не должно превышать 100 символов'
      };
    }

    // Проверка на недопустимые символы
    const invalidChars = /[<>{}[\]\\|`~]/;
    if (invalidChars.test(giftName)) {
      return {
        isValid: false,
        error: '❌ Название подарка содержит недопустимые символы'
      };
    }

    return { isValid: true };
  }

  // Валидация модели
  public static validateModel(model: string): ValidationResult {
    if (!model || model.trim().length === 0) {
      return { isValid: true }; // Модель опциональна
    }

    if (model.trim().length > 50) {
      return {
        isValid: false,
        error: '❌ Название модели не должно превышать 50 символов'
      };
    }

    const invalidChars = /[<>{}[\]\\|`~]/;
    if (invalidChars.test(model)) {
      return {
        isValid: false,
        error: '❌ Название модели содержит недопустимые символы'
      };
    }

    return { isValid: true };
  }

  // Валидация фона
  public static validateBackground(background: string): ValidationResult {
    if (!background || background.trim().length === 0) {
      return { isValid: true }; // Фон опционален
    }

    if (background.trim().length > 50) {
      return {
        isValid: false,
        error: '❌ Название фона не должно превышать 50 символов'
      };
    }

    const invalidChars = /[<>{}[\]\\|`~]/;
    if (invalidChars.test(background)) {
      return {
        isValid: false,
        error: '❌ Название фона содержит недопустимые символы'
      };
    }

    return { isValid: true };
  }

  // Валидация узора
  public static validatePattern(pattern: string): ValidationResult {
    if (!pattern || pattern.trim().length === 0) {
      return { isValid: true }; // Узор опционален
    }

    if (pattern.trim().length > 50) {
      return {
        isValid: false,
        error: '❌ Название узора не должно превышать 50 символов'
      };
    }

    const invalidChars = /[<>{}[\]\\|`~]/;
    if (invalidChars.test(pattern)) {
      return {
        isValid: false,
        error: '❌ Название узора содержит недопустимые символы'
      };
    }

    return { isValid: true };
  }

  // Валидация ID пресета
  public static validatePresetId(presetId: any): ValidationResult {
    if (!presetId) {
      return {
        isValid: false,
        error: '❌ ID пресета не указан'
      };
    }

    const id = parseInt(presetId);
    if (isNaN(id) || id <= 0) {
      return {
        isValid: false,
        error: '❌ Неверный ID пресета'
      };
    }

    return { isValid: true };
  }

  // Валидация номера страницы
  public static validatePageNumber(page: any): ValidationResult {
    if (!page) {
      return { isValid: true }; // Страница по умолчанию
    }

    const pageNum = parseInt(page);
    if (isNaN(pageNum) || pageNum < 0) {
      return {
        isValid: false,
        error: '❌ Неверный номер страницы'
      };
    }

    return { isValid: true };
  }

  // Валидация команды
  public static validateCommand(command: string, allowedCommands: string[]): ValidationResult {
    if (!command || !allowedCommands.includes(command)) {
      return {
        isValid: false,
        error: '❌ Неизвестная команда'
      };
    }

    return { isValid: true };
  }

  // Валидация callback данных
  public static validateCallbackData(data: any): ValidationResult {
    if (!data || typeof data !== 'object') {
      return {
        isValid: false,
        error: '❌ Неверные данные callback'
      };
    }

    if (!data.action) {
      return {
        isValid: false,
        error: '❌ Действие не указано'
      };
    }

    return { isValid: true };
  }

  // Валидация текста сообщения
  public static validateMessageText(text: string, maxLength: number = 1000): ValidationResult {
    if (!text || text.trim().length === 0) {
      return {
        isValid: false,
        error: '❌ Текст сообщения не может быть пустым'
      };
    }

    if (text.length > maxLength) {
      return {
        isValid: false,
        error: `❌ Текст сообщения не должен превышать ${maxLength} символов`
      };
    }

    return { isValid: true };
  }

  // Валидация пользовательского ID
  public static validateUserId(userId: any): ValidationResult {
    if (!userId) {
      return {
        isValid: false,
        error: '❌ ID пользователя не указан'
      };
    }

    const id = parseInt(userId);
    if (isNaN(id) || id <= 0) {
      return {
        isValid: false,
        error: '❌ Неверный ID пользователя'
      };
    }

    return { isValid: true };
  }

  // Комплексная валидация данных пресета
  public static validatePresetData(data: {
    gift_name?: string;
    model?: string;
    background?: string;
    pattern?: string;
  }): ValidationResult {
    // Валидация обязательного поля
    if (data.gift_name !== undefined) {
      const giftValidation = this.validateGiftName(data.gift_name);
      if (!giftValidation.isValid) {
        return giftValidation;
      }
    }

    // Валидация опциональных полей
    if (data.model !== undefined) {
      const modelValidation = this.validateModel(data.model);
      if (!modelValidation.isValid) {
        return modelValidation;
      }
    }

    if (data.background !== undefined) {
      const backgroundValidation = this.validateBackground(data.background);
      if (!backgroundValidation.isValid) {
        return backgroundValidation;
      }
    }

    if (data.pattern !== undefined) {
      const patternValidation = this.validatePattern(data.pattern);
      if (!patternValidation.isValid) {
        return patternValidation;
      }
    }

    return { isValid: true };
  }

  // Санитизация ввода
  public static sanitizeInput(input: string): string {
    return input.trim().replace(/[<>{}[\]\\|`~]/g, '');
  }

  // Проверка на спам (простая проверка повторяющихся сообщений)
  public static checkForSpam(messages: string[], currentMessage: string, threshold: number = 3): boolean {
    const recentMessages = messages.slice(-threshold);
    const duplicateCount = recentMessages.filter(msg => msg === currentMessage).length;
    return duplicateCount >= threshold;
  }
}
