import { spawn, spawnSync } from 'node:child_process';

// Parse command line arguments
const args = process.argv.slice(2);
const shouldInspect = args.includes('--inspect');

console.log('🚀 Starting build and deploy workflow...');

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

// Step 5: Optionally run inspector
if (shouldInspect) {
  const inspectProcess = spawn('node', ['tools/inspect.js'], {
    stdio: 'inherit'
  });

  inspectProcess.on('close', (code) => {
    process.exit(code);
  });

  process.on('SIGINT', () => {
    inspectProcess.kill('SIGINT');
  });
}
