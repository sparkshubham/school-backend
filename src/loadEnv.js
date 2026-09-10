import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
config({ path: path.join(root, '.env.production') });
config({ path: path.join(root, '.env') });
