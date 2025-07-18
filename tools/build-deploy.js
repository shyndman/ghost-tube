import { spawnSync } from 'node:child_process';

console.log('🚀 Starting build, deploy, and inspect workflow...');

// Step 1: Build the app
console.log('🔨 Building app...');
const buildResult = spawnSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  shell: true
});

if (buildResult.status !== 0) {
  console.error('❌ Build failed');
  process.exit(1);
}

// Step 2: Package the app
console.log('📦 Packaging app...');
const packageResult = spawnSync('npm', ['run', 'package'], {
  stdio: 'inherit',
  shell: true
});

if (packageResult.status !== 0) {
  console.error('❌ Package failed');
  process.exit(1);
}

// Step 3: Deploy the app
console.log('🚀 Deploying app to webOS device...');
const deployResult = spawnSync('npm', ['run', 'deploy'], {
  stdio: 'inherit',
  shell: true
});

if (deployResult.status !== 0) {
  console.error('❌ Deploy failed');
  process.exit(1);
}

// Step 4: Launch the app
console.log('🏃 Launching app on webOS device...');
const launchResult = spawnSync('npm', ['run', 'launch'], {
  stdio: 'inherit',
  shell: true
});

if (launchResult.status !== 0) {
  console.error('❌ Launch failed');
  process.exit(1);
}
