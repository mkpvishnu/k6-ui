// Test results and reporting functionality
class TestReports {
    constructor() {
        this.currentResults = null;
        this.testHistory = [];
        this.maxHistorySize = 50;
    }

    // Initialize report data
    initializeTestRun() {
        this.currentResults = {
            startTime: new Date(),
            metrics: {
                vus: [],
                responseTime: [],
                rps: [],
                errorRate: [],
                checks: { passed: 0, failed: 0 }
            },
            thresholds: {
                passed: [],
                failed: []
            },
            requests: [],
            errors: []
        };
    }

    // Add metric data point
    addMetricPoint(timestamp, metrics) {
        if (!this.currentResults) return;

        // Add metrics to time series data
        ['vus', 'responseTime', 'rps', 'errorRate'].forEach(metric => {
            if (metrics[metric] !== undefined) {
                this.currentResults.metrics[metric].push({
                    timestamp,
                    value: metrics[metric]
                });
            }
        });

        // Track requests
        if (metrics.requests) {
            this.currentResults.requests.push(...metrics.requests.map(req => ({
                ...req,
                timestamp
            })));
        }

        // Track errors
        if (metrics.errors) {
            this.currentResults.errors.push(...metrics.errors.map(err => ({
                ...err,
                timestamp
            })));
        }
    }

    // Update threshold status
    updateThresholds(thresholds) {
        if (!this.currentResults) return;

        Object.entries(thresholds).forEach(([name, result]) => {
            const list = result.ok ? 
                this.currentResults.thresholds.passed : 
                this.currentResults.thresholds.failed;
            
            if (!list.find(t => t.name === name)) {
                list.push({
                    name,
                    value: result.value,
                    threshold: result.threshold
                });
            }
        });
    }

    // Finalize test run and save to history
    finalizeTestRun(summary) {
        if (!this.currentResults) return;

        this.currentResults.endTime = new Date();
        this.currentResults.duration = this.currentResults.endTime - this.currentResults.startTime;
        this.currentResults.summary = summary;

        // Calculate aggregate metrics
        this.calculateAggregates();

        // Add to history
        this.testHistory.unshift(this.currentResults);
        if (this.testHistory.length > this.maxHistorySize) {
            this.testHistory.pop();
        }

        // Reset current results
        this.currentResults = null;
    }

    // Calculate aggregate metrics
    calculateAggregates() {
        const metrics = this.currentResults.metrics;

        for (const metricName in metrics) {
            if (Array.isArray(metrics[metricName])) {
                const values = metrics[metricName].map(point => point.value);
                metrics[metricName + '_summary'] = {
                    min: Math.min(...values),
                    max: Math.max(...values),
                    avg: values.reduce((a, b) => a + b, 0) / values.length,
                    p95: this.calculatePercentile(values, 95),
                    p99: this.calculatePercentile(values, 99)
                };
            }
        }
    }

    // Calculate percentile value
    calculatePercentile(values, percentile) {
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[index];
    }

