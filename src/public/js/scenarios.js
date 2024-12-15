// Manage test scenarios
let scenarios = [];

function addScenario() {
    const scenarioId = `scenario-${Date.now()}`;
    const scenario = {
        id: scenarioId,
        name: `Scenario ${scenarios.length + 1}`,
        executor: 'shared-iterations',
        config: {}
    };
    
    scenarios.push(scenario);
    renderScenarios();
}

function removeScenario(scenarioId) {
    scenarios = scenarios.filter(s => s.id !== scenarioId);
    renderScenarios();
}

function renderScenarios() {
    const container = document.getElementById('scenariosList');
    container.innerHTML = scenarios.map(scenario => `
        <div id="${scenario.id}" class="bg-gray-50 p-4 rounded-md">
            <div class="flex justify-between items-center mb-4">
                <input type="text" 
                    value="${scenario.name}"
                    onchange="updateScenarioName('${scenario.id}', this.value)"
                    class="text-lg font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none">
                <button onclick="removeScenario('${scenario.id}')"
                    class="text-red-500 hover:text-red-700">
                    Remove
                </button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        Executor Type
                    </label>
                    <select 
                        onchange="updateScenarioExecutor('${scenario.id}', this.value)"
                        class="w-full p-3 border rounded-md">
                        ${Object.keys(executorConfigs).map(type => `
                            <option value="${type}" ${type === scenario.executor ? 'selected' : ''}>
                                ${type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <div id="${scenario.id}-config">
                    ${renderExecutorConfig(scenario)}
                </div>
            </div>
        </div>
    `).join('');
}

function renderExecutorConfig(scenario) {
    const config = executorConfigs[scenario.executor];
    return config.map(option => {
        if (option.type === 'stages') {
            return `
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        ${option.label}
                    </label>
                    <div id="${scenario.id}-${option.id}" class="space-y-2">
                        ${createStagesInputs(scenario.config[option.id] || option.default)}
                    </div>
                    <button onclick="addScenarioStage('${scenario.id}', '${option.id}')"
                        class="mt-2 text-sm text-blue-500 hover:text-blue-700">
                        + Add Stage
                    </button>
                </div>
            `;
        }
        
        return `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                    ${option.label}
                </label>
                <input type="${option.type}"
                    value="${scenario.config[option.id] || option.default}"
                    onchange="updateScenarioConfig('${scenario.id}', '${option.id}', this.value)"
                    class="w-full p-3 border rounded-md"
                    ${option.type === 'number' ? 'min="0"' : ''}>
            </div>
        `;
    }).join('');
}

function updateScenarioName(scenarioId, name) {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (scenario) {
        scenario.name = name;
    }
}

function updateScenarioExecutor(scenarioId, executor) {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (scenario) {
        scenario.executor = executor;
        scenario.config = {};
        renderScenarios();
    }
}

function updateScenarioConfig(scenarioId, key, value) {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (scenario) {
        scenario.config[key] = value;
    }
}

function addScenarioStage(scenarioId, optionId) {
    const container = document.getElementById(`${scenarioId}-${optionId}`);
    const div = document.createElement('div');
    div.className = 'flex space-x-2 items-center stage-row';
    div.innerHTML = `
        <input type="text" class="flex-1 p-2 border rounded-md" placeholder="Duration (e.g., 30s, 1m)">
        <input type="number" class="flex-1 p-2 border rounded-md" placeholder="Target VUs">
        <button onclick="removeStage(this)" class="text-red-500 hover:text-red-700">×</button>
    `;
    container.appendChild(div);
    updateScenarioStages(scenarioId, optionId);
}

function updateScenarioStages(scenarioId, optionId) {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (scenario) {
        const container = document.getElementById(`${scenarioId}-${optionId}`);
        const stageRows = container.getElementsByClassName('stage-row');
        scenario.config[optionId] = Array.from(stageRows).map(row => {
            const [durationInput, targetInput] = row.getElementsByTagName('input');
            return {
                duration: durationInput.value,
                target: parseInt(targetInput.value)
            };
        });
    }
}

// Get all scenario configurations
function getScenarioConfigs() {
    return scenarios.map(scenario => ({
        name: scenario.name,
        executor: scenario.executor,
        config: scenario.config
    }));
}