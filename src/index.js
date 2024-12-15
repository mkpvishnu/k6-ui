const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs').promises;
const winston = require('winston');
const csvWriter = require('csv-writer');
const moment = require('moment');

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
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
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Create necessary directories
const tempDir = path.join(__dirname, 'temp');
const resultsDir = path.join(__dirname, 'results');
Promise.all([
    fs.mkdir(tempDir, { recursive: true }),
    fs.mkdir(resultsDir, { recursive: true })
]).catch(console.error);

// WebSocket server for real-time metrics
const wss = new WebSocket.Server({ noServer: true });
let activeTest = null;
let testMetrics = {
    vus: [],
    rps: [],
    responseTime: [],
    errors: [],
    timestamps: []
};

function resetMetrics() {
    testMetrics = {
        vus: [],
        rps: [],
        responseTime: [],
        errors: [],
        timestamps: []
    };
}

function parseK6Output(data) {
    const lines = data.toString().split('\n');
    const metrics = {};

    lines.forEach(line => {
        try {
            // First try to parse as JSON
            if (line.trim()) {
                try {
                    const jsonData = JSON.parse(line);
                    if (jsonData.type === 'Point') {
                        switch(jsonData.metric) {
                            case 'http_reqs':
                                metrics.rps = parseFloat(jsonData.value);
                                break;
                            case 'vus':
                                metrics.vus = parseInt(jsonData.value);
                                break;
                            case 'http_req_duration':
                                metrics.responseTime = parseFloat(jsonData.value);
                                break;
                            case 'checks':
                                // Track failed checks as errors
                                if (!jsonData.value) {
                                    metrics.errors = (metrics.errors || 0) + 1;
                                }
                                break;
                        }
                    }
                } catch {
                    // If not JSON, try regex patterns
                    if (line.includes('vus:')) {
                        const match = line.match(/vus:\s*(\d+)/);
                        if (match) metrics.vus = parseInt(match[1]);
                    }
                    if (line.includes('http_reqs:')) {
                        const match = line.match(/http_reqs:\s*([\d.]+)/);
                        if (match) metrics.rps = parseFloat(match[1]);
                    }
                    if (line.includes('http_req_duration:')) {
                        const match = line.match(/http_req_duration:\s*([\d.]+)/);
                        if (match) metrics.responseTime = parseFloat(match[1]);
                    }
                    if (line.includes('checks:')) {
                        const match = line.match(/checks:\s*([\d.]+)%/);
                        if (match) {
                            const checkRate = parseFloat(match[1]);
                            metrics.errors = Math.round((100 - checkRate) / 100);
                        }
                    }
                }
            }
        } catch (error) {
            logger.error('Error parsing k6 output line:', { error: error.message, line });
        }
    });

    // Ensure all metrics have at least a 0 value
    metrics.vus = metrics.vus || 0;
    metrics.rps = metrics.rps || 0;
    metrics.responseTime = metrics.responseTime || 0;
    metrics.errors = metrics.errors || 0;

    return metrics;
}

async function saveTestResults(metrics) {
    try {
        const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
        const csvFilePath = path.join(resultsDir, `test_results_${timestamp}.csv`);
        const summaryPath = path.join(resultsDir, `test_summary_${timestamp}.json`);

        // Filter out any invalid data points
        const validIndices = metrics.timestamps.reduce((acc, _, index) => {
            if (metrics.vus[index] !== undefined &&
                metrics.rps[index] !== undefined &&
                metrics.responseTime[index] !== undefined &&
                metrics.errors[index] !== undefined) {
                acc.push(index);
            }
            return acc;
        }, []);

        // Calculate summary statistics
        const summary = {
            timestamp,
            duration: validIndices.length > 0 ? 
                moment(metrics.timestamps[validIndices[validIndices.length - 1]])
                    .diff(moment(metrics.timestamps[validIndices[0]]), 'seconds') : 0,
            totalRequests: metrics.rps
                .filter(v => v !== undefined)
                .reduce((sum, val) => sum + val, 0),
            averageRPS: metrics.rps
                .filter(v => v !== undefined)
                .reduce((sum, val, _, arr) => sum + val / arr.length, 0),
            maxVUs: Math.max(...metrics.vus.filter(v => v !== undefined), 0),
            minResponseTime: Math.min(...metrics.responseTime.filter(v => v !== undefined), 0),
            maxResponseTime: Math.max(...metrics.responseTime.filter(v => v !== undefined), 0),
            averageResponseTime: metrics.responseTime
                .filter(v => v !== undefined)
                .reduce((sum, val, _, arr) => sum + val / arr.length, 0),
            totalErrors: metrics.errors
                .filter(v => v !== undefined)
                .reduce((sum, val) => sum + val, 0),
            p95ResponseTime: calculatePercentile(
                metrics.responseTime.filter(v => v !== undefined),
                95
            ),
            errorRate: metrics.errors
                .filter(v => v !== undefined)
                .reduce((sum, val, _, arr) => sum + val / arr.length, 0)
        };

        // Save summary
        await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

        // Create CSV writer
        const writer = csvWriter.createObjectCsvWriter({
            path: csvFilePath,
            header: [
                { id: 'timestamp', title: 'Timestamp' },
                { id: 'vus', title: 'Virtual Users' },
                { id: 'rps', title: 'Requests/sec' },
                { id: 'responseTime', title: 'Response Time (ms)' },
                { id: 'errors', title: 'Errors' }
            ]
        });

        // Prepare records with proper timestamp formatting
        const records = validIndices.map(index => ({
            timestamp: moment(metrics.timestamps[index]).format('YYYY-MM-DD HH:mm:ss'),
            vus: metrics.vus[index],
            rps: metrics.rps[index],
            responseTime: metrics.responseTime[index],
            errors: metrics.errors[index]
        }));

        await writer.writeRecords(records);

        logger.info('Test results saved:', {
            csvFilePath,
            summaryPath,
            recordCount: records.length,
            summary
        });
        
        return {
            csv: csvFilePath,
            summary: summaryPath,
            summaryData: summary
        };
    } catch (error) {
        logger.error('Error saving test results:', error);
        throw error;
    }
}

