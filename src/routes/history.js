const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth.js');
const fs = require('fs');
const History = require('../models/history.model.js');
const Fractal = require('../models/fractal.model.js');
const Gallery = require('../models/gallery.model.js');

router.get('/gallery', verifyToken, (req, res) => {
    let limit = parseInt(req.query.limit) || 5; // Default limit to 5
    if (req.user.role !== 'admin') {
        limit = Math.min(limit, 5);
    }
    const offset = parseInt(req.query.offset) || 0; // Default offset to 0

    const filters = {
        colorScheme: req.query.colorScheme,
        power: parseFloat(req.query.power),
        iterations: parseInt(req.query.iterations),
        width: parseInt(req.query.width),
        height: parseInt(req.query.height)
    };

    const sortBy = req.query.sortBy;
    const sortOrder = req.query.sortOrder;

    Gallery.getGalleryForUser(req.user.id, filters, sortBy, sortOrder, limit, offset, (err, rows, totalCount) => {
        if (err) {
            return res.status(500).send("Database error");
        }
        const galleryWithUrls = rows.map(row => {
            const fractalUrl = `${req.protocol}://${req.get('host')}/fractals/${row.hash}.png`;
            return { ...row, url: fractalUrl };
        });
        res.json({ data: galleryWithUrls, totalCount, limit, offset, filters, sortBy, sortOrder });
    });
});

router.delete('/gallery/:id', verifyToken, (req, res) => {
    console.log(`DEBUG: DELETE /gallery/:id endpoint hit for galleryId: ${req.params.id}, userId: ${req.user.id}`);
    const galleryId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    Gallery.getGalleryEntry(galleryId, userId, isAdmin, (err, row) => {
        if (err) {
            console.error(`DEBUG: Error getting gallery entry for galleryId ${galleryId}:`, err);
            return res.status(500).send("Database error");
        }
        if (!row) {
            if (!isAdmin) {
                console.log(`DEBUG: Gallery entry ${galleryId} not found or no permission for user ${userId}.`);
                return res.status(404).send("Gallery entry not found or you don't have permission to delete it.");
            } else {
                console.log(`DEBUG: Gallery entry ${galleryId} not found (admin context).`);
                return res.status(404).send("Gallery entry not found.");
            }
        }

        const fractalId = row.fractal_id;
        const fractalHash = row.fractal_hash;
        console.log(`DEBUG: Found fractalId: ${fractalId}, fractalHash: ${fractalHash} for galleryId: ${galleryId}`);

        Gallery.deleteGalleryEntry(galleryId, userId, isAdmin, function (err) {
            if (err) {
                console.error(`DEBUG: Error deleting gallery entry ${galleryId} from DB:`, err);
                return res.status(500).send("Database error");
            }
            console.log(`DEBUG: Gallery entry ${galleryId} successfully deleted from DB.`);

            Gallery.countGalleryByFractalHash(fractalHash, (err, countRow) => {
                if (err) {
                    console.error(`DEBUG: Error checking for other fractal galleries for hash ${fractalHash}:`, err);
                    return res.status(500).send("Database error during fractal count check.");
                }
                console.log(`DEBUG: Count of other gallery references for fractalHash ${fractalHash}: ${countRow.count}`);

                if (countRow.count === 0) {
                    console.log(`DEBUG: Fractal with hash ${fractalHash} has no more gallery references. Attempting to delete image and fractal record.`);
                    Fractal.getFractalImagePath(fractalId, (err, fractalRow) => {
                        if (err) {
                            console.error(`DEBUG: Error getting image path for fractalId ${fractalId}:`, err);
                            return res.status(500).send("Database error during image path retrieval.");
                        }
                        if (fractalRow && fractalRow.image_path) {
                            const imagePathToDelete = fractalRow.image_path;
                            console.log(`DEBUG: Attempting to delete image file: ${imagePathToDelete}`);
                            fs.unlink(imagePathToDelete, (unlinkErr) => {
                                if (unlinkErr) {
                                    console.error(`DEBUG: Error deleting image file ${imagePathToDelete}:`, unlinkErr);
                                    // Continue to delete fractal record even if image deletion fails
                                } else {
                                    console.log(`DEBUG: Successfully deleted image file: ${imagePathToDelete}`);
                                }
                                Fractal.deleteFractal(fractalId, (deleteFractalErr) => {
                                    if (deleteFractalErr) {
                                        console.error(`DEBUG: Error deleting fractal record for ID ${fractalId}:`, deleteFractalErr);
                                        return res.status(500).send("Database error during fractal record deletion.");
                                    } else {
                                        console.log(`DEBUG: Successfully deleted fractal record for ID: ${fractalId}`);
                                        res.send({ message: "Gallery entry and associated fractal deleted successfully" });
                                    }
                                });
                            });
                        } else {
                            console.log(`DEBUG: No image path found for fractalId ${fractalId}. Deleting fractal record only.`);
                            // If no image path found, still delete fractal record if it exists
                            Fractal.deleteFractal(fractalId, (deleteFractalErr) => {
                                if (deleteFractalErr) {
                                    console.error(`DEBUG: Error deleting fractal record when image path not found for ID ${fractalId}:`, deleteFractalErr);
                                    return res.status(500).send("Database error during fractal record deletion.");
                                } else {
                                    console.log(`DEBUG: Successfully deleted fractal record for ID: ${fractalId} (image path not found).`);
                                    res.send({ message: "Gallery entry and associated fractal deleted successfully" });
                                }
                            });
                        }
                    });
                } else {
                    console.log(`DEBUG: Fractal with hash ${fractalHash} still has ${countRow.count} other gallery references. Image file not deleted.`);
                    res.send({ message: "Gallery entry deleted successfully" });
                }
            });
        });
    });
});

