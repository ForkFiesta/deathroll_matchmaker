import { createApp } from './app.js';
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '127.0.0.1';
const { app, store } = createApp();
const server = app.listen(port, host, () =>
  console.log(`Last Roll practice server: http://${host}:${port}`),
);
function shutdown() {
  server.close(() => {
    store.db.close();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
