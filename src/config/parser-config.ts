import { ParserConfig } from '../types/parser';

export const createParserConfig = (): ParserConfig => {
  return {
    baseUrl: process.env.PEEK_TG_URL || 'https://peek.tg/search',
    timeout: parseInt(process.env.PARSER_TIMEOUT_MS || '30000', 10),
    retryAttempts: parseInt(process.env.PARSER_RETRY_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.PARSER_RETRY_DELAY_MS || '2000', 10),
    headless: process.env.PARSER_HEADLESS !== 'false',
    userAgent: process.env.PARSER_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  };
};

export const defaultParserConfig: ParserConfig = {
  baseUrl: 'https://peek.tg/search',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 2000,
  headless: true,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};
