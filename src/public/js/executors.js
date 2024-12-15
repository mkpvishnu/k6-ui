// Executor configuration options
const executorConfigs = {
    'shared-iterations': [
        { id: 'vus', label: 'Virtual Users', type: 'number', default: 1 },
        { id: 'iterations', label: 'Total Iterations', type: 'number', default: 10 }
    ],
    'per-vu-iterations': [
        { id: 'vus', label: 'Virtual Users', type: 'number', default: 1 },
        { id: 'iterations', label: 'Iterations per VU', type: 'number', default: 10 }
    ],
    'constant-vus': [
        { id: 'vus', label: 'Virtual Users', type: 'number', default: 1 },
        { id: 'duration', label: 'Duration', type: 'text', default: '30s' }
    ],
    'ramping-vus': [
        { id: 'startVUs', label: 'Start VUs', type: 'number', default: 0 },
        { id: 'stages', label: 'Stages', type: 'stages', default: [
            { duration: '30s', target: 10 },
            { duration: '1m', target: 20 },
            { duration: '30s', target: 0 }
        ]}
    ],
    'constant-arrival-rate': [
        { id: 'rate', label: 'Rate', type: 'number', default: 30 },
        { id: 'timeUnit', label: 'Time Unit', type: 'select', options: ['1s', '1m', '1h'], default: '1s' },
        { id: 'duration', label: 'Duration', type: 'text', default: '30s' },
        { id: 'preAllocatedVUs', label: 'Pre-allocated VUs', type: 'number', default: 1 },
        { id: 'maxVUs', label: 'Max VUs', type: 'number', default: 100 }
    ],
    'ramping-arrival-rate': [
        { id: 'startRate', label: 'Start Rate', type: 'number', default: 0 },
        { id: 'timeUnit', label: 'Time Unit', type: 'select', options: ['1s', '1m', '1h'], default: '1s' },
        { id: 'stages', label: 'Stages', type: 'stages', default: [
            { duration: '30s', target: 10 },
            { duration: '1m', target: 20 },
            { duration: '30s', target: 0 }
        ]},
        { id: 'preAllocatedVUs', label: 'Pre-allocated VUs', type: 'number', default: 1 },
        { id: 'maxVUs', label: 'Max VUs', type: 'number', default: 100 }
    ],
    'externally-controlled': [
        { id: 'vus', label: 'Initial VUs', type: 'number', default: 0 },
        { id: 'maxVUs', label: 'Max VUs', type: 'number', default: 100 }
    ]
};

// Update executor options based on selected executor type
function updateExecutorOptions() {
    const executorType = document.getElementById('executorType').value;
    const optionsContainer = document.getElementById('executorOptions');
    optionsContainer.innerHTML = '';

    const config = executorConfigs[executorType];
    config.forEach(option => {
        const div = document.createElement('div');
        
        if (option.type === 'stages') {
            div.innerHTML = `
                <label class="block text-sm font-medium text-gray-700 mb-2">${option.label}</label>
                <div id="${option.id}Container" class="space-y-2">
                    ${createStagesInputs(option.default)}
                </div>
                <button onclick="addStage('${option.id}Container')" class="mt-2 text-sm text-blue-500 hover:text-blue-700">
                    + Add Stage
                </button>
            `;
        } else if (option.type === 'select') {
            div.innerHTML = `
                <label class="block text-sm font-medium text-gray-700 mb-2">${option.label}</label>
                <select id="${option.id}" class="w-full p-3 border rounded-md">
                    ${option.options.map(opt => `
                        <option value="${opt}" ${opt === option.default ? 'selected' : ''}>
                            ${opt}
                        </option>
                    `).join('')}
                </select>
            `;
        } else {
            div.innerHTML = `
                <label class="block text-sm font-medium text-gray-700 mb-2">${option.label}</label>
                <input type="${option.type}" id="${option.id}" 
                    class="w-full p-3 border rounded-md" 
                    value="${option.default}"
                    ${option.type === 'number' ? 'min="0"' : ''}>
            `;
        }
        
        optionsContainer.appendChild(div);
    });
}

// Create inputs for stages configuration
function createStagesInputs(stages) {
    return stages.map((stage, index) => `
        <div class="flex space-x-2 items-center stage-row">
            <input type="text" 
                class="flex-1 p-2 border rounded-md" 
                placeholder="Duration (e.g., 30s, 1m)"
                value="${stage.duration}">
            <input type="number" 
                class="flex-1 p-2 border rounded-md" 
                placeholder="Target VUs"
                value="${stage.target}">
            <button onclick="removeStage(this)" class="text-red-500 hover:text-red-700">
                ×
            </button>
        </div>
    `).join('');
}

// Add a new stage input row
function addStage(containerId) {
    const container = document.getElementById(containerId);
    const div = document.createElement('div');
    div.className = 'flex space-x-2 items-center stage-row';
    div.innerHTML = `
        <input type="text" class="flex-1 p-2 border rounded-md" placeholder="Duration (e.g., 30s, 1m)">
        <input type="number" class="flex-1 p-2 border rounded-md" placeholder="Target VUs">
        <button onclick="removeStage(this)" class="text-red-500 hover:text-red-700">×</button>
    `;
    container.appendChild(div);
}

// Remove a stage input row
function removeStage(button) {
    const row = button.parentElement;
    if (row.parentElement.getElementsByClassName('stage-row').length > 1) {
        row.remove();
    }
}

// Get current executor configuration
function getExecutorConfig() {
    const executorType = document.getElementById('executorType').value;
    const config = { executorType };
    
    executorConfigs[executorType].forEach(option => {
        if (option.type === 'stages') {
            const stagesContainer = document.getElementById(`${option.id}Container`);
            const stageRows = stagesContainer.getElementsByClassName('stage-row');
            const stages = Array.from(stageRows).map(row => {
                const [durationInput, targetInput] = row.getElementsByTagName('input');
                return {
                    duration: durationInput.value,
                    target: parseInt(targetInput.value)
                };
            });
            config[option.id] = stages;
        } else {
            const element = document.getElementById(option.id);
            config[option.id] = option.type === 'number' ? parseInt(element.value) : element.value;
        }
    });
    
    return config;
}

// Initialize executor options on page load
document.addEventListener('DOMContentLoaded', updateExecutorOptions);