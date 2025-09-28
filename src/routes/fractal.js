const express = require('express');
const router = express.Router();
const { generateFractal } = require('../fractal');
const crypto = require('crypto');
const { verifyToken } = require('./auth.js');
const Fractal = require('../models/fractal.model.js');
const History = require('../models/history.model.js');
const Gallery = require('../models/gallery.model.js');
const s3Service = require('../services/s3Service');

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
        console.log(`DEBUG: /fractal - User ID: ${req.user.id}`);
        console.log(`DEBUG: /fractal - Fractal hash: ${hash}`);
        let row = await Fractal.findFractalByHash(hash);

        if (row) {
            console.log(`DEBUG: /fractal - Existing fractal found with ID: ${row.id}`);
            // Verify that the fractal_id actually exists in the fractals table
            const dbFractal = await Fractal.getFractalById(row.id);
            if (!dbFractal) {
                console.warn(`WARN: Cached fractal ID ${row.id} not found in database. Treating as new fractal.`);
                // Invalidate the stale cache entry
                await cacheService.del(`fractal:hash:${hash}`);
                row = null; // Treat as if fractal was not found
            }
        }

        if (row) {
            console.log(`DEBUG: /fractal - Proceeding with existing fractal ID: ${row.id}`);
            // Fractal found in DB (or cache)
            await History.createHistoryEntry(req.user.id, req.user.username, row.id);

            let galleryEntry = await Gallery.findGalleryEntryByFractalHashAndUserId(req.user.id, row.hash);
            console.log(`DEBUG: /fractal - Existing gallery entry found: ${JSON.stringify(galleryEntry)}`);

            let galleryId;
            if (galleryEntry) {
                galleryId = galleryEntry.id;
            } else {
                console.log(`DEBUG: /fractal - Adding existing fractal to gallery for user.`);
                galleryId = await Gallery.addToGallery(req.user.id, row.id, row.hash);
                console.log(`DEBUG: /fractal - Added existing fractal to gallery with ID: ${galleryId}`);
                // Invalidate all possible cache keys for the user's gallery
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
                                    const userCacheKey = generateCacheKey(req.user.id, filter, sortBy, sortOrder, limit, offset);
                                    await cacheService.del(userCacheKey);
                                }
                            }
                        }
                    }
                }
            }

            const fractalUrl = await s3Service.getPresignedUrl(row.s3_key);
            return res.json({ hash: row.hash, url: fractalUrl, galleryId: galleryId });

        } else {
            console.log(`DEBUG: /fractal - Fractal not found or invalid. Generating new one.`);
            // Fractal not found, generate a new one
            isGenerating = true;
            let buffer;
            try {
                buffer = await generateFractal(options);
            } catch (err) {
                console.error(err);
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
                console.error("Error uploading fractal to S3:", uploadErr);
                return res.status(500).send("Failed to upload fractal image.");
            }

            const fractalData = { ...options, hash, s3Key };

            const result = await Fractal.createFractal(fractalData);
            console.log(`DEBUG: /fractal - New fractal created with ID: ${result.id}`);

            await History.createHistoryEntry(req.user.id, req.user.username, result.id);

            console.log(`DEBUG: /fractal - Adding new fractal to gallery for user.`);
            const newGalleryId = await Gallery.addToGallery(req.user.id, result.id, hash);
            console.log(`DEBUG: /fractal - Added new fractal to gallery with ID: ${newGalleryId}`);
            // Invalidate all possible cache keys for the user's gallery
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
                                const userCacheKey = generateCacheKey(req.user.id, filter, sortBy, sortOrder, limit, offset);
                                await cacheService.del(userCacheKey);
                            }
                        }
                    }
                }
            }

            const fractalUrl = await s3Service.getPresignedUrl(s3Key);
            res.json({ hash, url: fractalUrl, galleryId: newGalleryId });
        }
    } catch (error) {
        console.error("DEBUG: Error in /fractal route:", error);
        res.status(500).send("Internal server error");
    }
});

module.exports = router;