    // Generate HTML report
    generateHTMLReport(testResult = this.currentResults) {
        if (!testResult) return '';

        return `
            <div class="report-container">
                <h2 class="text-2xl font-bold mb-4">Test Report - ${testResult.startTime.toLocaleString()}</h2>
                
                <div class="grid grid-cols-2 gap-4 mb-6">
                    <div class="bg-white p-4 rounded-lg shadow">
                        <h3 class="text-lg font-semibold mb-2">Test Duration</h3>
                        <p>${Math.round(testResult.duration / 1000)}s</p>
                    </div>
                    
                    <div class="bg-white p-4 rounded-lg shadow">
                        <h3 class="text-lg font-semibold mb-2">Total Requests</h3>
                        <p>${testResult.requests.length}</p>
                    </div>
                </div>

                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-2">Metrics Summary</h3>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        ${this.generateMetricsSummary(testResult)}
                    </div>
                </div>

                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-2">Thresholds</h3>
                    <div class="grid grid-cols-1 gap-4">
                        ${this.generateThresholdsSummary(testResult)}
                    </div>
                </div>

                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-2">Request Details</h3>
                    <div class="overflow-x-auto">
                        ${this.generateRequestsTable(testResult)}
                    </div>
                </div>

                ${testResult.errors.length ? `
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold mb-2">Errors</h3>
                        <div class="bg-red-50 p-4 rounded-lg">
                            ${this.generateErrorsList(testResult)}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Generate metrics summary HTML
    generateMetricsSummary(testResult) {
        const metrics = ['responseTime', 'rps', 'errorRate', 'vus'];
        return metrics.map(metric => {
            const summary = testResult.metrics[metric + '_summary'];
            if (!summary) return '';

            return `
                <div class="bg-white p-4 rounded-lg shadow">
                    <h4 class="font-semibold mb-2">${this.formatMetricName(metric)}</h4>
                    <dl class="grid grid-cols-2 gap-2 text-sm">
                        <dt>Min:</dt><dd>${summary.min.toFixed(2)}</dd>
                        <dt>Max:</dt><dd>${summary.max.toFixed(2)}</dd>
                        <dt>Avg:</dt><dd>${summary.avg.toFixed(2)}</dd>
                        <dt>P95:</dt><dd>${summary.p95.toFixed(2)}</dd>
                        <dt>P99:</dt><dd>${summary.p99.toFixed(2)}</dd>
                    </dl>
                </div>
            `;
        }).join('');
    }

    // Generate thresholds summary HTML
    generateThresholdsSummary(testResult) {
        const { passed, failed } = testResult.thresholds;
        return `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-green-50 p-4 rounded-lg">
                    <h4 class="font-semibold mb-2 text-green-800">Passed Thresholds (${passed.length})</h4>
                    <ul class="space-y-2">
                        ${passed.map(t => `
                            <li class="text-green-700">
                                ${t.name}: ${t.value} ${t.threshold}
                            </li>
                        `).join('')}
                    </ul>
                </div>
                ${failed.length ? `
                    <div class="bg-red-50 p-4 rounded-lg">
                        <h4 class="font-semibold mb-2 text-red-800">Failed Thresholds (${failed.length})</h4>
                        <ul class="space-y-2">
                            ${failed.map(t => `
                                <li class="text-red-700">
                                    ${t.name}: ${t.value} ${t.threshold}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Generate requests table HTML
    generateRequestsTable(testResult) {
        return `
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${testResult.requests.map(req => `
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap text-sm">
                                ${new Date(req.timestamp).toLocaleTimeString()}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm">
                                ${req.method}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm">
                                ${req.url}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    req.status < 400 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }">
                                    ${req.status}
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm">
                                ${req.duration.toFixed(2)}ms
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // Generate errors list HTML
    generateErrorsList(testResult) {
        return `
            <ul class="space-y-2">
                ${testResult.errors.map(error => `
                    <li class="text-red-700">
                        <span class="font-semibold">${new Date(error.timestamp).toLocaleTimeString()}</span>: 
                        ${error.message}
                    </li>
                `).join('')}
            </ul>
        `;
    }

    // Format metric names for display
    formatMetricName(metric) {
        const names = {
            responseTime: 'Response Time',
            rps: 'Requests/sec',
            errorRate: 'Error Rate',
            vus: 'Virtual Users'
        };
        return names[metric] || metric;
    }

    // Export test results as JSON
    exportJSON() {
        if (!this.currentResults) return null;
        return JSON.stringify(this.currentResults, null, 2);
    }

    // Export test results as CSV
    exportCSV() {
        if (!this.currentResults) return null;

        const metrics = this.currentResults.metrics;
        const rows = ['timestamp'];
        const data = {};

        // Collect all timestamps and metrics
        for (const metricName in metrics) {
            if (Array.isArray(metrics[metricName])) {
                rows.push(metricName);
                metrics[metricName].forEach(point => {
                    const timestamp = point.timestamp.toISOString();
                    data[timestamp] = data[timestamp] || {};
                    data[timestamp][metricName] = point.value;
                });
            }
        }

        // Convert to CSV
        const csvRows = [rows.join(',')];
        Object.entries(data).forEach(([timestamp, values]) => {
            const row = [timestamp];
            for (let i = 1; i < rows.length; i++) {
                row.push(values[rows[i]] || '');
            }
            csvRows.push(row.join(','));
        });

        return csvRows.join('\n');
    }
}

// Create global instance
const testReports = new TestReports();

// Export for use in other modules
window.testReports = testReports;