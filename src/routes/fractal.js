const express = require('express');
const router = express.Router();
const { generateFractal } = require('../fractal');
const fs = require('fs');
const crypto = require('crypto');
const { verifyToken } = require('./auth.js');
const Fractal = require('../models/fractal.model.js');
const History = require('../models/history.model.js');
const Gallery = require('../models/gallery.model.js');

const fractalsDir = './fractals';

// Track if a fractal is currently being generated
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
        colorScheme: req.query.color || 'rainbow',
    };

    const hash = crypto.createHash('sha256').update(JSON.stringify(options)).digest('hex');

    Fractal.findFractalByHash(hash, async (err, row) => {
        if (err) {
            return res.status(500).send("Database error");
        }

        if (row) {
            // Fractal exists, log to history and add to gallery (if not already there)
            History.createHistoryEntry(req.user.id, row.id, (err) => {
                if (err) {
                    console.error("Failed to log history", err);
                }
            });
            Gallery.addToGallery(req.user.id, row.id, row.hash, (err) => {
                if (err) {
                    console.error("Failed to add to gallery", err);
                }
            });
            const fractalUrl = `${req.protocol}://${req.get('host')}/fractals/${row.hash}.png`;
            return res.json({ hash: row.hash, url: fractalUrl });
        } else {
            // Fractal does not exist, generate it
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

            const imagePath = `${fractalsDir}/${hash}.png`;
            fs.writeFileSync(imagePath, buffer);

            const fractalData = { ...options, hash, imagePath };

            Fractal.createFractal(fractalData, (err, result) => {
                if (err) {
                    console.error("Failed to save fractal to DB", err);
                    return res.status(500).send("Failed to save fractal.");
                }

                History.createHistoryEntry(req.user.id, result.id, (err) => {
                    if (err) {
                        console.error("Failed to log history", err);
                    }
                });
                Gallery.addToGallery(req.user.id, result.id, hash, (err) => {
                    if (err) {
                        console.error("Failed to add to gallery", err);
                    }
                });

                const fractalUrl = `${req.protocol}://${req.get('host')}/fractals/${hash}.png`;
                res.json({ hash, url: fractalUrl });
            });
        }
    });
});

module.exports = router;