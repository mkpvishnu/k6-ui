const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');

class TestManager extends EventEmitter {
    constructor(baseDir) {
        super();
        this.baseDir = baseDir;
        this.testsDir = path.join(baseDir, 'tests');
        this.tempDir = path.join(baseDir, 'temp');
        this.currentTest = null;
        this.initialize();
    }

    async initialize() {
        // Ensure directories exist
        await this.ensureDir(this.testsDir);
        await this.ensureDir(this.tempDir);
    }

    async ensureDir(dir) {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    async saveTest(testConfig) {
        const { name, script, executor, thresholds, scenarios, env } = testConfig;
        const filename = this.sanitizeFilename(name);
        const testPath = path.join(this.testsDir, `${filename}.json`);

        await fs.writeFile(testPath, JSON.stringify({
            name,
            script,
            executor,
            thresholds,
            scenarios,
            env,
            created: new Date().toISOString(),
            modified: new Date().toISOString()
        }, null, 2));

        return { success: true };
    }

    async loadTest(name) {
        const filename = this.sanitizeFilename(name);
        const testPath = path.join(this.testsDir, `${filename}.json`);
        
        const content = await fs.readFile(testPath, 'utf8');
        return { success: true, config: JSON.parse(content) };
    }

    async listTests() {
        const files = await fs.readdir(this.testsDir);
        const tests = files
            .filter(file => file.endsWith('.json'))
            .map(file => file.slice(0, -5));  // Remove .json extension
        return { success: true, tests };
    }

    async runTest(config) {
        if (this.currentTest) {
            throw new Error('A test is already running');
        }

        const { script, options } = config;
        const scriptPath = path.join(this.tempDir, `test-${Date.now()}.js`);
        const configPath = path.join(this.tempDir, `config-${Date.now()}.json`);

        try {
            // Write script to temporary file
            await fs.writeFile(scriptPath, script);

            // Prepare k6 options
            const k6Config = this.prepareK6Config(options);
            await fs.writeFile(configPath, JSON.stringify(k6Config, null, 2));

            // Prepare k6 command arguments
            const args = ['run', '--config', configPath];

            // Add environment variables
            if (options.env) {
                Object.entries(options.env).forEach(([key, value]) => {
                    args.push('--env', `${key}=${value}`);
                });
            }

            // Add output formats
            if (options.output) {
                options.output.forEach(format => {
                    args.push('--out', format);
                });
            }

            args.push(scriptPath);

            // Start k6 process
            this.currentTest = spawn('k6', args);

            // Handle process events
            this.currentTest.stdout.on('data', (data) => {
                this.emit('metrics', data.toString());
            });

            this.currentTest.stderr.on('data', (data) => {
                this.emit('error', data.toString());
            });

            this.currentTest.on('close', async (code) => {
                this.emit('done', { code });
                
                // Cleanup temporary files
                try {
                    await fs.unlink(scriptPath);
                    await fs.unlink(configPath);
                } catch (error) {
                    console.error('Error cleaning up temporary files:', error);
                }

                this.currentTest = null;
            });

            return { success: true };

        } catch (error) {
            // Cleanup on error
            try {
                await fs.unlink(scriptPath);
                await fs.unlink(configPath);
            } catch (cleanupError) {
                console.error('Error cleaning up after failed test start:', cleanupError);
            }

            throw error;
        }
    }

    stopTest() {
        if (!this.currentTest) {
            throw new Error('No test is currently running');
        }

        this.currentTest.kill();
        return { success: true };
    }

    prepareK6Config(options) {
        const config = {
            scenarios: {},
            thresholds: {}
        };

        // Configure scenarios
        if (options.scenarios && options.scenarios.length > 0) {
            options.scenarios.forEach((scenario, index) => {
                config.scenarios[`scenario_${index + 1}`] = {
                    executor: scenario.executor,
                    ...this.getExecutorConfig(scenario)
                };
            });
        } else {
            // Default scenario based on executor configuration
            config.scenarios.default = {
                executor: options.executorType,
                ...this.getExecutorConfig(options)
            };
        }

        // Configure thresholds
        if (options.thresholds) {
            config.thresholds = options.thresholds;
        }

        return config;
    }

    getExecutorConfig(options) {
        const config = {};

        switch (options.executorType) {
            case 'shared-iterations':
                config.vus = options.vus;
                config.iterations = options.iterations;
                break;

            case 'per-vu-iterations':
                config.vus = options.vus;
                config.iterations = options.iterations;
                break;

            case 'constant-vus':
                config.vus = options.vus;
                config.duration = options.duration;
                break;

            case 'ramping-vus':
                config.startVUs = options.startVUs;
                config.stages = options.stages;
                break;

            case 'constant-arrival-rate':
                config.rate = options.rate;
                config.timeUnit = options.timeUnit;
                config.duration = options.duration;
                config.preAllocatedVUs = options.preAllocatedVUs;
                config.maxVUs = options.maxVUs;
                break;

            case 'ramping-arrival-rate':
                config.startRate = options.startRate;
                config.timeUnit = options.timeUnit;
                config.stages = options.stages;
                config.preAllocatedVUs = options.preAllocatedVUs;
                config.maxVUs = options.maxVUs;
                break;

            case 'externally-controlled':
                config.vus = options.vus;
                config.maxVUs = options.maxVUs;
                break;
        }

        return config;
    }

    sanitizeFilename(filename) {
        return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    }

    parseMetrics(output) {
        try {
            // Try parsing as JSON first
            const data = JSON.parse(output);
            return {
                vus: data.metrics.vus.value,
                rps: data.metrics.http_reqs.rate,
                responseTime: data.metrics.http_req_duration.value,
                errorRate: (data.metrics.http_req_failed.rate || 0) * 100,
                requests: this.parseRequests(data)
            };
        } catch (e) {
            // Fallback to regex parsing for raw output
            const metrics = {};
            
            const vusMatch = output.match(/vus=(\d+)/);
            const rpsMatch = output.match(/http_reqs=(\d+(\.\d+)?)/);
            const responseTimeMatch = output.match(/http_req_duration=(\d+(\.\d+)?)/);
            const errorMatch = output.match(/http_req_failed=(\d+(\.\d+)?)/);
            
            if (vusMatch) metrics.vus = parseInt(vusMatch[1]);
            if (rpsMatch) metrics.rps = parseFloat(rpsMatch[1]);
            if (responseTimeMatch) metrics.responseTime = parseFloat(responseTimeMatch[1]);
            if (errorMatch) metrics.errorRate = parseFloat(errorMatch[1]) * 100;
            
            return metrics;
        }
    }

    parseRequests(data) {
        if (!data.metrics.http_reqs || !data.metrics.http_reqs.values) {
            return [];
        }

        return data.metrics.http_reqs.values.map(req => ({
            name: req.tags.name || req.tags.url,
            method: req.tags.method,
            url: req.tags.url,
            status: req.tags.status,
            duration: req.value
        }));
    }
}

module.exports = TestManager;