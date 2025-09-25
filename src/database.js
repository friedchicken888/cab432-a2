const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.PGHOST || 'database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com',
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'cohort_2025',
    port: process.env.PGPORT || 5432,
    ssl: {
        rejectUnauthorized: false // Required for sslmode=require
    }
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

async function initializeDatabase() {
    try {
        const client = await pool.connect();
        console.log('Connected to PostgreSQL database.');

        const fractalsTable = `
        CREATE TABLE IF NOT EXISTS fractals (
            id SERIAL PRIMARY KEY,
            hash TEXT UNIQUE NOT NULL,
            width INTEGER NOT NULL,
            height INTEGER NOT NULL,
            iterations INTEGER NOT NULL,
            power REAL NOT NULL,
            c_real REAL NOT NULL,
            c_imag REAL NOT NULL,
            scale REAL NOT NULL,
            "offsetX" REAL NOT NULL,
            "offsetY" REAL NOT NULL,
            "colorScheme" TEXT NOT NULL,
            image_path TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`;

        const historyTable = `
        CREATE TABLE IF NOT EXISTS history (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL, /* Added username column */
            fractal_id INTEGER NOT NULL,
            generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (fractal_id) REFERENCES fractals (id) ON DELETE CASCADE
        )`;

        const galleryTable = `
        CREATE TABLE IF NOT EXISTS gallery (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            fractal_id INTEGER NOT NULL,
            fractal_hash TEXT NOT NULL,
            added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, fractal_hash),
            FOREIGN KEY (fractal_id) REFERENCES fractals (id) ON DELETE CASCADE
        )`;

        await client.query(fractalsTable);
        console.log("Fractals table created or already exists.");
        await client.query(historyTable);
        console.log("History table created or already exists.");
        await client.query(galleryTable);
        console.log("Gallery table created or already exists.");

        client.release();
    } catch (err) {
        console.error('Error initializing database:', err.message);
        process.exit(-1);
    }
}

initializeDatabase();

module.exports = {
    query: (text, params, callback) => {
        return pool.query(text, params, callback);
    },
    getClient: () => {
        return pool.connect();
    }
};