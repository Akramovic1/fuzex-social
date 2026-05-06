import 'hono';

import { type FirebaseAuthContext } from '@/shared/middleware/firebaseAuth.js';

declare module 'hono' {
  interface ContextVariableMap {
    correlationId: string;
    requestStartedAt: number;
    firebaseAuth?: FirebaseAuthContext;
  }
}
