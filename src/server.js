import 'dotenv/config';
import { createApp } from './app.js';
import { connectDb } from './config/db.js';

const port = Number(process.env.PORT) || 5100;

await connectDb(process.env.MONGO_URI);
const app = createApp();
app.listen(port, () => console.log(`EduNest API running on http://localhost:${port}`));
