const db = require('../database.js');

exports.findFractalByHash = (hash, callback) => {
    const sql = "SELECT * FROM fractals WHERE hash = ?";
    db.get(sql, [hash], callback);
};

exports.createFractal = (data, callback) => {
    const sql = `INSERT INTO fractals (hash, width, height, iterations, power, c_real, c_imag, scale, offsetX, offsetY, colorScheme, image_path) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [data.hash, data.width, data.height, data.maxIterations, data.power, data.c.real, data.c.imag, data.scale, data.offsetX, data.offsetY, data.colorScheme, data.imagePath];
    db.run(sql, params, function(err) {
        callback(err, { id: this.lastID });
    });
};

exports.getFractalImagePath = (id, callback) => {
    const sql = "SELECT image_path FROM fractals WHERE id = ?";
    db.get(sql, [id], callback);
};

exports.deleteFractal = (id, callback) => {
    const sql = "DELETE FROM fractals WHERE id = ?";
    db.run(sql, [id], callback);
};
