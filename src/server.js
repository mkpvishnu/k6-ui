const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs').promises;
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, '../temp');
fs.mkdir(tempDir, { recursive: true }).catch(console.error);

// WebSocket server for real-time metrics
const wss = new WebSocket.Server({ noServer: true });
let activeTest = null;

wss.on('connection', (ws) => {
    logger.info('Client connected to WebSocket');
    ws.on('close', () => logger.info('Client disconnected from WebSocket'));
});

// Routes
app.post('/api/run-test', async (req, res) => {
    try {
        if (activeTest) {
            throw new Error('A test is already running');
        }

        const { script, options } = req.body;
        const scriptPath = path.join(tempDir, `test-${Date.now()}.js`);
        
        // Add options to the script if provided
        const fullScript = options ? `
            export const options = ${JSON.stringify(options, null, 2)};
            ${script}
        ` : script;

        // Write script to temporary file
        await fs.writeFile(scriptPath, fullScript);

        // Start k6 process
        activeTest = spawn('k6', ['run', scriptPath]);

        let output = '';

        activeTest.stdout.on('data', (data) => {
            const dataStr = data.toString();
            output += dataStr;
            
            // Broadcast metrics to all connected clients
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'metrics',
                        data: dataStr
                    }));
                }
            });
        });

        activeTest.stderr.on('data', (data) => {
            logger.error(`K6 Error: ${data}`);
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'error',
                        message: data.toString()
                    }));
                }
            });
        });

        activeTest.on('close', async (code) => {
            logger.info(`Test completed with code ${code}`);
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'completed',
                        code,
                        output
                    }));
                }
            });

            // Cleanup
            try {
                await fs.unlink(scriptPath);
            } catch (err) {
                logger.error('Error cleaning up script file:', err);
            }
            activeTest = null;
        });

        res.json({ success: true, message: 'Test started successfully' });
    } catch (error) {
        logger.error('Error running test:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/stop-test', (req, res) => {
    if (!activeTest) {
        return res.status(400).json({ success: false, error: 'No test is running' });
    }

    try {
        activeTest.kill();
        res.json({ success: true, message: 'Test stopped successfully' });
    } catch (error) {
        logger.error('Error stopping test:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/parse-curl', (req, res) => {
    try {
        const { curl } = req.body;
        const script = convertCurlToK6Script(curl);
        res.json({ success: true, script });
    } catch (error) {
        logger.error('Error parsing curl command:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

function convertCurlToK6Script(curl) {
    // Extract URL
    const urlMatch = curl.match(/'([^']*)'/) || curl.match(/"([^"]*)"/);
    if (!urlMatch) {
        throw new Error('No URL found in curl command');
    }
    const url = urlMatch[1];

    // Extract method
    const methodMatch = curl.match(/-X\s+([A-Z]+)/i);
    const method = methodMatch ? methodMatch[1].toUpperCase() : 'GET';

    // Extract headers
    const headers = [];
    const headerMatches = curl.matchAll(/-H\s+['"]([^'"]+)['"]/g);
    for (const match of headerMatches) {
        const [key, value] = match[1].split(':').map(s => s.trim());
        headers.push(`        '${key}': '${value}'`);
    }

    // Extract data
    const dataMatch = curl.match(/--data\s+['"]([^'"]+)['"]/);
    const data = dataMatch ? dataMatch[1] : null;

    // Generate k6 script
    return `
import http from 'k6/http';
import { check, sleep } from 'k6';

export default function() {
    const params = {
        headers: {
${headers.join(',\n')}
        }
    };

    const res = http.${method.toLowerCase()}('${url}'${data ? `, '${data}', params` : ', params'});

    check(res, {
        'is status 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500
    });

    sleep(1);
}`.trim();
}

// Start server
const server = app.listen(port, () => {
    logger.info(`K6 UI server running on port ${port}`);
});

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});