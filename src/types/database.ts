export interface Preset {
  id: number;
  user_id: number;
  gift_name: string;
  model?: string;
  background?: string;
  pattern?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MonitoringHistory {
  id: number;
  preset_id: number;
  count: number;
  checked_at: Date;
  has_changed: boolean;
}

export interface CreatePresetData {
  user_id: number;
  gift_name: string;
  model?: string;
  background?: string;
  pattern?: string;
  is_active?: boolean;
}

export interface UpdatePresetData {
  gift_name?: string;
  model?: string;
  background?: string;
  pattern?: string;
  is_active?: boolean;
}

export interface PresetSearchCriteria {
  gift_name: string;
  model?: string;
  background?: string;
  pattern?: string;
}

export interface DatabaseConfig {
  path: string;
}
