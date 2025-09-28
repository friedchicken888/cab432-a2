require('dotenv').config();
const express = require('express');
const { initializeAuth } = require('./src/routes/auth');
const fractalRouter = require('./src/routes/fractal');
const historyRouter = require('./src/routes/history');

const s3Service = require('./src/services/s3Service');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use('/fractals', express.static('fractals'));

(async () => {
  try {
    const { router: authRouter, verifyToken } = await initializeAuth();
    app.use('/api/auth', authRouter);
    app.use('/api', fractalRouter);
    app.use('/api', historyRouter);

    await s3Service.ensureBucketAndTags();
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to initialise application:', error);
    process.exit(1);
  }
})();
