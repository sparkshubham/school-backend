import 'dotenv/config';
import { createApp } from './app.js';
import { connectDb } from './config/db.js';

const app = createApp();

if (!process.env.VERCEL) {
  await connectDb();
  const port = Number(process.env.PORT) || 5100;
  app.listen(port, () => console.log(`EduNest API running on http://localhost:${port}`));
}

export default app;
