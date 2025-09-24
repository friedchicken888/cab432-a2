const db = require('../database.js');
const users = require('../users.js');

exports.getHistoryForUser = (userId, callback) => {
    const sql = `
        SELECT h.id, f.hash, f.width, f.height, f.iterations, f.power, f.c_real, f.c_imag, f.scale, f.offsetX, f.offsetY, f.colorScheme, h.generated_at
        FROM history h
        JOIN fractals f ON h.fractal_id = f.id
        WHERE h.user_id = ?
        ORDER BY h.generated_at DESC
    `;
    db.all(sql, [userId], callback);
};

exports.createHistoryEntry = (userId, fractalId, callback) => {
    const sql = "INSERT INTO history (user_id, fractal_id) VALUES (?, ?)";
    db.run(sql, [userId, fractalId], callback);
};

exports.getHistoryEntry = (id, userId, callback) => {
    const sql = "SELECT fractal_id FROM history WHERE id = ? AND user_id = ?";
    db.get(sql, [id, userId], callback);
};

exports.deleteHistoryEntry = (id, callback) => {
    const sql = "DELETE FROM history WHERE id = ?";
    db.run(sql, [id], callback);
};

exports.countHistoryByFractalId = (fractalId, callback) => {
    const sql = "SELECT COUNT(*) as count FROM history WHERE fractal_id = ?";
    db.get(sql, [fractalId], callback);
};

exports.getAllHistory = (filters, sortBy, sortOrder, limit, offset, callback) => {
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

    const validSortColumns = ['id', 'hash', 'width', 'height', 'iterations', 'power', 'c_real', 'c_imag', 'scale', 'offsetX', 'offsetY', 'colorScheme', 'generated_at', 'user_id'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'generated_at';
    const order = (sortOrder && sortOrder.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

    const countSql = `SELECT COUNT(*) as totalCount FROM history h LEFT JOIN fractals f ON h.fractal_id = f.id ${whereSql}`;
    db.get(countSql, params, (err, countRow) => {
        if (err) return callback(err);
        const totalCount = countRow.totalCount;

        const dataSql = `
            SELECT h.id, h.user_id, f.hash, f.width, f.height, f.iterations, f.power, f.c_real, f.c_imag, f.scale, f.offsetX, f.offsetY, f.colorScheme, h.generated_at
            FROM history h
            LEFT JOIN fractals f ON h.fractal_id = f.id
            ${whereSql}
            ORDER BY ${sortColumn} ${order}
            LIMIT ? OFFSET ?
        `;
        db.all(dataSql, [...params, limit, offset], (err, rows) => {
            if (err) return callback(err);
            const historyWithUsernames = rows.map(row => {
                const user = users.find(u => u.id === row.user_id);
                return { ...row, username: user ? user.username : 'Unknown' };
            });
            callback(null, historyWithUsernames, totalCount);
        });
    });
};