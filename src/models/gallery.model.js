const db = require('../database.js');
const users = require('../users.js');

exports.addToGallery = (userId, fractalId, fractalHash, callback) => {
    const sql = "INSERT OR IGNORE INTO gallery (user_id, fractal_id, fractal_hash) VALUES (?, ?, ?)";
    db.run(sql, [userId, fractalId, fractalHash], callback);
};

exports.getGalleryForUser = (userId, filters, sortBy, sortOrder, limit, offset, callback) => {
    let whereClauses = [`g.user_id = ?`];
    let params = [userId];

    if (filters.colorScheme) {
        whereClauses.push(`f.colorScheme = ?`);
        params.push(filters.colorScheme);
    }
    if (filters.power) {
        whereClauses.push(`f.power = ?`);
        params.push(filters.power);
    }
    if (filters.iterations) {
        whereClauses.push(`f.iterations = ?`);
        params.push(filters.iterations);
    }
    if (filters.width) {
        whereClauses.push(`f.width = ?`);
        params.push(filters.width);
    }
    if (filters.height) {
        whereClauses.push(`f.height = ?`);
        params.push(filters.height);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ` + whereClauses.join(` AND `) : ``;

    const validSortColumns = ['id', 'hash', 'width', 'height', 'iterations', 'power', 'c_real', 'c_imag', 'scale', 'offsetX', 'offsetY', 'colorScheme', 'added_at'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'added_at';
    const order = (sortOrder && sortOrder.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

    const countSql = `SELECT COUNT(*) as totalCount FROM gallery g JOIN fractals f ON g.fractal_id = f.id ${whereSql}`;
    db.get(countSql, params, (err, countRow) => {
        if (err) return callback(err);
        const totalCount = countRow.totalCount;

        const dataSql = `
            SELECT g.id, f.hash, f.width, f.height, f.iterations, f.power, f.c_real, f.c_imag, f.scale, f.offsetX, f.offsetY, f.colorScheme, g.added_at, g.fractal_hash
            FROM gallery g
            JOIN fractals f ON g.fractal_id = f.id
            ${whereSql}
            ORDER BY ${sortColumn} ${order}
            LIMIT ? OFFSET ?
        `;
        db.all(dataSql, [...params, limit, offset], (err, rows) => {
            if (err) return callback(err);
            callback(null, rows, totalCount);
        });
    });
};

exports.getGalleryEntry = (id, userId, isAdmin, callback) => {
    let sql;
    let params;
    if (isAdmin) {
        sql = "SELECT fractal_id, fractal_hash FROM gallery WHERE id = ?";
        params = [id];
    } else {
        sql = "SELECT fractal_id, fractal_hash FROM gallery WHERE id = ? AND user_id = ?";
        params = [id, userId];
    }
    db.get(sql, params, callback);
};

exports.deleteGalleryEntry = (id, userId, isAdmin, callback) => {
    let sql;
    let params;
    if (isAdmin) {
        sql = "DELETE FROM gallery WHERE id = ?";
        params = [id];
    } else {
        sql = "DELETE FROM gallery WHERE id = ? AND user_id = ?";
        params = [id, userId];
    }
    db.run(sql, params, callback);
};

exports.countGalleryByFractalHash = (fractalHash, callback) => {
    const sql = "SELECT COUNT(*) as count FROM gallery WHERE fractal_hash = ?";
    db.get(sql, [fractalHash], callback);
};

exports.getAllGallery = (filters, sortBy, sortOrder, limit, offset, callback) => {
    let whereClauses = [];
    let params = [];

    if (filters.colorScheme) {
        whereClauses.push(`f.colorScheme = ?`);
        params.push(filters.colorScheme);
    }
    if (filters.power) {
        whereClauses.push(`f.power = ?`);
        params.push(filters.power);
    }
    if (filters.iterations) {
        whereClauses.push(`f.iterations = ?`);
        params.push(filters.iterations);
    }
    if (filters.width) {
        whereClauses.push(`f.width = ?`);
        params.push(filters.width);
    }
    if (filters.height) {
        whereClauses.push(`f.height = ?`);
        params.push(filters.height);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ` + whereClauses.join(` AND `) : ``;

    const validSortColumns = ['id', 'user_id', 'hash', 'width', 'height', 'iterations', 'power', 'c_real', 'c_imag', 'scale', 'offsetX', 'offsetY', 'colorScheme', 'added_at'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'added_at';
    const order = (sortOrder && sortOrder.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

    const countSql = `SELECT COUNT(*) as totalCount FROM gallery g JOIN fractals f ON g.fractal_id = f.id ${whereSql}`;
    db.get(countSql, params, (err, countRow) => {
        if (err) return callback(err);
        const totalCount = countRow.totalCount;

        const dataSql = `
            SELECT g.id, g.user_id, f.hash, f.width, f.height, f.iterations, f.power, f.c_real, f.c_imag, f.scale, f.offsetX, f.offsetY, f.colorScheme, g.added_at, g.fractal_hash
            FROM gallery g
            JOIN fractals f ON g.fractal_id = f.id
            ${whereSql}
            ORDER BY ${sortColumn} ${order}
            LIMIT ? OFFSET ?
        `;
        db.all(dataSql, [...params, limit, offset], (err, rows) => {
            if (err) return callback(err);
            const galleryWithUsernames = rows.map(row => {
                const user = users.find(u => u.id === row.user_id);
                return { ...row, username: user ? user.username : 'Unknown' };
            });
            callback(null, galleryWithUsernames, totalCount);
        });
    });
};