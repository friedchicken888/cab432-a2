const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth.js');
const History = require('../models/history.model.js');
const Fractal = require('../models/fractal.model.js');
const Gallery = require('../models/gallery.model.js');
const s3Service = require('../services/s3Service');

router.get('/gallery', verifyToken, async (req, res) => {
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

    Gallery.getGalleryForUser(req.user.id, filters, sortBy, sortOrder, limit, offset, async (err, rows, totalCount) => {
        if (err) {
            return res.status(500).send("Database error");
        }
        const galleryWithUrls = await Promise.all(rows.map(async row => {
            const fractalUrl = row.s3_key ? await s3Service.getPresignedUrl(row.s3_key) : null;
            return { ...row, url: fractalUrl };
        }));
        res.json({ data: galleryWithUrls, totalCount, limit, offset, filters, sortBy, sortOrder });
    });
});

router.delete('/gallery/:id', verifyToken, (req, res) => {
    const galleryId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    Gallery.getGalleryEntry(galleryId, userId, isAdmin, (err, row) => {
        if (err) {
            console.error(`Error getting gallery entry for galleryId ${galleryId}:`, err);
            return res.status(500).send("Database error");
        }
        if (!row) {
            if (!isAdmin) {
                return res.status(404).send("Gallery entry not found or you don't have permission to delete it.");
            } else {
                return res.status(404).send("Gallery entry not found.");
            }
        }

        const fractalId = row.fractal_id;
        const fractalHash = row.fractal_hash;

        Gallery.deleteGalleryEntry(galleryId, userId, isAdmin, function (err) {
            if (err) {
                console.error(`Error deleting gallery entry ${galleryId} from DB:`, err);
                return res.status(500).send("Database error");
            }

            Gallery.countGalleryByFractalHash(fractalHash, (err, countRow) => {
                if (err) {
                    console.error(`Error checking for other fractal galleries for hash ${fractalHash}:`, err);
                    return res.status(500).send("Database error during fractal count check.");
                }

                if (parseInt(countRow.count) === 0) {
                    Fractal.getFractalS3Key(fractalId, (err, fractalRow) => {
                        if (err) {
                            console.error(`Error getting S3 key for fractalId ${fractalId}:`, err);
                            return res.status(500).send("Database error during S3 key retrieval.");
                        }
                        if (fractalRow && fractalRow.s3_key) {
                            const s3KeyToDelete = fractalRow.s3_key;
                            s3Service.deleteFile(s3KeyToDelete).then(() => {
                                Fractal.deleteFractal(fractalId, (deleteFractalErr) => {
                                    if (deleteFractalErr) {
                                        console.error(`Error deleting fractal record for ID ${fractalId}:`, deleteFractalErr);
                                        return res.status(500).send("Database error during fractal record deletion.");
                                    } else {
                                        res.send({ message: "Gallery entry and associated fractal deleted successfully" });
                                    }
                                });
                            });
                        } else {
                            Fractal.deleteFractal(fractalId, (deleteFractalErr) => {
                                if (deleteFractalErr) {
                                    console.error(`Error deleting fractal record when image path not found for ID ${fractalId}:`, deleteFractalErr);
                                    return res.status(500).send("Database error during fractal record deletion.");
                                } else {
                                    res.send({ message: "Gallery entry and associated fractal deleted successfully" });
                                }
                            });
                        }
                    });
                } else {
                    res.send({ message: "Gallery entry deleted successfully" });
                }
            });
        });
    });
});

router.get('/admin/history', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
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

    History.getAllHistory(filters, sortBy, sortOrder, limit, offset, async (err, rows, totalCount) => {
        if (err) {
            return res.status(500).send("Database error");
        }
        const historyWithUrls = await Promise.all(rows.map(async row => {
            const fractalUrl = row.s3_key ? await s3Service.getPresignedUrl(row.s3_key) : null;
            return { ...row, url: fractalUrl };
        }));
        res.json({ data: historyWithUrls, totalCount, limit, offset, filters, sortBy, sortOrder });
    });
});

router.get('/admin/gallery', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
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

    Gallery.getAllGallery(filters, sortBy, sortOrder, limit, offset, async (err, rows, totalCount) => {
        if (err) {
            return res.status(500).send("Database error");
        }
        const galleryWithUrls = await Promise.all(rows.map(async row => {
            const fractalUrl = row.s3_key ? await s3Service.getPresignedUrl(row.s3_key) : null;
            return { ...row, url: fractalUrl };
        }));
        res.json({ data: galleryWithUrls, totalCount, limit, offset, filters, sortBy, sortOrder });
    });
});

module.exports = router;
