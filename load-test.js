/**
 * Load Testing Script for SnapNotes Concurrent Upload Performance
 * 
 * Usage:
 *   node load-test.js
 * 
 * This simulates multiple users uploading screenshots simultaneously
 * and measures the performance metrics.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  baseUrl: process.env.TEST_URL || 'http://localhost:3000',
  numUsers: 5,
  imagesPerUser: 3,
  testImagePath: './test-image.png', // Create a sample image or use existing
  authToken: process.env.AUTH_TOKEN, // You'll need to get this from browser devtools
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Simulate a single user uploading screenshots
async function simulateUserUpload(userId, numImages) {
  const startTime = Date.now();
  log('cyan', `\n👤 User ${userId}: Starting upload of ${numImages} images...`);

  try {
    // Create form data with multiple images
    const FormData = require('form-data');
    const formData = new FormData();

    // Check if test image exists
    if (!fs.existsSync(CONFIG.testImagePath)) {
      log('red', `❌ Test image not found: ${CONFIG.testImagePath}`);
      log('yellow', 'Creating a dummy test image...');
      
      // Create a simple test image (1x1 pixel PNG)
      const dummyImage = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64'
      );
      fs.writeFileSync(CONFIG.testImagePath, dummyImage);
    }

    // Add multiple images to form data
    for (let i = 0; i < numImages; i++) {
      const imageBuffer = fs.readFileSync(CONFIG.testImagePath);
      formData.append('files', imageBuffer, {
        filename: `test-image-user${userId}-${i}.png`,
        contentType: 'image/png',
      });
    }

    // Upload request
    const uploadResponse = await axios.post(
      `${CONFIG.baseUrl}/api/screenshots/upload`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Cookie': CONFIG.authToken ? `next-auth.session-token=${CONFIG.authToken}` : '',
        },
        timeout: 120000, // 2 minutes timeout
      }
    );

    const jobId = uploadResponse.data.job_id;
    log('green', `✅ User ${userId}: Upload successful (Job ID: ${jobId})`);

    // Poll for processing status
    let processingComplete = false;
    let pollCount = 0;
    const maxPolls = 120; // 2 minutes max (polling every 2s)

    while (!processingComplete && pollCount < maxPolls) {
      await sleep(2000); // Wait 2 seconds between polls
      
      try {
        const statusResponse = await axios.get(
          `${CONFIG.baseUrl}/api/processing-status/${jobId}`,
          {
            headers: {
              'Cookie': CONFIG.authToken ? `next-auth.session-token=${CONFIG.authToken}` : '',
            },
          }
        );

        const { status, processed, total } = statusResponse.data;
        const progress = Math.round((processed / total) * 100);

        log('blue', `   User ${userId}: Processing ${progress}% (${processed}/${total})`);

        if (status === 'completed') {
          processingComplete = true;
          const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
          log('green', `✅ User ${userId}: Processing complete in ${totalTime}s`);
          
          return {
            userId,
            success: true,
            totalTime: parseFloat(totalTime),
            imagesProcessed: processed,
            imagesTotal: total,
          };
        } else if (status === 'failed') {
          log('red', `❌ User ${userId}: Processing failed`);
          return {
            userId,
            success: false,
            error: 'Processing failed',
          };
        }
      } catch (pollError) {
        log('yellow', `   User ${userId}: Polling error (continuing...)`);
      }

      pollCount++;
    }

    if (!processingComplete) {
      log('red', `❌ User ${userId}: Timeout after ${maxPolls * 2}s`);
      return {
        userId,
        success: false,
        error: 'Timeout',
      };
    }
  } catch (error) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    log('red', `❌ User ${userId}: Error after ${totalTime}s - ${error.message}`);
    
    return {
      userId,
      success: false,
      error: error.message,
      totalTime: parseFloat(totalTime),
    };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Calculate and display results
function displayResults(results) {
  log('cyan', '\n' + '='.repeat(60));
  log('cyan', 'LOAD TEST RESULTS');
  log('cyan', '='.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  log('blue', `\n📊 Overall Statistics:`);
  log('green', `   ✅ Successful: ${successful.length}/${results.length}`);
  log('red', `   ❌ Failed: ${failed.length}/${results.length}`);

  if (successful.length > 0) {
    const times = successful.map(r => r.totalTime);
    const avgTime = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2);
    const minTime = Math.min(...times).toFixed(2);
    const maxTime = Math.max(...times).toFixed(2);

    log('blue', `\n⏱️  Processing Times:`);
    log('green', `   Average: ${avgTime}s`);
    log('green', `   Fastest: ${minTime}s`);
    log('yellow', `   Slowest: ${maxTime}s`);

    const totalImages = successful.reduce((sum, r) => sum + r.imagesProcessed, 0);
    const totalTime = successful.reduce((sum, r) => sum + r.totalTime, 0);
    const throughput = (totalImages / totalTime).toFixed(2);

    log('blue', `\n🚀 Throughput:`);
    log('green', `   Total images processed: ${totalImages}`);
    log('green', `   Images per second: ${throughput}`);
  }

  if (failed.length > 0) {
    log('red', `\n❌ Failed Uploads:`);
    failed.forEach(r => {
      log('red', `   User ${r.userId}: ${r.error}`);
    });
  }

  log('cyan', '\n' + '='.repeat(60) + '\n');
}

// Main test execution
async function runLoadTest() {
  log('cyan', '\n🧪 SNAPNOTES CONCURRENT UPLOAD LOAD TEST');
  log('cyan', '='.repeat(60));
  log('blue', `Configuration:`);
  log('blue', `   Base URL: ${CONFIG.baseUrl}`);
  log('blue', `   Number of users: ${CONFIG.numUsers}`);
  log('blue', `   Images per user: ${CONFIG.imagesPerUser}`);
  log('blue', `   Total images: ${CONFIG.numUsers * CONFIG.imagesPerUser}`);
  log('cyan', '='.repeat(60));

  // Check authentication
  if (!CONFIG.authToken) {
    log('yellow', '\n⚠️  WARNING: No AUTH_TOKEN provided');
    log('yellow', '   To authenticate requests, set AUTH_TOKEN environment variable');
    log('yellow', '   Get token from browser DevTools → Application → Cookies → next-auth.session-token\n');
  }

  // Check server availability
  try {
    await axios.get(`${CONFIG.baseUrl}/api/status`, { timeout: 5000 });
    log('green', '✅ Server is reachable\n');
  } catch (error) {
    log('red', `❌ Cannot reach server at ${CONFIG.baseUrl}`);
    log('yellow', '   Make sure the server is running and the URL is correct\n');
    return;
  }

  const testStartTime = Date.now();

  // Simulate concurrent uploads
  log('cyan', '🚀 Starting concurrent uploads...\n');
  
  const uploadPromises = [];
  for (let i = 1; i <= CONFIG.numUsers; i++) {
    uploadPromises.push(simulateUserUpload(i, CONFIG.imagesPerUser));
    
    // Stagger the start times slightly (500ms between users)
    await sleep(500);
  }

  // Wait for all uploads to complete
  log('yellow', '\n⏳ Waiting for all uploads to complete...\n');
  const results = await Promise.all(uploadPromises);

  const totalTestTime = ((Date.now() - testStartTime) / 1000).toFixed(2);
  
  // Display results
  displayResults(results);
  
  log('cyan', `\n⏱️  Total test duration: ${totalTestTime}s`);

  // Performance Analysis
  const successful = results.filter(r => r.success);
  if (successful.length >= 2) {
    const times = successful.map(r => r.totalTime);
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance).toFixed(2);

    log('blue', '\n📈 Performance Analysis:');
    if (stdDev < avgTime * 0.2) {
      log('green', `   ✅ Low variance (σ=${stdDev}s) - Users are processing in parallel`);
    } else if (stdDev < avgTime * 0.5) {
      log('yellow', `   ⚠️  Medium variance (σ=${stdDev}s) - Some queueing detected`);
    } else {
      log('red', `   ❌ High variance (σ=${stdDev}s) - Significant queueing/blocking`);
    }

    // Check for linear scaling
    const expectedTimePerUser = avgTime / CONFIG.numUsers;
    const actualTimePerUser = avgTime;
    const scalingFactor = (actualTimePerUser / expectedTimePerUser).toFixed(2);
    
    if (scalingFactor < 1.5) {
      log('green', `   ✅ Good scaling (factor: ${scalingFactor}x) - Near-parallel processing`);
    } else if (scalingFactor < 3) {
      log('yellow', `   ⚠️  Moderate scaling (factor: ${scalingFactor}x) - Some bottlenecks`);
    } else {
      log('red', `   ❌ Poor scaling (factor: ${scalingFactor}x) - Significant bottlenecks`);
    }
  }

  log('cyan', '\n✨ Load test complete!\n');
}

// Run the test
if (require.main === module) {
  runLoadTest().catch(error => {
    log('red', `\n❌ Test execution failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

module.exports = { runLoadTest, simulateUserUpload };
