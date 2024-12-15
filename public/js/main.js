document.addEventListener('DOMContentLoaded', () => {
    let editor; // Monaco editor instance
    let charts = {}; // Chart.js instances
    let ws; // WebSocket instance

    // Elements
    const curlInput = document.getElementById('curlInput');
    const convertCurlBtn = document.getElementById('convertCurlBtn');
    const runTestBtn = document.getElementById('runTestBtn');
    const stopTestBtn = document.getElementById('stopTestBtn');
    const outputArea = document.getElementById('outputArea');
    const vuCount = document.getElementById('vuCount');
    const maxVUs = document.getElementById('maxVUs');
    const duration = document.getElementById('duration');
    const resultsTable = document.getElementById('resultsTable');

    // Initialize Monaco Editor
    require(['vs/editor/editor.main'], function() {
        try {
            editor = monaco.editor.create(document.getElementById('monaco-editor'), {
                value: getDefaultScript(),
                language: 'javascript',
                theme: 'vs-dark',
                automaticLayout: true,
                minimap: { enabled: true }
            });
            appendOutput('Editor initialized successfully');
        } catch (error) {
            appendOutput(`Error initializing editor: ${error.message}`, 'error');
        }
    });

    // Initialize Charts
    try {
        initializeCharts();
        appendOutput('Charts initialized successfully');
    } catch (error) {
        appendOutput(`Error initializing charts: ${error.message}`, 'error');
    }

    // WebSocket setup with reconnection
    function setupWebSocket() {
        ws = new WebSocket(`ws://${window.location.host}`);
        
        ws.onopen = () => {
            appendOutput('Connected to server');
            disableTestControls(false);
        };
        
        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                
                switch (message.type) {
                    case 'metrics':
                        if (message.data) {
                            updateCharts(message.data);
                        }
                        break;
                    case 'output':
                        if (message.data) {
                            appendOutput(message.data);
                        }
                        break;
                    case 'error':
                        appendOutput(`Error: ${message.message}`, 'error');
                        break;
                    case 'completed':
                        testCompleted(message.code);
                        if (message.resultsFile) {
                            loadTestResults();
                        }
                        break;
                    default:
                        console.log('Unknown message type:', message.type);
                }
            } catch (error) {
                console.error('Error processing message:', error);
                appendOutput(`Error processing message: ${error.message}`, 'error');
            }
        };

        ws.onclose = () => {
            appendOutput('Connection lost. Attempting to reconnect...', 'error');
            disableTestControls(true);
            setTimeout(setupWebSocket, 3000);
        };

        ws.onerror = (error) => {
            appendOutput(`WebSocket error: ${error.message}`, 'error');
        };
    }

    setupWebSocket();

    // Event Listeners
    convertCurlBtn.addEventListener('click', async () => {
        const curl = curlInput.value.trim();
        if (!curl) {
            appendOutput('Please enter a curl command', 'error');
            return;
        }

        try {
            convertCurlBtn.disabled = true;
            const response = await fetch('/api/parse-curl', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ curl })
            });

            const data = await response.json();
            if (data.success) {
                editor.setValue(data.script);
                appendOutput('Successfully converted curl command to k6 script');
            } else {
                appendOutput(`Error converting curl: ${data.error}`, 'error');
            }
        } catch (error) {
            appendOutput(`Error: ${error.message}`, 'error');
        } finally {
            convertCurlBtn.disabled = false;
        }
    });

    runTestBtn.addEventListener('click', async () => {
        if (!editor) {
            appendOutput('Editor not initialized', 'error');
            return;
        }

        const script = editor.getValue().trim();
        if (!script) {
            appendOutput('Please enter a test script', 'error');
            return;
        }

        // Only add options if they're not already in the script
        const hasOptions = script.includes('export const options');
        const options = hasOptions ? null : {
            stages: [
                { duration: '30s', target: parseInt(vuCount.value) || 1 },
                { duration: `${parseInt(duration.value)}s`, target: parseInt(maxVUs.value) || 20 },
                { duration: '30s', target: 0 }
            ],
            thresholds: {
                'http_req_duration': ['p(95)<500'],
                'errors': ['rate<0.1']
            }
        };

        try {
            const response = await fetch('/api/run-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ script, options })
            });

            const data = await response.json();
            if (data.success) {
                testStarted();
            } else {
                appendOutput(`Error starting test: ${data.error}`, 'error');
            }
        } catch (error) {
            appendOutput(`Error: ${error.message}`, 'error');
        }
    });

    stopTestBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/stop-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            if (data.success) {
                appendOutput('Test stopped by user');
                testCompleted();
            } else {
                appendOutput(`Error stopping test: ${data.error}`, 'error');
            }
        } catch (error) {
            appendOutput(`Error: ${error.message}`, 'error');
        }
    });

    // Helper functions
    function appendOutput(text, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const colorClass = type === 'error' ? 'text-red-500' : 'text-green-400';
        outputArea.innerHTML += `<div class="${colorClass}">[${timestamp}] ${text}</div>`;
        outputArea.scrollTop = outputArea.scrollHeight;
        console.log(`[${type}] ${text}`); // Also log to console for debugging
    }

    function testStarted() {
        runTestBtn.disabled = true;
        stopTestBtn.disabled = false;
        runTestBtn.classList.add('running');
        outputArea.innerHTML = ''; // Clear previous output
        appendOutput('Test started...');
        resetCharts();
    }

    function testCompleted(code = null) {
        runTestBtn.disabled = false;
        stopTestBtn.disabled = true;
        runTestBtn.classList.remove('running');
        if (code !== null) {
            appendOutput(`Test completed with exit code: ${code}`);
        }
    }

    function disableTestControls(disabled) {
        runTestBtn.disabled = disabled;
        stopTestBtn.disabled = !disabled;
        convertCurlBtn.disabled = disabled;
    }

    function initializeCharts() {
        const chartConfig = {
            type: 'line',
            options: {
                responsive: true,
                animation: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'second'
                        }
                    },
                    y: {
                        beginAtZero: true
                    }
                }
            }
        };

        charts.vus = new Chart(document.getElementById('vuChart'), {
            ...chartConfig,
            data: {
                datasets: [{
                    label: 'Virtual Users',
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    data: []
                }]
            }
        });

        charts.rps = new Chart(document.getElementById('rpsChart'), {
            ...chartConfig,
            data: {
                datasets: [{
                    label: 'Requests/sec',
                    borderColor: 'rgb(54, 162, 235)',
                    tension: 0.1,
                    data: []
                }]
            }
        });

        charts.responseTime = new Chart(document.getElementById('responseTimeChart'), {
            ...chartConfig,
            data: {
                datasets: [{
                    label: 'Response Time (ms)',
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1,
                    data: []
                }]
            }
        });

        charts.errors = new Chart(document.getElementById('errorChart'), {
            ...chartConfig,
            data: {
                datasets: [{
                    label: 'Errors',
                    borderColor: 'rgb(255, 159, 64)',
                    tension: 0.1,
                    data: []
                }]
            }
        });
    }

    function resetCharts() {
        Object.values(charts).forEach(chart => {
            chart.data.datasets[0].data = [];
            chart.update();
        });
    }

    function updateCharts(data) {
        // If data is undefined or null, return
        if (!data) return;

        // Handle both direct metrics and history
        const history = data.history || data;
        const current = data.current || data;

        // Update charts only if we have valid data
        if (history.timestamps && history.timestamps.length > 0) {
            charts.vus.data.datasets[0].data = history.vus.map((value, index) => ({
                x: new Date(history.timestamps[index]),
                y: value || 0
            }));
            
            charts.rps.data.datasets[0].data = history.rps.map((value, index) => ({
                x: new Date(history.timestamps[index]),
                y: value || 0
            }));
            
            charts.responseTime.data.datasets[0].data = history.responseTime.map((value, index) => ({
                x: new Date(history.timestamps[index]),
                y: value || 0
            }));
            
            charts.errors.data.datasets[0].data = history.errors.map((value, index) => ({
                x: new Date(history.timestamps[index]),
                y: value || 0
            }));

            Object.values(charts).forEach(chart => chart.update());
        } else if (current) {
            // Handle single data point
            const timestamp = new Date();
            
            if (current.vus !== undefined) {
                charts.vus.data.datasets[0].data.push({
                    x: timestamp,
                    y: current.vus
                });
            }
            
            if (current.rps !== undefined) {
                charts.rps.data.datasets[0].data.push({
                    x: timestamp,
                    y: current.rps
                });
            }
            
            if (current.responseTime !== undefined) {
                charts.responseTime.data.datasets[0].data.push({
                    x: timestamp,
                    y: current.responseTime
                });
            }
            
            if (current.errors !== undefined) {
                charts.errors.data.datasets[0].data.push({
                    x: timestamp,
                    y: current.errors
                });
            }

            // Limit the number of points to prevent memory issues
            const maxPoints = 100;
            Object.values(charts).forEach(chart => {
                if (chart.data.datasets[0].data.length > maxPoints) {
                    chart.data.datasets[0].data = chart.data.datasets[0].data.slice(-maxPoints);
                }
                chart.update();
            });
        }
    }

    async function loadTestResults() {
        try {
            const response = await fetch('/api/test-results');
            const data = await response.json();
            
            if (data.success) {
                resultsTable.innerHTML = data.results
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map(result => {
                        const isCSV = result.name.includes('test_results');
                        const isSummary = result.name.includes('test_summary');
                        return `
                            <tr>
                                <td class="px-4 py-2">${new Date(result.date).toLocaleString()}</td>
                                <td class="px-4 py-2">${result.name}</td>
                                <td class="px-4 py-2">${formatFileSize(result.size)}</td>
                                <td class="px-4 py-2">
                                    <a href="/api/test-results/${result.name}" 
                                       class="text-blue-500 hover:text-blue-700 mr-2"
                                       download>
                                        ${isCSV ? 'Download CSV' : isSummary ? 'Download Summary' : 'Download'}
                                    </a>
                                    ${isSummary ? `
                                    <button onclick="viewSummary('${result.name}')"
                                            class="text-green-500 hover:text-green-700">
                                        View Summary
                                    </button>
                                    ` : ''}
                                </td>
                            </tr>
                        `;
                    }).join('');

                // Add the viewSummary function to window
                window.viewSummary = async (filename) => {
                    try {
                        const response = await fetch(`/api/test-results/${filename}`);
                        const summary = await response.json();
                        
                        const summaryHTML = `
                            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                                <div class="bg-white p-6 rounded-lg max-w-2xl w-full mx-4">
                                    <h3 class="text-xl font-bold mb-4">Test Summary</h3>
                                    <div class="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <p class="font-semibold">Duration:</p>
                                            <p>${summary.duration} seconds</p>
                                        </div>
                                        <div>
                                            <p class="font-semibold">Total Requests:</p>
                                            <p>${summary.totalRequests.toFixed(0)}</p>
                                        </div>
                                        <div>
                                            <p class="font-semibold">Average RPS:</p>
                                            <p>${summary.averageRPS.toFixed(2)}</p>
                                        </div>
                                        <div>
                                            <p class="font-semibold">Max VUs:</p>
                                            <p>${summary.maxVUs}</p>
                                        </div>
                                        <div>
                                            <p class="font-semibold">Average Response Time:</p>
                                            <p>${summary.averageResponseTime.toFixed(2)} ms</p>
                                        </div>
                                        <div>
                                            <p class="font-semibold">P95 Response Time:</p>
                                            <p>${summary.p95ResponseTime.toFixed(2)} ms</p>
                                        </div>
                                        <div>
                                            <p class="font-semibold">Total Errors:</p>
                                            <p>${summary.totalErrors}</p>
                                        </div>
                                    </div>
                                    <button onclick="this.parentElement.parentElement.remove()"
                                            class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                                        Close
                                    </button>
                                </div>
                            </div>
                        `;
                        
                        document.body.insertAdjacentHTML('beforeend', summaryHTML);
                    } catch (error) {
                        appendOutput(`Error viewing summary: ${error.message}`, 'error');
                    }
                };
            }
        } catch (error) {
            appendOutput(`Error loading test results: ${error.message}`, 'error');
        }
    }

    function formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    function getDefaultScript() {
        return `import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Note: You can either define options here or use the UI controls
// If you define options here, the UI controls will be ignored
/*
export const options = {
    stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 20 },
        { duration: '30s', target: 0 },
    ],
    thresholds: {
        'http_req_duration': ['p(95)<500'],
        'errors': ['rate<0.1'],
    },
};
*/

export default function() {
    const res = http.get('http://test.k6.io');
    
    const success = check(res, {
        'is status 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500
    });

    errorRate.add(!success);
    sleep(1);
}`.trim();
    }

    // Load initial test results
    loadTestResults();
}); 