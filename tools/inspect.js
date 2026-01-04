import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const APP_ID = 'youtube.leanback.v4';
const MCP_PATH = '.mcp.json';

console.log('🔍 Starting webOS inspector...');

const inspectProcess = spawn('ares-inspect', [APP_ID], { shell: true });

let urlCaptured = false;

inspectProcess.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);

  if (!urlCaptured) {
    const urlMatch = output.match(/http:\/\/localhost:(\d+)/);
    if (urlMatch) {
      const url = urlMatch[0];
      const port = urlMatch[1];
      urlCaptured = true;

      // Fetch DevTools JSON to get WebSocket URL
      fetch(`http://localhost:${port}/json`)
        .then((res) => res.json())
        .then((targets) => {
          if (targets.length > 0 && targets[0].webSocketDebuggerUrl) {
            const wsUrl = targets[0].webSocketDebuggerUrl;
            const mcp = JSON.parse(readFileSync(MCP_PATH, 'utf8'));
            mcp.mcpServers['ghost-tube'].args[1] = `--endpoint=${wsUrl}`;
            writeFileSync(MCP_PATH, JSON.stringify(mcp, null, 2) + '\n');
            console.log(`📝 Updated ${MCP_PATH} with endpoint: ${wsUrl}`);
          }
        })
        .catch((err) => {
          console.warn('⚠️  Could not fetch DevTools info:', err.message);
        });

      console.log(`\n🌐 Opening Chrome with inspector URL: ${url}`);
      const chromeResult = spawnSync('google-chrome', ['--new-window', url], {
        stdio: 'inherit',
        shell: true
      });

      if (chromeResult.status !== 0) {
        console.warn('⚠️  Could not launch Chrome automatically');
      }
    }
  }
});

inspectProcess.stderr.on('data', (data) => {
  process.stderr.write(data);
});

inspectProcess.on('close', (code) => {
  console.log(`\n🛑 Inspector exited with code ${code}`);
  process.exit(code);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Terminating inspector...');
  inspectProcess.kill('SIGINT');
  process.exit(0);
});

console.log('ℹ️  Inspector is running. Press Ctrl+C to stop.');
