# Система контроля доступа

Система контроля доступа позволяет ограничить использование бота только определенными пользователями по их Telegram ID.

## Конфигурация

### Переменные окружения

Добавьте следующие переменные в ваш `.env` файл:

```env
# Access Control Configuration
ALLOWED_USER_IDS=5753792825,8078808957
ACCESS_CONTROL_ENABLED=true
```

- `ALLOWED_USER_IDS` - список разрешенных Telegram ID пользователей через запятую
- `ACCESS_CONTROL_ENABLED` - включить/выключить контроль доступа (по умолчанию `true` если указаны ID)

### Получение Telegram ID

Чтобы получить Telegram ID пользователя:

1. Напишите боту @userinfobot
2. Отправьте любое сообщение
3. Бот вернет ваш Telegram ID

## Использование

### Автоматическая проверка

Система автоматически проверяет доступ для всех команд и сообщений:

- Команды (`/start`, `/help`, `/menu`, etc.)
- Текстовые сообщения
- Callback запросы (кнопки)

### Программное управление

```typescript
import { TelegramBotService } from './bot/telegram-bot';

// Проверка доступа пользователя
const isAllowed = bot.isUserAllowed(userId);

// Получение списка разрешенных пользователей
const allowedUsers = bot.getAllowedUsers();

// Добавление пользователя
bot.addAllowedUser(userId);

// Удаление пользователя
bot.removeAllowedUser(userId);

// Включение/выключение контроля доступа
bot.setAccessControlEnabled(true);
bot.setAccessControlEnabled(false);

// Проверка статуса
const isEnabled = bot.isAccessControlEnabled();
```

## Поведение при отказе в доступе

Когда пользователь без доступа пытается использовать бота:

1. **Команды и сообщения**: Отправляется сообщение "🚫 Доступ запрещен"
2. **Callback запросы**: Показывается alert "Доступ запрещен" и отправляется сообщение

## Логирование

Система ведет логи всех попыток доступа:

```
Access denied for user 1234567890 (John Doe)
Added user 9999999999 to allowed list
Removed user 9999999999 from allowed list
Access control enabled
Access control disabled
```

## Примеры

### Базовый пример

```typescript
import { createAccessControlConfig } from './config/access-control';

const config = createAccessControlConfig();
console.log('Allowed users:', config.allowedUserIds);
console.log('Access control enabled:', config.enabled);
```

### Полный пример

См. файл `src/examples/access-control-example.ts` для полного примера использования.

## Безопасность

- Telegram ID пользователей не изменяются и являются уникальными
- Список разрешенных пользователей загружается при запуске бота
- Изменения в списке пользователей применяются только до перезапуска бота
- Для постоянного хранения изменений необходимо обновить переменную окружения

## Отключение контроля доступа

Чтобы отключить контроль доступа:

1. Установите `ACCESS_CONTROL_ENABLED=false` в `.env`
2. Или удалите переменную `ALLOWED_USER_IDS`
3. Перезапустите бота

При отключенном контроле доступа все пользователи могут использовать бота.
