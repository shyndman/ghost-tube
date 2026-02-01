import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

// Catch any unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ FATAL: Unhandled promise rejection:', reason);
  console.error('Promise:', promise);
  process.exit(1);
});

const APP_ID = 'youtube.leanback.v4';
const MCP_TEMPLATE_PATH = '.mcp.template.json';
const MCP_OUTPUT_PATH = '.mcp.json';

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
      // Add retry logic in case server isn't ready yet
      /**
       * @param {string} url
       * @param {number} [maxRetries]
       * @param {number} [delay]
       */
      const fetchWithRetry = async (url, maxRetries = 5, delay = 500) => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            // Add timeout to prevent hanging
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);

            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            if (!res.ok) {
              throw new Error(`HTTP ${res.status}`);
            }
            return await res.json();
          } catch (err) {
            if (i < maxRetries - 1) {
              const message = err instanceof Error ? err.message : String(err);
              console.warn(
                `⚠️  Fetch attempt ${i + 1} failed (${message}), retrying...`
              );
              await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
              throw err;
            }
          }
        }
      };

      // Defer to next tick to avoid blocking event loop before fetch completes
      setImmediate(() => {
        fetchWithRetry(`http://localhost:${port}/json`)
          .then((targets) => {
            if (targets.length > 0 && targets[0].webSocketDebuggerUrl) {
              const wsUrl = targets[0].webSocketDebuggerUrl;
              const mcp = JSON.parse(readFileSync(MCP_TEMPLATE_PATH, 'utf8'));
              mcp.mcpServers['ghost-tube'].args[1] = `--endpoint=${wsUrl}`;
              writeFileSync(
                MCP_OUTPUT_PATH,
                JSON.stringify(mcp, null, 2) + '\n'
              );
              console.log(
                `📝 Generated ${MCP_OUTPUT_PATH} with endpoint: ${wsUrl}`
              );

              // Now open Chrome after successful config generation
              console.log(`\n🌐 Opening Chrome with inspector URL: ${url}`);
              const chromeResult = spawnSync(
                'google-chrome',
                ['--new-window', url],
                {
                  stdio: 'inherit',
                  shell: true
                }
              );

              if (chromeResult.status !== 0) {
                console.warn('⚠️  Could not launch Chrome automatically');
              }
            } else {
              console.error(
                '❌ FATAL: No targets or webSocketDebuggerUrl found in response'
              );
              console.error('Response was:', JSON.stringify(targets, null, 2));
              process.exit(1);
            }
          })
          .catch((err) => {
            console.error('❌ FATAL ERROR in fetch chain:', err);
            console.error('Stack trace:', err.stack);
            process.exit(1);
          });
      });
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
