// Tab management
const tabs = [
    { id: 'script', label: 'Script Editor' },
    { id: 'config', label: 'Test Configuration' },
    { id: 'scenarios', label: 'Scenarios' },
    { id: 'thresholds', label: 'Thresholds' },
    { id: 'env', label: 'Environment' },
    { id: 'reports', label: 'Reports' }
];

// Initialize tabs
function initializeTabs() {
    const tabNav = document.querySelector('.tab-navigation');
    
    // Create tab buttons
    tabNav.innerHTML = tabs.map(tab => `
        <button 
            onclick="switchTab('${tab.id}')" 
            class="tab-button px-3 py-2 rounded-md" 
            data-tab="${tab.id}">
            ${tab.label}
        </button>
    `).join('');

    // Set default active tab
    switchTab('script');
}

// Switch between tabs
function switchTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        if (button.dataset.tab === tabId) {
            button.classList.add('bg-blue-500', 'text-white');
        } else {
            button.classList.remove('bg-blue-500', 'text-white');
        }
    });

    // Show/hide tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('hidden', content.id !== `${tabId}-tab`);
    });

    // Special handling for reports tab
    if (tabId === 'reports') {
        updateReportsTab();
    }
}

// Update reports tab content
function updateReportsTab() {
    const reportsContainer = document.getElementById('reports-content');
    
    if (testRunning) {
        // Show live test report
        reportsContainer.innerHTML = `
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-xl font-semibold mb-4">Current Test Report</h2>
                ${testReports.generateHTMLReport()}
                <div class="mt-4 flex space-x-4">
                    <button onclick="exportReport('json')" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                        Export JSON
                    </button>
                    <button onclick="exportReport('csv')" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                        Export CSV
                    </button>
                </div>
            </div>
        `;
    } else if (testReports.testHistory.length > 0) {
        // Show test history
        reportsContainer.innerHTML = `
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-xl font-semibold mb-4">Test History</h2>
                <div class="space-y-4">
                    ${testReports.testHistory.map((test, index) => `
                        <div class="border-b pb-4">
                            <h3 class="text-lg font-medium mb-2">
                                Test Run - ${test.startTime.toLocaleString()}
                            </h3>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <span class="text-gray-600">Duration:</span>
                                    <span class="font-medium">${Math.round(test.duration / 1000)}s</span>
                                </div>
                                <div>
                                    <span class="text-gray-600">Total Requests:</span>
                                    <span class="font-medium">${test.requests.length}</span>
                                </div>
                                <div>
                                    <span class="text-gray-600">Errors:</span>
                                    <span class="font-medium">${test.errors.length}</span>
                                </div>
                                <div>
                                    <span class="text-gray-600">Status:</span>
                                    <span class="font-medium ${test.thresholds.failed.length === 0 ? 'text-green-600' : 'text-red-600'}">
                                        ${test.thresholds.failed.length === 0 ? 'Passed' : 'Failed'}
                                    </span>
                                </div>
                            </div>
                            <div class="flex space-x-4">
                                <button onclick="showDetailedReport(${index})" class="text-blue-500 hover:text-blue-700">
                                    View Details
                                </button>
                                <button onclick="exportHistoricalReport(${index}, 'json')" class="text-blue-500 hover:text-blue-700">
                                    Export JSON
                                </button>
                                <button onclick="exportHistoricalReport(${index}, 'csv')" class="text-green-500 hover:text-green-700">
                                    Export CSV
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } else {
        // Show empty state
        reportsContainer.innerHTML = `
            <div class="bg-white rounded-lg shadow-md p-6 text-center">
                <h2 class="text-xl font-semibold mb-4">No Test Reports Available</h2>
                <p class="text-gray-600">Run a test to generate reports and view results here.</p>
            </div>
        `;
    }
}

// Show detailed report for a historical test
function showDetailedReport(index) {
    const test = testReports.testHistory[index];
    const modalContent = testReports.generateHTMLReport(test);
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl w-11/12 max-w-6xl max-h-[90vh] overflow-y-auto">
            <div class="p-6">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-2xl font-bold">Test Report Details</h2>
                    <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                ${modalContent}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Export report in specified format
function exportReport(format) {
    let content;
    let filename;
    let type;

    if (format === 'json') {
        content = testReports.exportJSON();
        filename = 'k6-test-report.json';
        type = 'application/json';
    } else if (format === 'csv') {
        content = testReports.exportCSV();
        filename = 'k6-test-report.csv';
        type = 'text/csv';
    }

    if (!content) return;

    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Export historical report
function exportHistoricalReport(index, format) {
    const test = testReports.testHistory[index];
    let content;
    let filename;
    let type;

    if (format === 'json') {
        content = JSON.stringify(test, null, 2);
        filename = `k6-test-report-${test.startTime.toISOString()}.json`;
        type = 'application/json';
    } else if (format === 'csv') {
        content = testReports.generateCSVFromTest(test);
        filename = `k6-test-report-${test.startTime.toISOString()}.csv`;
        type = 'text/csv';
    }

    if (!content) return;

    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}