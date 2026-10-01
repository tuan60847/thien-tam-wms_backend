import { config } from 'dotenv';

// Ghi đè .env: e2e luôn chạy trên DB test.
config({ path: '.env.test', override: true });