function calculatePercentile(values, percentile) {
    if (!values || values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
}

wss.on('connection', (ws) => {
    logger.info('Client connected to WebSocket');
    
    // Send current metrics if test is running
    if (activeTest) {
        ws.send(JSON.stringify({
            type: 'metrics',
            data: testMetrics
        }));
    }

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
        
        // Reset metrics for new test
        resetMetrics();

        // Always use UI parameters if provided
        const fullScript = options ? 
            `import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

export const options = ${JSON.stringify(options, null, 2)};

${script.replace(/export const options[\s\S]*?};/, '').trim()}` : 
            script;

        logger.info('Generated script:', fullScript);

        // Write script to temporary file
        await fs.writeFile(scriptPath, fullScript);

        // Start k6 process with JSON output and more detailed metrics
        activeTest = spawn('k6', [
            'run',
            '--out', 'json=metrics.json',
            '--console-output=stdout',
            '--no-color',
            scriptPath
        ]);

        let output = '';
        let lastMetricsUpdate = Date.now();
        const updateInterval = 1000; // Update every second

        activeTest.stdout.on('data', (data) => {
            const dataStr = data.toString();
            output += dataStr;
            
            // Only process metrics if enough time has passed
            const now = Date.now();
            if (now - lastMetricsUpdate >= updateInterval) {
                try {
                    const metrics = parseK6Output(dataStr);
                    
                    // Only update metrics if we have valid data
                    if (Object.keys(metrics).length > 0) {
                        const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
                        
                        // Update metrics arrays
                        testMetrics.vus.push(metrics.vus);
                        testMetrics.rps.push(metrics.rps);
                        testMetrics.responseTime.push(metrics.responseTime);
                        testMetrics.errors.push(metrics.errors);
                        testMetrics.timestamps.push(timestamp);

                        // Send metrics update
                        wss.clients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN) {
                                client.send(JSON.stringify({
                                    type: 'metrics',
                                    data: {
                                        current: metrics,
                                        history: {
                                            vus: testMetrics.vus,
                                            rps: testMetrics.rps,
                                            responseTime: testMetrics.responseTime,
                                            errors: testMetrics.errors,
                                            timestamps: testMetrics.timestamps
                                        }
                                    }
                                }));
                            }
                        });
                    }
                } catch (error) {
                    logger.error('Error processing metrics:', error);
                }
                
                lastMetricsUpdate = now;
            }

            // Always send the raw output separately
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'output',
                        data: dataStr.trim()
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

            try {
                // Save test results
                const resultsFile = await saveTestResults(testMetrics);
                
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'completed',
                            code,
                            output,
                            resultsFile
                        }));
                    }
                });

                // Cleanup
                await fs.unlink(scriptPath);
            } catch (err) {
                logger.error('Error in test cleanup:', err);
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

app.get('/api/test-results', async (req, res) => {
    try {
        const files = await fs.readdir(resultsDir);
        const results = await Promise.all(
            files.map(async file => {
                const stats = await fs.stat(path.join(resultsDir, file));
                return {
                    name: file,
                    date: stats.mtime,
                    size: stats.size
                };
            })
        );
        res.json({ success: true, results });
    } catch (error) {
        logger.error('Error getting test results:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/test-results/:filename', async (req, res) => {
    try {
        const filePath = path.join(resultsDir, req.params.filename);
        res.download(filePath);
    } catch (error) {
        logger.error('Error downloading test results:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

function convertCurlToK6Script(curlCommand) {
    logger.info('Parsing CURL command:', curlCommand);

    // Clean up the curl command
    let curl = curlCommand.trim();
    if (!curl.toLowerCase().startsWith('curl ')) {
        throw new Error('Command must start with curl');
    }

    // Remove 'curl' from the start
    curl = curl.substring(4).trim();

    // Parse URL
    let url;
    let method = 'GET';
    let headers = [];
    let data = null;
    let followRedirects = false;
    
    // Split the command into parts while preserving quoted strings
    const parts = curl.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        // Handle flags with values
        if (part.startsWith('-')) {
            switch (part) {
                case '-X':
                case '--request':
                    if (i + 1 < parts.length) {
                        method = parts[++i].replace(/["']/g, '').toUpperCase();
                    }
                    break;
                    
                case '-H':
                case '--header':
                    if (i + 1 < parts.length) {
                        const header = parts[++i].replace(/["']/g, '');
                        const [key, ...valueParts] = header.split(':');
                        const value = valueParts.join(':').trim();
                        if (key && value) {
                            headers.push(`        '${key.trim()}': '${value}'`);
                        }
                    }
                    break;
                    
                case '-d':
                case '--data':
                case '--data-raw':
                case '--data-binary':
                    if (i + 1 < parts.length) {
                        data = parts[++i].replace(/^["']|["']$/g, '');
                        // If method is not set explicitly, assume POST
                        if (method === 'GET') method = 'POST';
                    }
                    break;
                    
                case '-L':
                case '--location':
                    followRedirects = true;
                    break;
                    
                case '-A':
                case '--user-agent':
                    if (i + 1 < parts.length) {
                        const userAgent = parts[++i].replace(/["']/g, '');
                        headers.push(`        'User-Agent': '${userAgent}'`);
                    }
                    break;
                    
                // Handle flags that are merged with their values
                default:
                    if (part.startsWith('-X')) {
                        method = part.substring(2).toUpperCase();
                    } else if (part.startsWith('-H')) {
                        const header = part.substring(2).replace(/["']/g, '');
                        const [key, ...valueParts] = header.split(':');
                        const value = valueParts.join(':').trim();
                        if (key && value) {
                            headers.push(`        '${key.trim()}': '${value}'`);
                        }
                    } else if (part.startsWith('-d')) {
                        data = part.substring(2).replace(/^["']|["']$/g, '');
                        if (method === 'GET') method = 'POST';
                    }
                    break;
            }
            continue;
        }
        
        // If not a flag, assume it's the URL (take the first non-flag argument as URL)
        if (!url) {
            url = part.replace(/["']/g, '');
            try {
                // Try to parse the URL to validate it
                new URL(url);
            } catch (e) {
                // If parsing fails, try prepending https://
                if (!url.match(/^https?:\/\//i)) {
                    url = 'https://' + url;
                    try {
                        new URL(url); // Validate again
                    } catch (e2) {
                        throw new Error('Invalid URL: ' + part);
                    }
                } else {
                    throw new Error('Invalid URL: ' + part);
                }
            }
        }
    }

    if (!url) {
        throw new Error('No URL found in curl command');
    }

    // Parse URL for query parameters
    const urlObj = new URL(url);
    const params = Array.from(urlObj.searchParams.entries()).map(([key, value]) => 
        `        '${key}': '${value}'`
    );

    logger.info('Parsed CURL components:', { url, method, headers, data, params, followRedirects });

    // Generate k6 script
    return `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

export const options = {
    stages: [
        { duration: '30s', target: 5 },
        { duration: '1m', target: 10 },
        { duration: '30s', target: 0 },
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'],
        errors: ['rate<0.1'],
    },
};

export default function() {
    const params = {
        headers: {
${headers.join(',\n')}
        }${params.length ? `,
        searchParams: {
${params.join(',\n')}
        }` : ''}${followRedirects ? ',\n        redirects: 5' : ''}
    };

    const res = http.${method.toLowerCase()}('${urlObj.origin + urlObj.pathname}'${data ? `, ${JSON.stringify(data)}, params` : ', params'});

    const success = check(res, {
        'is status 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500
    });

    errorRate.add(!success);
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