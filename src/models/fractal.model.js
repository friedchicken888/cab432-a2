const db = require('../database.js');
const cacheService = require('../services/cacheService');

exports.findFractalByHash = async (hash) => {
    const cacheKey = `fractal:hash:${hash}`;
    const cachedFractal = await cacheService.get(cacheKey);
    if (cachedFractal) {
        return cachedFractal;
    }

    return new Promise((resolve, reject) => {
        const sql = "SELECT id, hash, width, height, iterations, power, c_real, c_imag, scale, \"offsetX\", \"offsetY\", \"colourScheme\", s3_key FROM fractals WHERE hash = $1";
        db.query(sql, [hash], (err, result) => {
            if (err) return reject(err);
            const fractal = result.rows[0];
            if (fractal) {
                cacheService.set(cacheKey, fractal, 3600);
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
            resolve({ id: result.rows[0].id });
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
            // Invalidate cache entries
            cacheService.del(`fractal:id:${id}:s3key`);
            // Note: We don't have the hash here, so we can't invalidate fractal:hash:${hash}
            // If needed, we'd fetch the fractal by ID first to get its hash before deleting.
            resolve(result);
        });
    });
};