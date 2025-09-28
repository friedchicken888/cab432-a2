const express = require('express');
const router = express.Router();
const { generateFractal } = require('../fractal');
const crypto = require('crypto');
const { verifyToken } = require('./auth.js');
const Fractal = require('../models/fractal.model.js');
const History = require('../models/history.model.js');
const Gallery = require('../models/gallery.model.js');
const s3Service = require('../services/s3Service');
const cacheService = require('../services/cacheService');

// Helper function to generate a consistent cache key for gallery entries
const generateCacheKey = (userId, filters, sortBy, sortOrder, limit, offset) => {
    const filterString = JSON.stringify(filters || {});
    const actualLimit = limit !== undefined ? limit : '';
    const actualOffset = offset !== undefined ? offset : '';
    return `gallery:${userId}:${filterString}:${sortBy || ''}:${sortOrder || ''}:${actualLimit}:${actualOffset}`;
};

let isGenerating = false;

router.get('/fractal', verifyToken, async (req, res) => {
    if (isGenerating) {
        return res.status(429).send('Another fractal is currently generating. Try again later.');
    }

    const options = {
        width: parseInt(req.query.width) || 1920,
        height: parseInt(req.query.height) || 1080,
        maxIterations: parseInt(req.query.iterations) || 500,
        power: parseFloat(req.query.power) || 2,
        c: {
            real: parseFloat(req.query.real) || 0.285,
            imag: parseFloat(req.query.imag) || 0.01
        },
        scale: parseFloat(req.query.scale) || 1,
        offsetX: parseFloat(req.query.offsetX) || 0,
        offsetY: parseFloat(req.query.offsetY) || 0,
        colourScheme: req.query.color || 'rainbow',
    };

    const hash = crypto.createHash('sha256').update(JSON.stringify(options)).digest('hex');

    try {
        let row = await Fractal.findFractalByHash(hash);

        if (row) {


            let galleryEntry = await Gallery.findGalleryEntryByFractalHashAndUserId(req.user.id, row.hash);

            let galleryId;
            if (galleryEntry) {
                galleryId = galleryEntry.id;
            } else {
                galleryId = await Gallery.addToGallery(req.user.id, row.id, row.hash);
                // Invalidate the default cache key for the user's gallery
                const userCacheKey = generateCacheKey(req.user.id, {}, 'added_at', 'DESC', 5, 0);
                await cacheService.del(userCacheKey);

                // Invalidate the default cache key for the admin gallery
                const adminCacheKey = `admin:gallery:${JSON.stringify({})}:added_at:DESC:5:0`;
                await cacheService.del(adminCacheKey);
            }

            const fractalUrl = await s3Service.getPresignedUrl(row.s3_key);
            return res.json({ hash: row.hash, url: fractalUrl, galleryId: galleryId });

        } else {
            // Fractal not found, generate a new one
            isGenerating = true;
            let buffer;
            try {
                buffer = await generateFractal(options);
            } catch (err) {

                return res.status(500).send('Fractal generation failed');
            } finally {
                isGenerating = false;
            }

            if (!buffer) {
                return res.status(499).send('Fractal generation aborted due to time limit.');
            }

            let s3Key;
            try {
                s3Key = await s3Service.uploadFile(buffer, 'image/png', 'fractals');
            } catch (uploadErr) {

                return res.status(500).send("Failed to upload fractal image.");
            }

            const fractalData = { ...options, hash, s3Key };

            const result = await Fractal.createFractal(fractalData);
            console.log("DEBUG: Result from Fractal.createFractal:", result);

            await History.createHistoryEntry(req.user.id, req.user.username, result.id);

            const newGalleryId = await Gallery.addToGallery(req.user.id, result.id, hash);
            // Invalidate the default cache key for the user's gallery
            const userCacheKey = generateCacheKey(req.user.id, {}, 'added_at', 'DESC', 5, 0);
            await cacheService.del(userCacheKey);

            // Invalidate the default cache key for the admin gallery
            const adminCacheKey = `admin:gallery:${JSON.stringify({})}:added_at:DESC:5:0`;
            await cacheService.del(adminCacheKey);

            const fractalUrl = await s3Service.getPresignedUrl(s3Key);
            res.json({ hash, url: fractalUrl, galleryId: newGalleryId });
        }
    } catch (error) {
        console.error("Error in /fractal route:", error);
        res.status(500).send("Internal server error");
    }
});

module.exports = router;