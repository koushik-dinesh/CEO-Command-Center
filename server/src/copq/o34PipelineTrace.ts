export function logO34Stage(stage: string, payload: unknown, keysSource?: Record<string, unknown> | null): void {
  console.log(stage, payload);
  if (keysSource && typeof keysSource === 'object') {
    console.log('AVAILABLE KEYS', Object.keys(keysSource));
  }
}
