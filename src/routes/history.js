const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth.js');
const History = require('../models/history.model.js');
const Fractal = require('../models/fractal.model.js');
const Gallery = require('../models/gallery.model.js');
const s3Service = require('../services/s3Service');

router.get('/admin/history', verifyToken, async (req, res) => {
    console.log("DEBUG: Received GET request for /api/admin/history");
    if (req.user.role !== 'admin') {
        console.log("DEBUG: Access denied for non-admin user to /api/admin/history");
        return res.status(403).send('Access denied. Admin privileges required.');
    }

    let limit = parseInt(req.query.limit) || 5;
    if (req.user.role !== 'admin') {
        limit = Math.min(limit, 5);
    }
    const offset = parseInt(req.query.offset) || 0;

    const filters = {
        colourScheme: req.query.colourScheme,
        power: parseFloat(req.query.power),
        iterations: parseInt(req.query.iterations),
        width: parseInt(req.query.width),
        height: parseInt(req.query.height)
    };

    const sortBy = req.query.sortBy;
    const sortOrder = req.query.sortOrder;

    console.log("DEBUG: Calling History.getAllHistory...");
    try {
        const { rows, totalCount } = await History.getAllHistory(filters, sortBy, sortOrder, limit, offset);
        console.log(`DEBUG: History.getAllHistory returned ${rows.length} rows. Total: ${totalCount}`);
        const historyWithUrls = await Promise.all(rows.map(async row => {
            const fractalUrl = row.s3_key ? await s3Service.getPresignedUrl(row.s3_key) : null;
            return { ...row, url: fractalUrl };
        }));
        res.json({ data: historyWithUrls, totalCount, limit, offset, filters, sortBy, sortOrder });
    } catch (err) {
        console.error("DEBUG: Error from History.getAllHistory:", err);
        return res.status(500).send("Database error");
    }
});

module.exports = router;
