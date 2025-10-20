export enum UserState {
  IDLE = 'idle',
  ADDING_PRESET_GIFT = 'adding_preset_gift',
  ADDING_PRESET_MODEL = 'adding_preset_model',
  ADDING_PRESET_BACKGROUND = 'adding_preset_background',
  ADDING_PRESET_PATTERN = 'adding_preset_pattern',
  EDITING_PRESET = 'editing_preset',
  VIEWING_PRESETS = 'viewing_presets',
  SETTINGS = 'settings'
}

export interface UserSession {
  userId: number;
  state: UserState;
  data: Record<string, any>;
  lastActivity: Date;
}

export interface BotConfig {
  token: string;
  webhookUrl?: string;
  port?: number;
  polling?: boolean;
}

export interface BotCommand {
  command: string;
  description: string;
  handler: (msg: any, bot: any) => Promise<void>;
}

export interface CallbackQueryData {
  action: string;
  presetId?: number;
  page?: number;
  [key: string]: any;
}

export interface PresetFormData {
  gift_name?: string;
  model?: string;
  background?: string;
  pattern?: string;
}

export interface BotMessage {
  text: string;
  parse_mode?: 'HTML' | 'Markdown';
  reply_markup?: any;
}

export interface PresetDisplayData {
  id: number;
  gift_name: string;
  model?: string;
  background?: string;
  pattern?: string;
  is_active: boolean;
  created_at: Date;
  last_checked?: Date;
  last_count?: number;
}
