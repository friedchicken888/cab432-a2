const db = require('../database.js');

exports.findFractalByHash = (hash, callback) => {
    const sql = "SELECT * FROM fractals WHERE hash = $1";
    db.query(sql, [hash], (err, result) => {
        if (err) return callback(err);
        callback(null, result.rows[0]);
    });
};

exports.createFractal = (data, callback) => {
    const sql = `INSERT INTO fractals (hash, width, height, iterations, power, c_real, c_imag, scale, "offsetX", "offsetY", "colorScheme", image_path) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`;
    const params = [data.hash, data.width, data.height, data.maxIterations, data.power, data.c.real, data.c.imag, data.scale, data.offsetX, data.offsetY, data.colorScheme, data.imagePath];
    db.query(sql, params, (err, result) => {
        if (err) return callback(err);
        callback(null, { id: result.rows[0].id });
    });
};

exports.getFractalImagePath = (id, callback) => {
    const sql = "SELECT image_path FROM fractals WHERE id = $1";
    db.query(sql, [id], (err, result) => {
        if (err) return callback(err);
        callback(null, result.rows[0]);
    });
};

exports.deleteFractal = (id, callback) => {
    const sql = "DELETE FROM fractals WHERE id = $1";
    db.query(sql, [id], callback);
};
