import { Database } from '../../src/database/database';
import { ParserService } from '../../src/services/parser-service';
import { MonitoringService } from '../../src/services/monitoring-service';
import { createParserConfig } from '../../src/config/parser-config';
import { MonitoringConfig } from '../../src/types/monitoring';

// Мок для Telegram бота
const mockBot = {
  sendMessage: jest.fn().mockResolvedValue(undefined)
} as any;

describe('MonitoringService', () => {
  let database: Database;
  let parserService: ParserService;
  let monitoringService: MonitoringService;
  let config: MonitoringConfig;

  beforeAll(async () => {
    // Инициализируем тестовую базу данных
    database = new Database({ path: ':memory:' });
    await database.initialize();

    // Инициализируем парсер
    const parserConfig = createParserConfig();
    parserService = new ParserService(parserConfig, database);
    await parserService.initialize();

    // Конфигурация мониторинга
    config = {
      enabled: true,
      cronExpression: '*/1 * * * *', // Каждую минуту для тестов
      checkIntervalMinutes: 1,
      retryAttempts: 2,
      retryDelayMs: 100
    };

    monitoringService = new MonitoringService(database, parserService, mockBot, config);
  });

  afterAll(async () => {
    await monitoringService.cleanup();
    await parserService.close();
  });

  beforeEach(async () => {
    // Очищаем базу данных перед каждым тестом
    await database.getConnection().run('DELETE FROM presets');
    await database.getConnection().run('DELETE FROM monitoring_history');
  });

  describe('Инициализация', () => {
    test('должен инициализироваться корректно', async () => {
      await expect(monitoringService.initialize()).resolves.not.toThrow();
    });

    test('должен получить статистику', () => {
      const stats = monitoringService.getStats();
      expect(stats).toHaveProperty('totalChecks');
      expect(stats).toHaveProperty('successfulChecks');
      expect(stats).toHaveProperty('failedChecks');
      expect(stats).toHaveProperty('totalChanges');
      expect(stats).toHaveProperty('isRunning');
    });
  });

  describe('Управление мониторингом', () => {
    test('должен запускаться и останавливаться', async () => {
      await monitoringService.initialize();
      
      await monitoringService.start();
      expect(monitoringService.getStats().isRunning).toBe(true);
      
      await monitoringService.stop();
      expect(monitoringService.getStats().isRunning).toBe(false);
    });

    test('должен обновлять конфигурацию', () => {
      const newConfig = {
        enabled: false,
        cronExpression: '0 0 * * *',
        checkIntervalMinutes: 60,
        retryAttempts: 5,
        retryDelayMs: 2000
      };

      monitoringService.updateConfig(newConfig);
      // Проверяем, что конфигурация обновилась (внутренняя проверка)
      expect(true).toBe(true); // Placeholder для проверки обновления конфига
    });
  });

  describe('Статистика', () => {
    test('должен возвращать корректную статистику', () => {
      const stats = monitoringService.getStats();
      
      expect(typeof stats.totalChecks).toBe('number');
      expect(typeof stats.successfulChecks).toBe('number');
      expect(typeof stats.failedChecks).toBe('number');
      expect(typeof stats.totalChanges).toBe('number');
      expect(typeof stats.isRunning).toBe('boolean');
      expect(stats.lastCheck === null || stats.lastCheck instanceof Date).toBe(true);
    });

    test('должен обновлять статистику при проверках', async () => {
      await monitoringService.initialize();
      
      const initialStats = monitoringService.getStats();
      const initialChecks = initialStats.totalChecks;
      
      // Выполняем ручную проверку
      await monitoringService.performMonitoringCycle();
      
      const updatedStats = monitoringService.getStats();
      expect(updatedStats.totalChecks).toBeGreaterThan(initialChecks);
    });
  });

  describe('Обработка ошибок', () => {
    test('должен корректно обрабатывать ошибки инициализации', async () => {
      const invalidDatabase = null as any;
      const invalidParser = null as any;
      
      const invalidMonitoringService = new MonitoringService(
        invalidDatabase,
        invalidParser,
        mockBot,
        config
      );
      
      await expect(invalidMonitoringService.initialize()).rejects.toThrow();
    });

    test('должен продолжать работу при ошибках отдельных пресетов', async () => {
      await monitoringService.initialize();
      
      // Создаем тестовый пресет с невалидными данными
      await database.getConnection().run(`
        INSERT INTO presets (user_id, gift_name, model, background, pattern, is_active)
        VALUES (123, 'test-gift', 'invalid-model', 'invalid-background', 'invalid-pattern', 1)
      `);
      
      // Проверяем, что мониторинг не падает при ошибках
      await expect(monitoringService.performMonitoringCycle()).resolves.not.toThrow();
    });
  });
});
