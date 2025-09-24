/**
 * @file server.js
 * @description Main entry point for the Fractal Generator Express API.
 * Initializes the Express application, configures middleware,
 * sets up routes, and starts the server.
 */
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const authRouter = require('./src/routes/auth').router;
const fractalRouter = require('./src/routes/fractal');
const historyRouter = require('./src/routes/history');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use('/fractals', express.static('fractals'));

const fractalsDir = './fractals';
if (!fs.existsSync(fractalsDir)){
    fs.mkdirSync(fractalsDir);
}

app.use('/api/auth', authRouter);
app.use('/api', fractalRouter);
app.use('/api', historyRouter);

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
