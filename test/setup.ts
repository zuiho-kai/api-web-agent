import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Load .env relative to project root so env vars are available in all test files.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '..', '.env') });
