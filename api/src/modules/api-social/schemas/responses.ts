import { z } from 'zod';

export const resolveHandleResponseSchema = z.object({
  handle: z.string(),
  did: z.string().startsWith('did:'),
  walletAddress: z.string(),
  chain: z.string(),
  tippingEnabled: z.boolean(),
});

export type ResolveHandleResponse = z.infer<typeof resolveHandleResponseSchema>;

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
