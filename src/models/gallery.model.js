const db = require('../database.js');

exports.addToGallery = (userId, fractalId, fractalHash, callback) => {
    const insertSql = "INSERT INTO gallery (user_id, fractal_id, fractal_hash) VALUES ($1, $2, $3) ON CONFLICT (user_id, fractal_hash) DO NOTHING";
    db.query(insertSql, [userId, fractalId, fractalHash], (err) => {
        if (err) return callback(err);
        // After attempting insert, retrieve the gallery ID for the given user and fractal hash
        const selectSql = "SELECT id FROM gallery WHERE user_id = $1 AND fractal_hash = $2";
        db.query(selectSql, [userId, fractalHash], (err, result) => {
            if (err) return callback(err);
            callback(null, result.rows[0].id); // Return the gallery ID
        });
    });
};

exports.getGalleryForUser = (userId, filters, sortBy, sortOrder, limit, offset, callback) => {
    let whereClauses = [`g.user_id = $1`];
    let params = [userId];
    let paramIndex = 2;

    if (filters.colorScheme) {
        whereClauses.push(`f."colorScheme" = $${paramIndex++}`);
        params.push(filters.colorScheme);
    }
    if (filters.power) {
        whereClauses.push(`f.power = $${paramIndex++}`);
        params.push(filters.power);
    }
    if (filters.iterations) {
        whereClauses.push(`f.iterations = $${paramIndex++}`);
        params.push(filters.iterations);
    }
    if (filters.width) {
        whereClauses.push(`f.width = $${paramIndex++}`);
        params.push(filters.width);
    }
    if (filters.height) {
        whereClauses.push(`f.height = $${paramIndex++}`);
        params.push(filters.height);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ` + whereClauses.join(` AND `) : ``;

    const validSortColumns = ['id', 'hash', 'width', 'height', 'iterations', 'power', 'c_real', 'c_imag', 'scale', 'offsetX', 'offsetY', 'colorScheme', 'added_at'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'added_at';
    const order = (sortOrder && sortOrder.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

    const countSql = `SELECT COUNT(*) as "totalCount" FROM gallery g JOIN fractals f ON g.fractal_id = f.id ${whereSql}`;
    db.query(countSql, params, (err, countResult) => {
        if (err) return callback(err);
        const totalCount = countResult.rows[0].totalCount;

        const dataSql = `
            SELECT g.id, f.hash, f.width, f.height, f.iterations, f.power, f.c_real, f.c_imag, f.scale, f."offsetX", f."offsetY", f."colorScheme", g.added_at, g.fractal_hash
            FROM gallery g
            JOIN fractals f ON g.fractal_id = f.id
            ${whereSql}
            ORDER BY ${sortColumn} ${order}
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
        db.query(dataSql, [...params, limit, offset], (err, dataResult) => {
            if (err) return callback(err);
            callback(null, dataResult.rows, totalCount);
        });
    });
};

exports.getGalleryEntry = (id, userId, isAdmin, callback) => {
    let sql;
    let params;
    if (isAdmin) {
        sql = "SELECT fractal_id, fractal_hash FROM gallery WHERE id = $1";
        params = [id];
    } else {
        sql = "SELECT fractal_id, fractal_hash FROM gallery WHERE id = $1 AND user_id = $2";
        params = [id, userId];
    }
    db.query(sql, params, (err, result) => {
        if (err) return callback(err);
        callback(null, result.rows[0]);
    });
};

exports.deleteGalleryEntry = (id, userId, isAdmin, callback) => {
    let sql;
    let params;
    if (isAdmin) {
        sql = "DELETE FROM gallery WHERE id = $1";
        params = [id];
    } else {
        sql = "DELETE FROM gallery WHERE id = $1 AND user_id = $2";
        params = [id, userId];
    }
    db.query(sql, params, callback);
};

exports.countGalleryByFractalHash = (fractalHash, callback) => {
    const sql = "SELECT COUNT(*) as count FROM gallery WHERE fractal_hash = $1";
    db.query(sql, [fractalHash], (err, result) => {
        if (err) return callback(err);
        callback(null, result.rows[0]);
    });
};

exports.findGalleryEntryByFractalHashAndUserId = (userId, fractalHash, callback) => {
    const sql = "SELECT id FROM gallery WHERE user_id = $1 AND fractal_hash = $2";
    db.query(sql, [userId, fractalHash], (err, result) => {
        if (err) return callback(err);
        callback(null, result.rows[0]);
    });
};

exports.getAllGallery = (filters, sortBy, sortOrder, limit, offset, callback) => {
    let whereClauses = [];
    let params = [];
    let paramIndex = 1;

    if (filters.colorScheme) {
        whereClauses.push(`f."colorScheme" = $${paramIndex++}`);
        params.push(filters.colorScheme);
    }
    if (filters.power) {
        whereClauses.push(`f.power = $${paramIndex++}`);
        params.push(filters.power);
    }
    if (filters.iterations) {
        whereClauses.push(`f.iterations = $${paramIndex++}`);
        params.push(filters.iterations);
    }
    if (filters.width) {
        whereClauses.push(`f.width = $${paramIndex++}`);
        params.push(filters.width);
    }
    if (filters.height) {
        whereClauses.push(`f.height = $${paramIndex++}`);
        params.push(filters.height);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ` + whereClauses.join(` AND `) : ``;

    const validSortColumns = ['id', 'user_id', 'hash', 'width', 'height', 'iterations', 'power', 'c_real', 'c_imag', 'scale', 'offsetX', 'offsetY', 'colorScheme', 'added_at'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'added_at';
    const order = (sortOrder && sortOrder.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

    const countSql = `SELECT COUNT(*) as "totalCount" FROM gallery g JOIN fractals f ON g.fractal_id = f.id ${whereSql}`;
    db.query(countSql, params, (err, countResult) => {
        if (err) return callback(err);
        const totalCount = countResult.rows[0].totalCount;

        const dataSql = `
            SELECT g.id, g.user_id, f.hash, f.width, f.height, f.iterations, f.power, f.c_real, f.c_imag, f.scale, f."offsetX", f."offsetY", f."colorScheme", g.added_at, g.fractal_hash
            FROM gallery g
            JOIN fractals f ON g.fractal_id = f.id
            ${whereSql}
            ORDER BY ${sortColumn} ${order}
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
        db.query(dataSql, [...params, limit, offset], (err, dataResult) => {
            if (err) return callback(err);
            callback(null, dataResult.rows, totalCount);
        });
    });
};