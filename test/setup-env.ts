import { config } from 'dotenv';

// Override .env: e2e must always run against the test database.
config({ path: '.env.test', override: true });
