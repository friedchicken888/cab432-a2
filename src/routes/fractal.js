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

    console.log("Attempting to find fractal by hash...");
    Fractal.findFractalByHash(hash, async (err, row) => {
        if (err) {
            console.error("Error finding fractal by hash:", err);
            return res.status(500).send("Database error");
        }

        if (row) {
            console.log("Fractal found. Attempting to create history entry...");
            History.createHistoryEntry(req.user.id, req.user.username, row.id, (err) => {
                if (err) {
                    console.error("Error creating history entry:", err);
                }
            });

            console.log("Attempting to find gallery entry by fractal hash and user ID...");
            Gallery.findGalleryEntryByFractalHashAndUserId(req.user.id, row.hash, async (err, galleryEntry) => {
                if (err) {
                    console.error("Error finding gallery entry by fractal hash and user ID:", err);
                    return res.status(500).send("Database error");
                }

                let galleryId;
                if (galleryEntry) {
                    galleryId = galleryEntry.id;
                    const fractalUrl = await s3Service.getPresignedUrl(row.s3_key);
                    return res.json({ hash: row.hash, url: fractalUrl, galleryId: galleryId });
                } else {
                    console.log("Attempting to add to gallery...");
                    Gallery.addToGallery(req.user.id, row.id, row.hash, async (err, newGalleryId) => {
                        if (err) {
                            console.error("Error adding to gallery:", err);
                            return res.status(500).send("Database error");
                        }
                        galleryId = newGalleryId;
                        const fractalUrl = await s3Service.getPresignedUrl(row.s3_key);
                        return res.json({ hash: row.hash, url: fractalUrl, galleryId: galleryId });
                    });
                }
            });
        } else {
            isGenerating = true;
            let buffer;
            try {
                buffer = await generateFractal(options);
            } catch (err) {
                isGenerating = false;
                console.error(err);
                return res.status(500).send('Fractal generation failed');
            }
            isGenerating = false;

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

            console.log("Attempting to create fractal...");
            Fractal.createFractal(fractalData, (err, result) => {
                if (err) {
                    console.error("Error creating fractal:", err);
                    return res.status(500).send("Failed to save fractal.");
                }

                console.log("Attempting to create history entry after fractal creation...");
                History.createHistoryEntry(req.user.id, req.user.username, result.id, (err) => {
                    if (err) {
                        console.error("Error creating history entry after fractal creation:", err);
                    }
                });
                console.log("Attempting to add to gallery after fractal creation...");
                Gallery.addToGallery(req.user.id, result.id, hash, async (err, newGalleryId) => {
                    if (err) {
                        console.error("Error adding to gallery after fractal creation:", err);
                        return res.status(500).send("Database error");
                    }

                    const fractalUrl = await s3Service.getPresignedUrl(s3Key);
                    res.json({ hash, url: fractalUrl, galleryId: newGalleryId });
                });
            });
        }
    });
});

module.exports = router;