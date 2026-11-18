import type { Entry } from './types';

const empty = new Map<string, Entry | undefined>();

export function publishedChanges(): ReadonlyMap<string, Entry | undefined> {
  return empty;
}
