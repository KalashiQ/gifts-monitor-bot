# Epic 2: Реализация базы данных и моделей

## Статус: ✅ Завершен

## Описание
Настройка SQLite базы данных и создание моделей для работы с данными пресетов и истории мониторинга.

## Выполненные задачи

### 1. Создание типов данных
- ✅ **Database Types** (`src/types/database.ts`):
  - `Preset` - интерфейс для пресетов
  - `MonitoringHistory` - интерфейс для истории мониторинга
  - `CreatePresetData` - данные для создания пресета
  - `UpdatePresetData` - данные для обновления пресета
  - `PresetSearchCriteria` - критерии поиска пресетов
  - `DatabaseConfig` - конфигурация базы данных

### 2. Создание подключения к базе данных
- ✅ **DatabaseConnection** (`src/database/connection.ts`):
  - Асинхронное подключение к SQLite
  - Методы для выполнения SQL запросов (run, get, all)
  - Автоматическое создание папки для базы данных
  - Включение foreign key constraints
  - Обработка ошибок подключения

### 3. Создание миграций
- ✅ **DatabaseMigrations** (`src/database/migrations.ts`):
  - Создание таблицы `presets` с полями:
    - id (PRIMARY KEY, AUTOINCREMENT)
    - user_id (INTEGER, NOT NULL)
    - gift_name (TEXT, NOT NULL)
    - model (TEXT, nullable)
    - background (TEXT, nullable)
    - pattern (TEXT, nullable)
    - is_active (BOOLEAN, DEFAULT 1)
    - created_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
    - updated_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
  
  - Создание таблицы `monitoring_history` с полями:
    - id (PRIMARY KEY, AUTOINCREMENT)
    - preset_id (INTEGER, NOT NULL, FOREIGN KEY)
    - count (INTEGER, NOT NULL)
    - checked_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
    - has_changed (BOOLEAN, DEFAULT 0)
  
  - Создание индексов для оптимизации запросов
  - Каскадное удаление записей истории при удалении пресета

### 4. Создание моделей данных
- ✅ **PresetModel** (`src/database/models/preset.model.ts`):
  - `create()` - создание нового пресета
  - `getById()` - получение пресета по ID
  - `getByUserId()` - получение всех пресетов пользователя
  - `getActiveByUserId()` - получение активных пресетов пользователя
  - `getAllActive()` - получение всех активных пресетов
  - `update()` - обновление пресета
  - `delete()` - удаление пресета
  - `findByCriteria()` - поиск пресетов по критериям
  - `toggleActive()` - переключение статуса активности
  - `countByUserId()` - подсчет пресетов пользователя
  - `countActiveByUserId()` - подсчет активных пресетов пользователя

- ✅ **MonitoringHistoryModel** (`src/database/models/monitoring-history.model.ts`):
  - `create()` - создание записи истории мониторинга
  - `getById()` - получение записи по ID
  - `getByPresetId()` - получение истории для пресета
  - `getLatestByPresetId()` - получение последней записи для пресета
  - `getChangedRecords()` - получение записей с изменениями
  - `getChangedRecordsByPresetId()` - получение изменений для конкретного пресета
  - `getRecordsByDateRange()` - получение записей за период
  - `getStatisticsByPresetId()` - получение статистики для пресета
  - `deleteOldRecords()` - удаление старых записей
  - `deleteByPresetId()` - удаление всех записей пресета

### 5. Создание основного класса базы данных
- ✅ **Database** (`src/database/database.ts`):
  - Инициализация подключения и миграций
  - Предоставление доступа к моделям
  - Управление жизненным циклом подключения

### 6. Настройка тестирования
- ✅ **Jest Configuration**:
  - Настройка Jest с TypeScript поддержкой
  - Конфигурация для тестирования базы данных
  - Использование in-memory SQLite для тестов
  - Настройка глобальных переменных для тестов

### 7. Создание тестов
- ✅ **Unit Tests**:
  - `preset.model.test.ts` - тесты модели пресетов (15 тестов)
  - `monitoring-history.model.test.ts` - тесты модели истории (18 тестов)
  - `database.integration.test.ts` - интеграционные тесты (6 тестов)

- ✅ **Test Coverage**:
  - Все основные методы моделей покрыты тестами
  - Тестирование создания, чтения, обновления, удаления
  - Тестирование поиска и фильтрации
  - Тестирование статистики и аналитики
  - Тестирование обработки ошибок

### 8. Создание примера использования
- ✅ **Database Example** (`src/examples/database-example.ts`):
  - Демонстрация создания пресетов
  - Создание истории мониторинга
  - Примеры различных операций с данными
  - Вывод статистики и результатов

### 9. Обработка особенностей SQLite
- ✅ **Boolean Values**: Преобразование INTEGER (0/1) в boolean
- ✅ **Date Handling**: Корректная работа с датами в SQLite
- ✅ **Foreign Keys**: Включение constraints для целостности данных
- ✅ **Auto-increment**: Правильная работа с автоинкрементными полями

## Результат
Полнофункциональная база данных с:
- ✅ Двумя основными таблицами (presets, monitoring_history)
- ✅ Полным набором CRUD операций
- ✅ Поиском и фильтрацией данных
- ✅ Статистикой и аналитикой
- ✅ Каскадным удалением
- ✅ Индексами для оптимизации
- ✅ Comprehensive тестовым покрытием (33 теста)
- ✅ Примером использования

## Технические детали
- **База данных**: SQLite с foreign key constraints
- **ORM**: Собственная реализация с TypeScript
- **Тестирование**: Jest с in-memory SQLite
- **Миграции**: Автоматическое создание схемы
- **Типизация**: Строгая типизация всех операций

## Следующие шаги
Переход к Epic 3: Реализация парсера peek.tg
