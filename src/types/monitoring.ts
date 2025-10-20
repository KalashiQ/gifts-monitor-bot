export interface MonitoringConfig {
  enabled: boolean;
  cronExpression: string;
  checkIntervalMinutes: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export interface MonitoringStats {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  totalChanges: number;
  lastCheck: Date | null;
  isRunning: boolean;
}

export interface ChangeNotification {
  presetId: number;
  userId: number;
  giftName: string;
  oldCount: number;
  newCount: number;
  changeDirection: 'increase' | 'decrease';
  searchUrl: string;
  timestamp: Date;
}

export interface MonitoringReport {
  startTime: Date;
  endTime: Date;
  totalPresets: number;
  checkedPresets: number;
  changedPresets: number;
  errors: number;
  duration: number;
  changes: ChangeNotification[];
}

export interface MonitoringSettings {
  enabled: boolean;
  frequency: 'every_5_minutes' | 'every_15_minutes' | 'every_30_minutes' | 'every_hour' | 'every_2_hours' | 'every_6_hours' | 'every_12_hours' | 'daily';
  retryAttempts: number;
  retryDelayMs: number;
  maxConcurrentChecks: number;
  notificationEnabled: boolean;
  notificationFormat: 'detailed' | 'simple';
}

export const MONITORING_FREQUENCIES = {
  'every_5_minutes': '*/5 * * * *',
  'every_15_minutes': '*/15 * * * *',
  'every_30_minutes': '*/30 * * * *',
  'every_hour': '0 * * * *',
  'every_2_hours': '0 */2 * * *',
  'every_6_hours': '0 */6 * * *',
  'every_12_hours': '0 */12 * * *',
  'daily': '0 0 * * *'
} as const;

export type MonitoringFrequency = keyof typeof MONITORING_FREQUENCIES;
