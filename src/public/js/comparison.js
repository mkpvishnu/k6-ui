// Handle report comparison functionality
async function compareSelectedReports() {
    try {
        const comparison = await reportsService.compareReports();
        showComparisonModal(comparison);
    } catch (error) {
        alert('Error comparing reports: ' + error.message);
    }
}

function showComparisonModal(comparison) {
    const modal = document.getElementById('comparison-modal');
    const content = document.getElementById('comparison-content');
    
    content.innerHTML = reportsService.generateComparisonHTML(comparison);
    modal.classList.remove('hidden');
}

function closeComparisonModal() {
    const modal = document.getElementById('comparison-modal');
    modal.classList.add('hidden');
}

async function loadReportsList() {
    try {
        const reports = await reportsService.loadReports();
        renderReportsList(reports);
    } catch (error) {
        console.error('Error loading reports:', error);
    }
}

function renderReportsList(reports) {
    const container = document.getElementById('reports-list');
    
    if (reports.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                No test reports available
            </div>
        `;
        return;
    }

    container.innerHTML = reports.map(report => `
        <div class="bg-gray-50 p-4 rounded-md" data-report-id="${report.id}">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <input type="checkbox" 
                        onchange="toggleReportSelection('${report.id}')"
                        class="h-4 w-4 text-blue-600"
                        ${reportsService.isReportSelected(report.id) ? 'checked' : ''}>
                    <div>
                        <h3 class="font-medium">${new Date(report.startTime).toLocaleString()}</h3>
                        <p class="text-sm text-gray-600">
                            Duration: ${Math.round(report.duration / 1000)}s | 
                            Requests: ${report.totalRequests} | 
                            Errors: ${report.errorCount}
                        </p>
                    </div>
                </div>
                <div class="flex space-x-2">
                    <button onclick="viewReport('${report.id}')" 
                        class="text-blue-500 hover:text-blue-700">
                        View
                    </button>
                    <button onclick="exportReport('${report.id}')" 
                        class="text-green-500 hover:text-green-700">
                        Export
                    </button>
                    <button onclick="deleteReport('${report.id}')" 
                        class="text-red-500 hover:text-red-700">
                        Delete
                    </button>
                </div>
            </div>
            ${report.thresholdsFailed > 0 ? `
                <div class="mt-2 text-sm text-red-600">
                    ${report.thresholdsFailed} threshold${report.thresholdsFailed > 1 ? 's' : ''} failed
                </div>
            ` : ''}
        </div>
    `).join('');
}

function toggleReportSelection(reportId) {
    reportsService.toggleReportSelection(reportId);
    updateCompareButton();
}

function updateCompareButton() {
    const button = document.getElementById('compare-reports-btn');
    button.disabled = reportsService.getSelectedCount() < 2;
}

function clearReportSelections() {
    reportsService.clearSelections();
    loadReportsList();
}

async function viewReport(reportId) {
    try {
        const report = await reportsService.loadReport(reportId);
        showReportModal(report);
    } catch (error) {
        alert('Error loading report: ' + error.message);
    }
}

function showReportModal(report) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl w-11/12 max-w-6xl max-h-[90vh] overflow-y-auto">
            <div class="p-6">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-2xl font-bold">Test Report Details</h2>
                    <div class="flex space-x-4">
                        <button onclick="exportReportAs('${report.id}', 'json')" 
                            class="text-blue-500 hover:text-blue-700">
                            Export JSON
                        </button>
                        <button onclick="exportReportAs('${report.id}', 'csv')" 
                            class="text-green-500 hover:text-green-700">
                            Export CSV
                        </button>
                        <button onclick="this.closest('.fixed').remove()" 
                            class="text-gray-500 hover:text-gray-700">
                            Close
                        </button>
                    </div>
                </div>
                ${generateReportDetailsHTML(report)}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function generateReportDetailsHTML(report) {
    return `
        <div class="space-y-6">
            <!-- Test Overview -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h3 class="font-semibold mb-2">Test Overview</h3>
                    <dl class="grid grid-cols-2 gap-2">
                        <dt>Start Time:</dt>
                        <dd>${new Date(report.startTime).toLocaleString()}</dd>
                        <dt>Duration:</dt>
                        <dd>${Math.round(report.duration / 1000)}s</dd>
                        <dt>Total Requests:</dt>
                        <dd>${report.requests.length}</dd>
                        <dt>Total Errors:</dt>
                        <dd>${report.errors.length}</dd>
                    </dl>
                </div>
                
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h3 class="font-semibold mb-2">Thresholds Summary</h3>
                    <dl class="grid grid-cols-2 gap-2">
                        <dt>Passed:</dt>
                        <dd class="text-green-600">${report.thresholds.passed.length}</dd>
                        <dt>Failed:</dt>
                        <dd class="text-red-600">${report.thresholds.failed.length}</dd>
                    </dl>
                </div>
            </div>

            <!-- Metrics Summary -->
            <div class="bg-gray-50 p-4 rounded-lg">
                <h3 class="font-semibold mb-4">Metrics Summary</h3>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    ${generateMetricsSummaryHTML(report.metrics)}
                </div>
            </div>

            <!-- Thresholds Details -->
            <div class="bg-gray-50 p-4 rounded-lg">
                <h3 class="font-semibold mb-4">Thresholds Details</h3>
                ${generateThresholdsHTML(report.thresholds)}
            </div>

            <!-- Requests Table -->
            <div class="bg-gray-50 p-4 rounded-lg">
                <h3 class="font-semibold mb-4">HTTP Requests</h3>
                <div class="overflow-x-auto">
                    ${generateRequestsTableHTML(report.requests)}
                </div>
            </div>

            <!-- Errors List -->
            ${report.errors.length > 0 ? `
                <div class="bg-red-50 p-4 rounded-lg">
                    <h3 class="font-semibold mb-4 text-red-700">Errors</h3>
                    ${generateErrorsListHTML(report.errors)}
                </div>
            ` : ''}
        </div>
    `;
}

async function exportReport(reportId) {
    try {
        await reportsService.exportReportCSV(reportId);
    } catch (error) {
        alert('Error exporting report: ' + error.message);
    }
}

async function exportReportAs(reportId, format) {
    try {
        if (format === 'csv') {
            await reportsService.exportReportCSV(reportId);
        } else {
            await reportsService.exportReportJSON(reportId);
        }
    } catch (error) {
        alert(`Error exporting report as ${format}: ${error.message}`);
    }
}

async function deleteReport(reportId) {
    if (!confirm('Are you sure you want to delete this report?')) {
        return;
    }

    try {
        await reportsService.deleteReport(reportId);
        loadReportsList();
    } catch (error) {
        alert('Error deleting report: ' + error.message);
    }
}

// Helper functions for generating HTML components
function generateMetricsSummaryHTML(metrics) {
    const metricNames = ['responseTime', 'rps', 'errorRate', 'vus'];
    return metricNames.map(metric => {
        const summary = metrics[`${metric}_summary`];
        if (!summary) return '';

        return `
            <div>
                <h4 class="font-medium mb-2">${formatMetricName(metric)}</h4>
                <dl class="grid grid-cols-2 gap-1 text-sm">
                    <dt>Min:</dt><dd>${summary.min.toFixed(2)}</dd>
                    <dt>Max:</dt><dd>${summary.max.toFixed(2)}</dd>
                    <dt>Avg:</dt><dd>${summary.avg.toFixed(2)}</dd>
                    <dt>P95:</dt><dd>${summary.p95.toFixed(2)}</dd>
                </dl>
            </div>
        `;
    }).join('');
}

function generateThresholdsHTML(thresholds) {
    return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <h4 class="font-medium mb-2 text-green-700">Passed Thresholds</h4>
                <ul class="space-y-1">
                    ${thresholds.passed.map(t => `
                        <li class="text-sm">
                            ${t.name}: ${t.value} ${t.threshold}
                        </li>
                    `).join('')}
                </ul>
            </div>
            ${thresholds.failed.length > 0 ? `
                <div>
                    <h4 class="font-medium mb-2 text-red-700">Failed Thresholds</h4>
                    <ul class="space-y-1">
                        ${thresholds.failed.map(t => `
                            <li class="text-sm">
                                ${t.name}: ${t.value} ${t.threshold}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `;
}

function generateRequestsTableHTML(requests) {
    return `
        <table class="min-w-full divide-y divide-gray-200">
            <thead>
                <tr class="bg-gray-100">
                    <th class="px-4 py-2 text-left">Time</th>
                    <th class="px-4 py-2 text-left">Method</th>
                    <th class="px-4 py-2 text-left">URL</th>
                    <th class="px-4 py-2 text-left">Status</th>
                    <th class="px-4 py-2 text-left">Duration</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
                ${requests.map(req => `
                    <tr>
                        <td class="px-4 py-2">${new Date(req.timestamp).toLocaleTimeString()}</td>
                        <td class="px-4 py-2">${req.method}</td>
                        <td class="px-4 py-2">${req.url}</td>
                        <td class="px-4 py-2">
                            <span class="px-2 py-1 rounded-full text-xs ${
                                req.status < 400 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }">
                                ${req.status}
                            </span>
                        </td>
                        <td class="px-4 py-2">${req.duration.toFixed(2)}ms</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function generateErrorsListHTML(errors) {
    return `
        <ul class="space-y-2">
            ${errors.map(error => `
                <li class="text-red-600">
                    <span class="font-medium">
                        ${new Date(error.timestamp).toLocaleTimeString()}:
                    </span>
                    ${error.message}
                </li>
            `).join('')}
        </ul>
    `;
}

function formatMetricName(metric) {
    const names = {
        responseTime: 'Response Time',
        rps: 'Requests/sec',
        errorRate: 'Error Rate',
        vus: 'Virtual Users'
    };
    return names[metric] || metric;
}