import 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    correlationId: string;
    requestStartedAt: number;
  }
}
