import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'jukebox.db');

const db = new Database(DB_PATH);
db.prepare("UPDATE users SET role = 'admin'").run();
console.log("✅ All users promoted to admin");
