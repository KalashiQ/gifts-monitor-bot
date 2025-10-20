export interface ParserConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  headless: boolean;
  userAgent?: string;
}

export interface SearchCriteria {
  gift_name: string;
  model?: string;
  background?: string;
  pattern?: string;
}

export interface SearchResult {
  count: number;
  items: GiftItem[];
  searchCriteria: SearchCriteria;
  timestamp: Date;
}

export interface GiftItem {
  id: string;
  name: string;
  model?: string;
  background?: string;
  pattern?: string;
  imageUrl?: string;
  rarity?: string;
}

export interface ParserError {
  message: string;
  code: string;
  timestamp: Date;
  retryCount?: number;
}

export interface ParserStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime?: Date;
}
