// Manage environment variables
let environmentVariables = [];

function addEnvironmentVariable() {
    const varId = `env-${Date.now()}`;
    const variable = {
        id: varId,
        name: '',
        value: ''
    };
    
    environmentVariables.push(variable);
    renderEnvironmentVariables();
}

function removeEnvironmentVariable(varId) {
    environmentVariables = environmentVariables.filter(v => v.id !== varId);
    renderEnvironmentVariables();
}

function renderEnvironmentVariables() {
    const container = document.getElementById('envVarsList');
    container.innerHTML = environmentVariables.map(variable => `
        <div id="${variable.id}" class="bg-gray-50 p-4 rounded-md">
            <div class="flex space-x-4">
                <div class="flex-1">
                    <input type="text"
                        value="${variable.name}"
                        onchange="updateEnvVarName('${variable.id}', this.value)"
                        class="w-full p-3 border rounded-md"
                        placeholder="Variable Name">
                </div>
                
                <div class="flex-1">
                    <input type="${variable.secure ? 'password' : 'text'}"
                        value="${variable.value}"
                        onchange="updateEnvVarValue('${variable.id}', this.value)"
                        class="w-full p-3 border rounded-md"
                        placeholder="Value">
                </div>
                
                <div class="flex items-center">
                    <label class="flex items-center mr-4">
                        <input type="checkbox"
                            ${variable.secure ? 'checked' : ''}
                            onchange="toggleEnvVarSecure('${variable.id}', this.checked)"
                            class="mr-2">
                        Secure
                    </label>
                    
                    <button onclick="removeEnvironmentVariable('${variable.id}')"
                        class="text-red-500 hover:text-red-700">
                        Remove
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function updateEnvVarName(varId, name) {
    const variable = environmentVariables.find(v => v.id === varId);
    if (variable) {
        variable.name = name;
    }
}

function updateEnvVarValue(varId, value) {
    const variable = environmentVariables.find(v => v.id === varId);
    if (variable) {
        variable.value = value;
    }
}

function toggleEnvVarSecure(varId, secure) {
    const variable = environmentVariables.find(v => v.id === varId);
    if (variable) {
        variable.secure = secure;
        renderEnvironmentVariables();
    }
}

// Get all environment variables
function getEnvironmentVariables() {
    const env = {};
    environmentVariables.forEach(variable => {
        if (variable.name && variable.value) {
            env[variable.name] = variable.value;
        }
    });
    return env;
}

// Load environment variables
function loadEnvironmentVariables(env) {
    environmentVariables = Object.entries(env).map(([name, value]) => ({
        id: `env-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        value,
        secure: false
    }));
    renderEnvironmentVariables();
}