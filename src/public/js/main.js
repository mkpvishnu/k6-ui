// Global state
let editor;
let testRunning = false;
let ws;

// Initialize Monaco Editor
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });

require(['vs/editor/editor.main'], function() {
    editor = monaco.editor.create(document.getElementById('monaco-editor'), {
        value: getDefaultScript(),
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true
    });
});

// WebSocket connection
function connectWebSocket() {
    ws = new WebSocket(`ws://${window.location.host}`);

    ws.onopen = () => {
        console.log('WebSocket connected');
        updateStatus('Ready');
    };

    ws.onmessage = (event) => {
        try {
            // Try to parse as JSON first
            const data = JSON.parse(event.data);
            handleJsonMessage(data);
        } catch (e) {
            // If not JSON, treat as raw k6 output
            handleRawOutput(event.data);
        }
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected');
        setTimeout(connectWebSocket, 5000);
    };
}

// Handle JSON messages
function handleJsonMessage(data) {
    if (data.type === 'completed') {
        testRunning = false;
        updateStatus('Completed');
        enableRunButton();
    } else if (data.type === 'error') {
        updateConsoleOutput('Error: ' + data.message);
    }
}

// Handle raw k6 output
function handleRawOutput(output) {
    updateConsoleOutput(output);
    const metrics = parseMetrics(output);
    if (metrics) {
        updateCharts(metrics);
        updateMetricsDisplay(metrics);
    }
}

// Parse k6 metrics from output
function parseMetrics(output) {
    const metrics = {};
    
    // Common k6 metric patterns
    const patterns = {
        vus: /vus=(\d+)/,
        rps: /http_reqs=(\d+(\.\d+)?)/,
        responseTime: /http_req_duration=(\d+(\.\d+)?)/,
        errorRate: /http_req_failed=(\d+(\.\d+)?)/
    };

    for (const [key, pattern] of Object.entries(patterns)) {
        const match = output.match(pattern);
        if (match) {
            metrics[key] = parseFloat(match[1]);
        }
    }

    return Object.keys(metrics).length > 0 ? metrics : null;
}

// Run test
async function runTest() {
    if (testRunning) return;

    try {
        const script = editor.getValue();
        const response = await fetch('/api/run-test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ script })
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error);
        }

        testRunning = true;
        updateStatus('Running');
        disableRunButton();
        clearConsoleOutput();
        resetCharts();
    } catch (error) {
        updateStatus('Failed');
        updateConsoleOutput('Error: ' + error.message);
    }
}

// Stop test
async function stopTest() {
    if (!testRunning) return;

    try {
        const response = await fetch('/api/stop-test', {
            method: 'POST'
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error);
        }

        testRunning = false;
        updateStatus('Stopped');
        enableRunButton();
    } catch (error) {
        updateConsoleOutput('Error stopping test: ' + error.message);
    }
}

// Convert curl command
async function convertCurl() {
    const curlInput = document.getElementById('curlInput');
    const curl = curlInput.value.trim();

    if (!curl) {
        alert('Please enter a cURL command');
        return;
    }

    try {
        const response = await fetch('/api/parse-curl', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ curl })
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error);
        }

        editor.setValue(result.script);
        curlInput.value = '';
    } catch (error) {
        alert('Error converting cURL command: ' + error.message);
    }
}

// UI update functions
function updateStatus(status) {
    document.getElementById('testStatus').textContent = status;
}

function updateConsoleOutput(text) {
    const console = document.getElementById('consoleOutput');
    console.textContent += text;
    console.scrollTop = console.scrollHeight;
}

function clearConsoleOutput() {
    document.getElementById('consoleOutput').textContent = '';
}

function enableRunButton() {
    const runBtn = document.getElementById('run-test-btn');
    const stopBtn = document.getElementById('stop-test-btn');
    runBtn.disabled = false;
    stopBtn.disabled = true;
    runBtn.classList.remove('opacity-50');
    stopBtn.classList.add('opacity-50');
}

function disableRunButton() {
    const runBtn = document.getElementById('run-test-btn');
    const stopBtn = document.getElementById('stop-test-btn');
    runBtn.disabled = true;
    stopBtn.disabled = false;
    runBtn.classList.add('opacity-50');
    stopBtn.classList.remove('opacity-50');
}

// Default script
function getDefaultScript() {
    return `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    vus: 10,
    duration: '30s',
};

export default function() {
    const res = http.get('https://test.k6.io');
    
    check(res, {
        'is status 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500
    });

    sleep(1);
}`;
}

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
});