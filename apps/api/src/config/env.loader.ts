import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

const candidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(__dirname, '../../../.env'),
  resolve(__dirname, '../../../../.env'),
];

for (const path of candidates) {
  if (existsSync(path)) {
    config({ path, override: false });
  }
}

export const isSyncQueue = () => process.env.QUEUE_MODE === 'sync';
