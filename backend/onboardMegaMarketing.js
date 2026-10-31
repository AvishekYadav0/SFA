require('dotenv').config();
const { migrate } = require('./migrateMegaMarketing');
const mongoose = require('mongoose');

if (require.main === module) {
  migrate({ dryRun: !process.argv.includes('--apply') })
    .catch(error => {
      console.error('Mega Marketing onboarding failed:', error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(error => {
        console.error('Failed to disconnect from MongoDB:', error.message);
        process.exitCode = 1;
      });
    });
}
