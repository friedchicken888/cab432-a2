const sqlite3 = require('sqlite3').verbose();

const DBSOURCE = "fractal.db";

const db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        console.error(err.message);
        throw err;
    } else {
        console.log('Connected to the SQLite database.');
        const fractalsTable = `
        CREATE TABLE IF NOT EXISTS fractals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hash TEXT UNIQUE NOT NULL,
            width INTEGER NOT NULL,
            height INTEGER NOT NULL,
            iterations INTEGER NOT NULL,
            power REAL NOT NULL,
            c_real REAL NOT NULL,
            c_imag REAL NOT NULL,
            scale REAL NOT NULL,
            offsetX REAL NOT NULL,
            offsetY REAL NOT NULL,
            colorScheme TEXT NOT NULL,
            image_path TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`;

        const historyTable = `
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            fractal_id INTEGER NOT NULL,
            generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (fractal_id) REFERENCES fractals (id)
        )`;

        const galleryTable = `
        CREATE TABLE IF NOT EXISTS gallery (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            fractal_id INTEGER NOT NULL,
            fractal_hash TEXT NOT NULL,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, fractal_hash),
            FOREIGN KEY (fractal_id) REFERENCES fractals (id)
        )`;

        db.run(fractalsTable, (err) => {
            if (err) {
            } else {
                console.log("Fractals table created");
            }
        });

        db.run(historyTable, (err) => {
            if (err) {
            } else {
                console.log("History table created");
            }
        });

        db.run(galleryTable, (err) => {
            if (err) {
            } else {
                console.log("Gallery table created");
            }
        });
    }
});

module.exports = db;
