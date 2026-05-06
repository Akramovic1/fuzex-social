declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: 'development' | 'production' | 'test';
    PORT?: string;
    LOG_LEVEL?: string;
    DATABASE_URL?: string;
    HANDLE_DOMAIN?: string;
    PDS_URL?: string;
    CORS_ALLOWED_ORIGINS?: string;
    RATE_LIMIT_WINDOW_MS?: string;
    RATE_LIMIT_MAX_REQUESTS?: string;
  }
}
