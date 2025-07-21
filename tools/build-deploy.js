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

// Step 5: Optionally run inspector and open Chrome
if (shouldInspect) {
  console.log('🔍 Starting webOS inspector...');

  // Run inspector with spawn to capture output
  const inspectProcess = spawn('npm', ['run', 'inspect'], {
    shell: true
  });

  let urlOpened = false;

  // Capture stdout to find localhost URL
  inspectProcess.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output); // Pass through the output

    // Look for localhost URL if we haven't opened Chrome yet
    if (!urlOpened) {
      const urlMatch = output.match(/http:\/\/localhost:\d+/);
      if (urlMatch) {
        const url = urlMatch[0];
        console.log(`\n🌐 Opening Chrome with inspector URL: ${url}`);

        // Launch Chrome with the URL
        const chromeResult = spawnSync('google-chrome', ['--new-window', url], {
          stdio: 'inherit',
          shell: true
        });

        if (chromeResult.status !== 0) {
          console.warn('⚠️  Could not launch Chrome automatically');
        }

        urlOpened = true;
      }
    }
  });

  // Pass through stderr
  inspectProcess.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  // Handle inspector process exit
  inspectProcess.on('close', (code) => {
    console.log(`\n🛑 Inspector exited with code ${code}`);
    process.exit(code);
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n🛑 Terminating inspector...');
    inspectProcess.kill('SIGINT');
    process.exit(0);
  });

  console.log('ℹ️  Inspector is running. Press Ctrl+C to stop.');
}
