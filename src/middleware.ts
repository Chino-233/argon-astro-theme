import { defineMiddleware } from 'astro:middleware';
import { loadOverrides } from './lib/argon-state';

export const onRequest = defineMiddleware(async ({ locals }, next) => {
  locals.argonOverrides = await loadOverrides();
  return next();
});
