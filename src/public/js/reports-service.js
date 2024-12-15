// Reports Service - Handles client-side report operations
class ReportsService {
    constructor() {
        this.currentReport = null;
        this.selectedReports = new Set();
    }

    // Load all reports
    async loadReports() {
        try {
            const response = await fetch('/api/reports');
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error);
            }
            return data.reports;
        } catch (error) {
            console.error('Error loading reports:', error);
            throw error;
        }
    }

    // Load a specific report
    async loadReport(reportId) {
        try {
            const response = await fetch(`/api/reports/${reportId}`);
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error);
            }
            return data.report;
        } catch (error) {
            console.error('Error loading report:', error);
            throw error;
        }
    }

    // Save current report
    async saveCurrentReport() {
        if (!this.currentReport) {
            throw new Error('No current report to save');
        }

        try {
            const response = await fetch('/api/reports', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.currentReport)
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error);
            }

            return data.id;
        } catch (error) {
            console.error('Error saving report:', error);
            throw error;
        }
    }

    // Delete a report
    async deleteReport(reportId) {
        try {
            const response = await fetch(`/api/reports/${reportId}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error);
            }

            this.selectedReports.delete(reportId);
            return true;
        } catch (error) {
            console.error('Error deleting report:', error);
            throw error;
        }
    }

    // Export report as CSV
    async exportReportCSV(reportId) {
        try {
            const response = await fetch(`/api/reports/${reportId}/csv`);
            if (!response.ok) {
                throw new Error('Failed to export report');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `k6-report-${reportId}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting report:', error);
            throw error;
        }
    }

    // Compare selected reports
    async compareReports() {
        if (this.selectedReports.size < 2) {
            throw new Error('Select at least two reports to compare');
        }

        try {
            const response = await fetch('/api/reports/compare', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    reportIds: Array.from(this.selectedReports)
                })
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error);
            }

            return data.comparison;
        } catch (error) {
            console.error('Error comparing reports:', error);
            throw error;
        }
    }

    // Toggle report selection
    toggleReportSelection(reportId) {
        if (this.selectedReports.has(reportId)) {
            this.selectedReports.delete(reportId);
        } else {
            this.selectedReports.add(reportId);
        }
    }

    // Check if a report is selected
    isReportSelected(reportId) {
        return this.selectedReports.has(reportId);
    }

    // Get current report
    getCurrentReport() {
        return this.currentReport;
    }

    // Set current report
    setCurrentReport(report) {
        this.currentReport = report;
    }

    // Get selected reports count
    getSelectedCount() {
        return this.selectedReports.size;
    }

    // Clear all selections
    clearSelections() {
        this.selectedReports.clear();
    }

    // Generate comparison report HTML
    generateComparisonHTML(comparison) {
        return `
            <div class="comparison-report">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div class="bg-white p-4 rounded-lg shadow">
                        <h3 class="text-lg font-semibold mb-2">Overview</h3>
                        <dl class="grid grid-cols-2 gap-2">
                            <dt>Reports Compared:</dt>
                            <dd>${comparison.summary.count}</dd>
                            <dt>Time Range:</dt>
                            <dd>${new Date(comparison.summary.timeRange.start).toLocaleString()} - 
                                ${new Date(comparison.summary.timeRange.end).toLocaleString()}</dd>
                        </dl>
                    </div>
                    
                    <div class="bg-white p-4 rounded-lg shadow">
                        <h3 class="text-lg font-semibold mb-2">Thresholds</h3>
                        <dl class="grid grid-cols-2 gap-2">
                            <dt>Total Passed:</dt>
                            <dd class="text-green-600">${comparison.thresholds.passed}</dd>
                            <dt>Total Failed:</dt>
                            <dd class="text-red-600">${comparison.thresholds.failed}</dd>
                        </dl>
                    </div>
                </div>

                <div class="bg-white p-4 rounded-lg shadow mb-6">
                    <h3 class="text-lg font-semibold mb-4">Metrics Comparison</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        ${Object.entries(comparison.metrics).map(([metric, values]) => `
                            <div class="p-4 bg-gray-50 rounded-lg">
                                <h4 class="font-medium mb-2">${this.formatMetricName(metric)}</h4>
                                <dl class="grid grid-cols-2 gap-2 text-sm">
                                    <dt>Min:</dt><dd>${values.min.toFixed(2)}</dd>
                                    <dt>Max:</dt><dd>${values.max.toFixed(2)}</dd>
                                    <dt>Average:</dt><dd>${values.avg.toFixed(2)}</dd>
                                </dl>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
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
}

// Create global instance
const reportsService = new ReportsService();

// Export for use in other modules
window.reportsService = reportsService;