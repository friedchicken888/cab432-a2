const db = require('../database.js');

exports.findFractalByHash = (hash, callback) => {
    const sql = "SELECT id, hash, width, height, iterations, power, c_real, c_imag, scale, \"offsetX\", \"offsetY\", \"colorScheme\", s3_key FROM fractals WHERE hash = $1";
    db.query(sql, [hash], (err, result) => {
        if (err) return callback(err);
        callback(null, result.rows[0]);
    });
};

exports.createFractal = (data, callback) => {
    const sql = `INSERT INTO fractals (hash, width, height, iterations, power, c_real, c_imag, scale, "offsetX", "offsetY", "colorScheme", s3_key) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`;
    const params = [data.hash, data.width, data.height, data.maxIterations, data.power, data.c.real, data.c.imag, data.scale, data.offsetX, data.offsetY, data.colorScheme, data.s3Key];
    db.query(sql, params, (err, result) => {
        if (err) return callback(err);
        callback(null, { id: result.rows[0].id });
    });
};

exports.getFractalS3Key = (id, callback) => {
    const sql = "SELECT s3_key FROM fractals WHERE id = $1";
    db.query(sql, [id], (err, result) => {
        if (err) return callback(err);
        callback(null, result.rows[0]);
    });
};

exports.deleteFractal = (id, callback) => {
    const sql = "DELETE FROM fractals WHERE id = $1";
    db.query(sql, [id], callback);
};
