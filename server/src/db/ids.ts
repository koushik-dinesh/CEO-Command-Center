import { randomBytes } from 'node:crypto';

export function createId(prefix = 'id'): string {
  return `${prefix}_${randomBytes(12).toString('hex')}`;
}
