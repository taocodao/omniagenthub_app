
import fs from 'fs';
import path from 'path';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

// Ensure db file exists
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}, null, 2));
}

interface LocalDB {
    [key: string]: any;
}

export const readDb = (): LocalDB => {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading DB:', error);
        return {};
    }
};

export const writeDb = (data: LocalDB): void => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error writing to DB:', error);
    }
};

export const getValue = (key: string): any => {
    const db = readDb();
    return db[key];
};

export const setValue = (key: string, value: any): void => {
    const db = readDb();
    db[key] = value;
    writeDb(db);
};
