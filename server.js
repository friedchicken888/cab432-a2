require('dotenv').config();
const express = require('express');
const { initializeAuth } = require('./src/routes/auth');
// ... other imports

// ... app setup

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