router.get('/admin/history', verifyToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).send('Access denied. Admin privileges required.');
    }

    let limit = parseInt(req.query.limit) || 5;
    if (req.user.role !== 'admin') {
        limit = Math.min(limit, 5);
    }
    const offset = parseInt(req.query.offset) || 0;

    const filters = {
        colorScheme: req.query.colorScheme,
        power: parseFloat(req.query.power),
        iterations: parseInt(req.query.iterations),
        width: parseInt(req.query.width),
        height: parseInt(req.query.height)
    };

    const sortBy = req.query.sortBy;
    const sortOrder = req.query.sortOrder;

    History.getAllHistory(filters, sortBy, sortOrder, limit, offset, (err, rows, totalCount) => {
        if (err) {
            return res.status(500).send("Database error");
        }
        const historyWithUrls = rows.map(row => {
            const fractalUrl = `${req.protocol}://${req.get('host')}/fractals/${row.hash}.png`;
            return { ...row, url: fractalUrl };
        });
        res.json({ data: historyWithUrls, totalCount, limit, offset, filters, sortBy, sortOrder });
    });
});

router.get('/admin/gallery', verifyToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).send('Access denied. Admin privileges required.');
    }

    let limit = parseInt(req.query.limit) || 5;
    if (req.user.role !== 'admin') {
        limit = Math.min(limit, 5);
    }
    const offset = parseInt(req.query.offset) || 0;

    const filters = {
        colorScheme: req.query.colorScheme,
        power: parseFloat(req.query.power),
        iterations: parseInt(req.query.iterations),
        width: parseInt(req.query.width),
        height: parseInt(req.query.height)
    };

    const sortBy = req.query.sortBy;
    const sortOrder = req.query.sortOrder;

    Gallery.getAllGallery(filters, sortBy, sortOrder, limit, offset, (err, rows, totalCount) => {
        if (err) {
            return res.status(500).send("Database error");
        }
        const galleryWithUrls = rows.map(row => {
            const fractalUrl = `${req.protocol}://${req.get('host')}/fractals/${row.hash}.png`;
            return { ...row, url: fractalUrl };
        });
        res.json({ data: galleryWithUrls, totalCount, limit, offset, filters, sortBy, sortOrder });
    });
});

module.exports = router;
