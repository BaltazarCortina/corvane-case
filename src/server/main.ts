// Starts the API on localhost. The web app's dev server forwards /api to it.

import { serve } from '@hono/node-server';
import { paths } from '../paths';
import { createApp } from './app';

const port = Number(process.env.API_PORT) || 3001;
const app = createApp(paths);

serve({ fetch: app.fetch, port }, () => {
  console.log(`API on http://localhost:${port}/api`);
});
