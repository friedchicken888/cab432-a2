const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth.js');
const Gallery = require('../models/gallery.model.js');
const Fractal = require('../models/fractal.model.js');
const cacheService = require('../services/cacheService');
const s3Service = require('../services/s3Service');

const generateCacheKey = (userId, filters, sortBy, sortOrder, limit, offset) => {
    return `gallery:${userId}:${JSON.stringify(filters)}:${sortBy}:${sortOrder}:${limit}:${offset}`;
};

router.get('/gallery', verifyToken, async (req, res) => {
    console.log("DEBUG: Received GET request for /api/gallery");
    const userId = req.user.id;
    const { limit = 5, offset = 0, sortBy = 'added_at', sortOrder = 'DESC', ...filters } = req.query;

    const cacheKey = generateCacheKey(userId, filters, sortBy, sortOrder, limit, offset);

    try {
        console.log(`DEBUG: /api/gallery - Attempting to get from cache with key: ${cacheKey}`);
        let cachedData = await cacheService.get(cacheKey);
        if (cachedData) {
            console.log(`DEBUG: /api/gallery - Cache hit for key: ${cacheKey}`);
            return res.json(cachedData);
        }
        console.log(`DEBUG: /api/gallery - Cache miss for key: ${cacheKey}. Fetching from DB.`);

        const { rows, totalCount } = await Gallery.getGalleryForUser(
            userId,
            filters,
            sortBy,
            sortOrder,
            parseInt(limit),
            parseInt(offset)
        );

        const galleryWithUrls = await Promise.all(rows.map(async (entry) => {
            if (entry.s3_key) {
                entry.url = await s3Service.getPresignedUrl(entry.s3_key);
            }
            return entry;
        }));

        const responseData = {
            data: galleryWithUrls,
            totalCount,
            limit: parseInt(limit),
            offset: parseInt(offset),
        };

        console.log(`DEBUG: /api/gallery - Setting cache for key: ${cacheKey}`);
        await cacheService.set(cacheKey, responseData);
        res.json(responseData);

    } catch (error) {
        console.error('Error in /gallery route:', error);
        res.status(500).send('Internal server error');
    }
});

router.delete('/gallery/:id', verifyToken, async (req, res) => {
    const galleryId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    try {
        const row = await Gallery.getGalleryEntry(galleryId, userId, isAdmin);
        if (!row) {
            if (!isAdmin) {
                return res.status(404).send("Gallery entry not found or you don't have permission to delete it.");
            } else {
                return res.status(404).send("Gallery entry not found.");
            }
        }

        const fractalId = row.fractal_id;
        const fractalHash = row.fractal_hash;

        await Gallery.deleteGalleryEntry(galleryId, userId, isAdmin);

        // Invalidate all possible cache keys for the user's gallery
        // This is a workaround for not having wildcard deletion in cacheService
        const commonFilters = [{}, { colourScheme: 'viridis' }, { power: 2 }, { iterations: 100 }];
        const commonSortBys = ['added_at', 'hash'];
        const commonSortOrders = ['ASC', 'DESC'];
        const commonLimits = [5, 10, 20];
        const commonOffsets = [0, 5, 10];

        for (const filter of commonFilters) {
            for (const sortBy of commonSortBys) {
                for (const sortOrder of commonSortOrders) {
                    for (const limit of commonLimits) {
                        for (const offset of commonOffsets) {
                            const userCacheKey = generateCacheKey(userId, filter, sortBy, sortOrder, limit, offset);
                            await cacheService.del(userCacheKey);
                        }
                    }
                }
            }
        }

        // Invalidate all possible cache keys for the admin gallery
        for (const filter of commonFilters) {
            for (const sortBy of commonSortBys) {
                for (const sortOrder of commonSortOrders) {
                    for (const limit of commonLimits) {
                        for (const offset of commonOffsets) {
                            const adminCacheKey = `admin:gallery:${JSON.stringify(filter)}:${sortBy}:${sortOrder}:${limit}:${offset}`;
                            await cacheService.del(adminCacheKey);
                        }
                    }
                }
            }
        }

        const countRow = await Gallery.countGalleryByFractalHash(fractalHash);

        if (parseInt(countRow.count) === 0) {
            const fractalRow = await Fractal.getFractalS3Key(fractalId);
            if (fractalRow && fractalRow.s3_key) {
                const s3KeyToDelete = fractalRow.s3_key;
                await s3Service.deleteFile(s3KeyToDelete);
                await Fractal.deleteFractal(fractalId);
                res.send({ message: "Gallery entry and associated fractal deleted successfully" });
            } else {
                await Fractal.deleteFractal(fractalId);
                res.send({ message: "Gallery entry and associated fractal deleted successfully" });
            }
        } else {
            res.send({ message: "Gallery entry deleted successfully" });
        }
    } catch (error) {
        console.error(`Error deleting gallery entry ${galleryId}:`, error);
        res.status(500).send("Internal server error");
    }
});

router.get('/admin/gallery', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).send('Access denied. Admin role required.');
    }

    const { limit = 5, offset = 0, sortBy = 'added_at', sortOrder = 'DESC', ...filters } = req.query;

    const cacheKey = `admin:gallery:${JSON.stringify(filters)}:${sortBy}:${sortOrder}:${limit}:${offset}`;

    try {
        let cachedData = await cacheService.get(cacheKey);
        if (cachedData) {
            return res.json(cachedData);
        }

        const { rows, totalCount } = await Gallery.getAllGallery(
            filters,
            sortBy,
            sortOrder,
            parseInt(limit),
            parseInt(offset)
        );

        const galleryWithUrls = await Promise.all(rows.map(async (entry) => {
            if (entry.s3_key) {
                entry.url = await s3Service.getPresignedUrl(entry.s3_key);
            }
            return entry;
        }));

        const responseData = {
            data: galleryWithUrls,
            totalCount,
            limit: parseInt(limit),
            offset: parseInt(offset),
            filters,
            sortBy,
            sortOrder,
        };

        await cacheService.set(cacheKey, responseData);
        res.json(responseData);

    } catch (error) {
        console.error('Error in /admin/gallery route:', error);
        res.status(500).send('Internal server error');
    }
});

module.exports = router;
