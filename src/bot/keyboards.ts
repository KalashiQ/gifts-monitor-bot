import { ReplyKeyboardMarkup, InlineKeyboardMarkup } from 'node-telegram-bot-api';
import { CallbackQueryData } from '../types/bot';

// Главное меню
export const mainMenu: ReplyKeyboardMarkup = {
  keyboard: [
    [
      { text: '🎁 Добавить пресет' },
      { text: '📋 Мои пресеты' }
    ],
    [
      { text: '🔍 Проверить сейчас' },
      { text: '📊 Статистика' }
    ],
    [
      { text: '⚙️ Настройки' },
      { text: 'ℹ️ Помощь' }
    ]
  ],
  resize_keyboard: true,
  one_time_keyboard: false,
  input_field_placeholder: 'Выберите действие из меню'
};

// Клавиатура отмены
export const cancelKeyboard: ReplyKeyboardMarkup = {
  keyboard: [
    [{ text: '❌ Отмена' }]
  ],
  resize_keyboard: true,
  one_time_keyboard: true
};

// Клавиатура назад
export const backKeyboard: ReplyKeyboardMarkup = {
  keyboard: [
    [{ text: '⬅️ Назад' }]
  ],
  resize_keyboard: true,
  one_time_keyboard: true
};

// Клавиатура для пропуска опциональных полей
export const skipKeyboard: ReplyKeyboardMarkup = {
  keyboard: [
    [{ text: '⏭️ Пропустить' }],
    [{ text: '❌ Отмена' }]
  ],
  resize_keyboard: true,
  one_time_keyboard: true
};

// Клавиатура подтверждения
export const confirmKeyboard: ReplyKeyboardMarkup = {
  keyboard: [
    [
      { text: '✅ Да' },
      { text: '❌ Нет' }
    ],
    [{ text: '❌ Отмена' }]
  ],
  resize_keyboard: true,
  one_time_keyboard: true
};

// Inline клавиатура для действий с пресетом
export const presetActions = (presetId: number, isActive: boolean): InlineKeyboardMarkup => ({
  inline_keyboard: [
    [
      { 
        text: isActive ? '⏸️ Остановить мониторинг' : '▶️ Запустить мониторинг', 
        callback_data: JSON.stringify({ action: 'toggle_preset', presetId })
      }
    ],
    [
      { 
        text: '🔍 Проверить сейчас', 
        callback_data: JSON.stringify({ action: 'check_preset', presetId })
      },
      { 
        text: '✏️ Редактировать', 
        callback_data: JSON.stringify({ action: 'edit_preset', presetId })
      }
    ],
    [
      { 
        text: '🗑 Удалить', 
        callback_data: JSON.stringify({ action: 'delete_preset', presetId })
      }
    ]
  ]
});

// Inline клавиатура для списка пресетов с пагинацией
export const presetsListKeyboard = (
  presets: any[], 
  currentPage: number = 0, 
  pageSize: number = 5
): InlineKeyboardMarkup => {
  const totalPages = Math.ceil(presets.length / pageSize);
  const startIndex = currentPage * pageSize;
  const endIndex = startIndex + pageSize;
  const pagePresets = presets.slice(startIndex, endIndex);

  const keyboard = pagePresets.map(preset => [
    {
      text: `${preset.is_active ? '🟢' : '🔴'} ${preset.gift_name}`,
      callback_data: JSON.stringify({ action: 'view_preset', presetId: preset.id })
    }
  ]);

  // Добавляем кнопки навигации
  const navigationButtons = [];
  if (totalPages > 1) {
    if (currentPage > 0) {
      navigationButtons.push({
        text: '⬅️',
        callback_data: JSON.stringify({ action: 'prev_page', page: currentPage - 1 })
      });
    }
    
    navigationButtons.push({
      text: `${currentPage + 1}/${totalPages}`,
      callback_data: 'noop'
    });

    if (currentPage < totalPages - 1) {
      navigationButtons.push({
        text: '➡️',
        callback_data: JSON.stringify({ action: 'next_page', page: currentPage + 1 })
      });
    }
  }

  if (navigationButtons.length > 0) {
    keyboard.push(navigationButtons);
  }

  // Кнопка назад
  keyboard.push([
    { text: '⬅️ Назад в меню', callback_data: JSON.stringify({ action: 'back_to_menu' }) }
  ]);

  return { inline_keyboard: keyboard };
};

// Inline клавиатура для редактирования пресета
export const editPresetKeyboard = (presetId: number): InlineKeyboardMarkup => ({
  inline_keyboard: [
    [
      { text: '🎁 Изменить подарок', callback_data: JSON.stringify({ action: 'edit_gift', presetId }) },
      { text: '🎭 Изменить модель', callback_data: JSON.stringify({ action: 'edit_model', presetId }) }
    ],
    [
      { text: '🖼️ Изменить фон', callback_data: JSON.stringify({ action: 'edit_background', presetId }) },
      { text: '🎨 Изменить узор', callback_data: JSON.stringify({ action: 'edit_pattern', presetId }) }
    ],
    [
      { text: '⬅️ Назад', callback_data: JSON.stringify({ action: 'back_to_presets' }) }
    ]
  ]
});

// Inline клавиатура для настроек
export const settingsKeyboard: InlineKeyboardMarkup = ({
  inline_keyboard: [
    [
      { text: '🔔 Уведомления', callback_data: JSON.stringify({ action: 'notification_settings' }) },
      { text: '⏰ Интервал проверки', callback_data: JSON.stringify({ action: 'check_interval' }) }
    ],
    [
      { text: '📊 Статистика', callback_data: JSON.stringify({ action: 'view_stats' }) },
      { text: '🗑 Очистить данные', callback_data: JSON.stringify({ action: 'clear_data' }) }
    ],
    [
      { text: '⬅️ Назад в меню', callback_data: JSON.stringify({ action: 'back_to_menu' }) }
    ]
  ]
});

// Inline клавиатура для подтверждения удаления
export const confirmDeleteKeyboard = (presetId: number): InlineKeyboardMarkup => ({
  inline_keyboard: [
    [
      { text: '✅ Да, удалить', callback_data: JSON.stringify({ action: 'confirm_delete', presetId }) },
      { text: '❌ Отмена', callback_data: JSON.stringify({ action: 'cancel_delete' }) }
    ]
  ]
});

// Inline клавиатура для результатов проверки
export const checkResultsKeyboard = (presetId: number): InlineKeyboardMarkup => ({
  inline_keyboard: [
    [
      { text: '🔄 Проверить еще раз', callback_data: JSON.stringify({ action: 'check_preset', presetId }) },
      { text: '📊 История', callback_data: JSON.stringify({ action: 'view_history', presetId }) }
    ],
    [
      { text: '⬅️ Назад', callback_data: JSON.stringify({ action: 'back_to_presets' }) }
    ]
  ]
});

// Функция для парсинга callback_data
export const parseCallbackData = (data: string): CallbackQueryData => {
  try {
    return JSON.parse(data);
  } catch {
    return { action: data };
  }
};
