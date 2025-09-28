const db = require('../database.js');
const cacheService = require('../services/cacheService');

exports.findFractalByHash = async (hash) => {
    console.log("DEBUG: findFractalByHash - Searching for hash:", hash);
    const cacheKey = `fractal:hash:${hash}`;
    let cachedFractal = await cacheService.get(cacheKey);

    if (cachedFractal) {
        console.log("DEBUG: findFractalByHash - Cache hit for hash:", hash, ", cachedFractal.id:", cachedFractal.id);
        // Verify if the cached fractal still exists in the database
        const dbFractal = await exports.getFractalById(cachedFractal.id);
        if (dbFractal) {
            console.log("DEBUG: findFractalByHash - Cached fractal verified in DB.");
            return dbFractal; // Cached entry is valid and exists in DB
        } else {
            // Cached entry is stale, remove it
            console.log("DEBUG: findFractalByHash - Cached fractal is stale, removing from cache.");
            await cacheService.del(cacheKey);
            cachedFractal = null; // Force DB lookup
        }
    }

    // If not in cache, or cache was stale, query the database
    return new Promise((resolve, reject) => {
        const sql = "SELECT id, hash, width, height, iterations, power, c_real, c_imag, scale, \"offsetX\", \"offsetY\", \"colourScheme\", s3_key FROM fractals WHERE hash = $1";
        db.query(sql, [hash], (err, result) => {
            if (err) return reject(err);
            const fractal = result.rows[0];
            if (fractal) {
                console.log("DEBUG: findFractalByHash - Found in DB, id:", fractal.id);
                cacheService.set(cacheKey, fractal, 3600);
            } else {
                console.log("DEBUG: findFractalByHash - Not found in DB.");
            }
            resolve(fractal);
        });
    });
};

exports.createFractal = (data) => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO fractals (hash, width, height, iterations, power, c_real, c_imag, scale, "offsetX", "offsetY", "colourScheme", s3_key) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`;
        const params = [data.hash, data.width, data.height, data.maxIterations, data.power, data.c.real, data.c.imag, data.scale, data.offsetX, data.offsetY, data.colourScheme, data.s3Key];
        db.query(sql, params, (err, result) => {
            if (err) return reject(err);
            const newFractalId = result.rows[0].id;
            cacheService.del(`fractal:hash:${data.hash}`); // Invalidate cache for this hash
            resolve({ id: newFractalId });
        });
    });
};

exports.getFractalS3Key = async (id) => {
    const cacheKey = `fractal:id:${id}:s3key`;
    const cachedS3Key = await cacheService.get(cacheKey);
    if (cachedS3Key) {
        return cachedS3Key;
    }

    return new Promise((resolve, reject) => {
        const sql = "SELECT s3_key FROM fractals WHERE id = $1";
        db.query(sql, [id], (err, result) => {
            if (err) return reject(err);
            const s3Key = result.rows[0];
            if (s3Key) {
                cacheService.set(cacheKey, s3Key, 3600);
            }
            resolve(s3Key);
        });
    });
};

exports.deleteFractal = async (id) => {
    return new Promise((resolve, reject) => {
        const sql = "DELETE FROM fractals WHERE id = $1";
        db.query(sql, [id], (err, result) => {
            if (err) return reject(err);
            cacheService.del(`fractal:id:${id}:s3key`);
            resolve(result);
        });
    });
};

exports.getFractalById = (id) => {
    return new Promise((resolve, reject) => {
        const sql = "SELECT id, hash, width, height, iterations, power, c_real, c_imag, scale, \"offsetX\", \"offsetY\", \"colourScheme\", s3_key FROM fractals WHERE id = $1";
        db.query(sql, [id], (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0]);
        });
    });
};