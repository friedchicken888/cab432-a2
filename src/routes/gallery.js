const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth.js');
const Gallery = require('../models/gallery.model.js');
const cacheService = require('../services/cacheService');
const s3Service = require('../services/s3Service');

// Helper function to generate a cache key
const generateCacheKey = (userId, filters, sortBy, sortOrder, limit, offset) => {
    return `gallery:${userId}:${JSON.stringify(filters)}:${sortBy}:${sortOrder}:${limit}:${offset}`;
};

router.get('/gallery', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const { limit = 5, offset = 0, sortBy = 'added_at', sortOrder = 'DESC', ...filters } = req.query;

    const cacheKey = generateCacheKey(userId, filters, sortBy, sortOrder, limit, offset);

    try {
        let cachedData = await cacheService.get(cacheKey);
        if (cachedData) {
            return res.json(cachedData);
        }

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

        await cacheService.set(cacheKey, responseData);
        res.json(responseData);

    } catch (error) {
        console.error('Error in /gallery route:', error);
        res.status(500).send('Internal server error');
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
        };

        await cacheService.set(cacheKey, responseData);
        res.json(responseData);

    } catch (error) {
        console.error('Error in /admin/gallery route:', error);
        res.status(500).send('Internal server error');
    }
});

module.exports = router;
