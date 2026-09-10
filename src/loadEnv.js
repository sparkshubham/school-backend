import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Vercel may have empty JWT_* keys set in the dashboard. override fills them
// from .env.production so jsonwebtoken gets a real secret.
if (process.env.VERCEL) {
  config({ path: path.join(root, '.env.production'), override: true });
} else {
  config({ path: path.join(root, '.env') });
  config({ path: path.join(root, '.env.production') });
}
