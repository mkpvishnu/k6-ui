// Available metrics for thresholds
const availableMetrics = {
    http_req_duration: {
        name: 'HTTP Request Duration',
        examples: ['p(95)<500', 'avg<200', 'max<1000']
    },
    http_req_failed: {
        name: 'HTTP Request Failures',
        examples: ['rate<0.01', 'rate==0']
    },
    http_reqs: {
        name: 'HTTP Requests Rate',
        examples: ['rate>100', 'count>1000']
    },
    vus: {
        name: 'Virtual Users',
        examples: ['value==10', 'value<100']
    },
    data_received: {
        name: 'Data Received',
        examples: ['rate>1000000', 'count>5000000']
    },
    data_sent: {
        name: 'Data Sent',
        examples: ['rate>500000', 'count>1000000']
    },
    iteration_duration: {
        name: 'Iteration Duration',
        examples: ['p(90)<10000', 'avg<5000']
    },
    iterations: {
        name: 'Iterations',
        examples: ['count>200', 'rate>10']
    }
};

let thresholds = [];

function addThreshold() {
    const thresholdId = `threshold-${Date.now()}`;
    const threshold = {
        id: thresholdId,
        metric: 'http_req_duration',
        condition: 'p(95)<500'
    };
    
    thresholds.push(threshold);
    renderThresholds();
}

function removeThreshold(thresholdId) {
    thresholds = thresholds.filter(t => t.id !== thresholdId);
    renderThresholds();
}

function renderThresholds() {
    const container = document.getElementById('thresholdsList');
    container.innerHTML = thresholds.map(threshold => `
        <div id="${threshold.id}" class="bg-gray-50 p-4 rounded-md">
            <div class="flex items-center space-x-4">
                <div class="flex-1">
                    <select 
                        onchange="updateThresholdMetric('${threshold.id}', this.value)"
                        class="w-full p-3 border rounded-md">
                        ${Object.entries(availableMetrics).map(([key, metric]) => `
                            <option value="${key}" ${key === threshold.metric ? 'selected' : ''}>
                                ${metric.name}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <div class="flex-1">
                    <input type="text"
                        value="${threshold.condition}"
                        onchange="updateThresholdCondition('${threshold.id}', this.value)"
                        class="w-full p-3 border rounded-md"
                        placeholder="e.g., p(95)<500">
                </div>
                
                <button onclick="removeThreshold('${threshold.id}')"
                    class="text-red-500 hover:text-red-700">
                    Remove
                </button>
            </div>
            
            <div class="mt-2 text-sm text-gray-500">
                Examples: ${availableMetrics[threshold.metric].examples.join(', ')}
            </div>
        </div>
    `).join('');
}

function updateThresholdMetric(thresholdId, metric) {
    const threshold = thresholds.find(t => t.id === thresholdId);
    if (threshold) {
        threshold.metric = metric;
        renderThresholds();
    }
}

function updateThresholdCondition(thresholdId, condition) {
    const threshold = thresholds.find(t => t.id === thresholdId);
    if (threshold) {
        threshold.condition = condition;
    }
}

// Get all threshold configurations
function getThresholdConfigs() {
    const config = {};
    thresholds.forEach(threshold => {
        config[threshold.metric] = config[threshold.metric] || [];
        config[threshold.metric].push(threshold.condition);
    });
    return config;
}