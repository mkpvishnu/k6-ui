// Script templates for different test types
const scriptTemplates = {
    http: `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    vus: 10,
    duration: '30s',
    thresholds: {
        http_req_duration: ['p(95)<500'],
        http_req_failed: ['rate<0.01'],
    },
};

export default function () {
    const res = http.get('https://test.k6.io');
    check(res, {
        'is status 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500
    });
    sleep(1);
}`,

    browser: `import { browser } from 'k6/experimental/browser';
import { check } from 'k6';

export const options = {
    scenarios: {
        browser: {
            executor: 'shared-iterations',
            options: {
                browser: {
                    type: 'chromium',
                },
            },
        },
    },
    thresholds: {
        checks: ['rate>=0.9'],
    },
};

export default async function () {
    const page = browser.newPage();

    try {
        await page.goto('https://test.k6.io');
        
        check(page, {
            'header visible': () => page.locator('h1').isVisible(),
            'content loaded': () => page.locator('#content').isVisible()
        });

        // Simulate user interactions
        await page.locator('#search').type('test');
        await page.locator('#submit').click();
        
        // Wait for response
        await page.waitForSelector('.results');
        
    } finally {
        page.close();
    }
}`,

    websocket: `import ws from 'k6/ws';
import { check } from 'k6';

export const options = {
    vus: 10,
    duration: '30s',
    thresholds: {
        'ws_connecting_duration': ['p(95)<1000'],
        'ws_msgs_received': ['count>100'],
    },
};

export default function () {
    const url = 'ws://echo.websocket.org';
    const params = { tags: { my_tag: 'hello' } };

    const res = ws.connect(url, params, function (socket) {
        socket.on('open', () => {
            console.log('connected');
            socket.send('Hello WebSocket!');
        });

        socket.on('message', (data) => {
            console.log('Message received: ' + data);
            check(data, { 'is correct message': (d) => d === 'Hello WebSocket!' });
        });

        socket.on('close', () => console.log('disconnected'));
    });

    check(res, { 'status is 101': (r) => r && r.status === 101 });
}`,

    rest: `import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export const errorRate = new Rate('errors');

export const options = {
    stages: [
        { duration: '1m', target: 20 },
        { duration: '2m', target: 20 },
        { duration: '1m', target: 0 },
    ],
    thresholds: {
        'http_req_duration': ['p(95)<500'],
        'errors': ['rate<0.1'],
    },
};

const BASE_URL = 'https://api.example.com';

export default function () {
    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_TOKEN'
        },
    };

    group('API Testing', function () {
        // GET request
        group('Get Data', function () {
            const res = http.get(\`\${BASE_URL}/data\`, params);
            check(res, {
                'status is 200': (r) => r.status === 200,
                'response is valid': (r) => r.body.length > 0,
            }) || errorRate.add(1);
        });

        // POST request
        group('Create Item', function () {
            const payload = JSON.stringify({
                name: 'test item',
                value: 123
            });
            const res = http.post(\`\${BASE_URL}/items\`, payload, params);
            check(res, {
                'status is 201': (r) => r.status === 201,
                'item created': (r) => r.json('id') !== undefined,
            }) || errorRate.add(1);
        });

        sleep(1);
    });
}`,

    load: `import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');
export const reqDuration = new Trend('req_duration');

export const options = {
    scenarios: {
        load_test: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '2m', target: 100 },  // Ramp up
                { duration: '5m', target: 100 },  // Stay at peak
                { duration: '2m', target: 0 },    // Ramp down
            ],
        },
    },
    thresholds: {
        'http_req_duration': ['p(95)<2000'],  // 95% of requests should be below 2s
        'http_reqs': ['rate>100'],            // Throughput should be at least 100 RPS
        'errors': ['rate<0.1'],               // Error rate should be below 10%
    },
};

function makeRequest() {
    const start = new Date();
    const res = http.get('https://test.k6.io');
    const duration = new Date() - start;

    // Add to custom trend metric
    reqDuration.add(duration);

    // Checks
    const checkRes = check(res, {
        'status is 200': (r) => r.status === 200,
        'response time OK': (r) => r.timings.duration < 2000,
    });

    // If any check fails, add to error rate
    if (!checkRes) {
        errorRate.add(1);
    }

    sleep(1);
}

export default function () {
    makeRequest();
}`,

    stress: `import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export const options = {
    stages: [
        { duration: '2m', target: 100 },   // Ramp up to 100 users
        { duration: '5m', target: 100 },   // Stay at 100 for 5 minutes
        { duration: '2m', target: 200 },   // Ramp up to 200 users
        { duration: '5m', target: 200 },   // Stay at 200 for 5 minutes
        { duration: '2m', target: 300 },   // Ramp up to 300 users
        { duration: '5m', target: 300 },   // Stay at 300 for 5 minutes
        { duration: '2m', target: 0 },     // Ramp down to 0 users
    ],
    thresholds: {
        http_req_duration: ['p(99)<3000'], // 99% of requests must complete below 3s
        http_req_failed: ['rate<0.05'],    // Error rate must be below 5%
    },
};

const API_BASE_URL = 'https://test.k6.io';

export default function () {
    // GET request
    const responses = http.batch([
        ['GET', \`\${API_BASE_URL}/public/crocodiles/\`],
        ['GET', \`\${API_BASE_URL}/public/crocodiles/1/\`],
        ['GET', \`\${API_BASE_URL}/public/crocodiles/2/\`],
    ]);

    // Check all responses
    responses.forEach((res) => {
        check(res, {
            'status is 200': (r) => r.status === 200,
            'response time OK': (r) => r.timings.duration < 3000,
        });
    });

    sleep(1);
}`,
};

// Function to load a template
function loadTemplate(type) {
    if (scriptTemplates[type]) {
        editor.setValue(scriptTemplates[type]);
    }
}

// Initialize Monaco Editor
require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.33.0/min/vs' } });

let editor;

require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(document.getElementById('monaco-editor'), {
        value: scriptTemplates.http,
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        fontSize: 14,
        tabSize: 2,
        wordWrap: 'on',
        suggestOnTriggerCharacters: true,
    });

    // Add k6-specific completions
    monaco.languages.registerCompletionItemProvider('javascript', {
        provideCompletionItems: function (model, position) {
            return {
                suggestions: [
                    {
                        label: 'k6',
                        kind: monaco.languages.CompletionItemKind.Module,
                        insertText: 'k6',
                        documentation: 'k6 testing framework'
                    },
                    {
                        label: 'check',
                        kind: monaco.languages.CompletionItemKind.Function,
                        insertText: 'check(${1:value}, {\n\t${2:description}: (${3:r}) => ${4:condition}\n})',
                        insertTextRules: monaco.languages.CompletionItemRules.InsertAsSnippet,
                        documentation: 'k6 check function'
                    },
                    // Add more k6-specific suggestions here
                ]
            };
        }
    });
});