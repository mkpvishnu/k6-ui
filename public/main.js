// Update the WebSocket message handler
socket.onmessage = function(event) {
    try {
        const message = JSON.parse(event.data);
        
        switch(message.type) {
            case 'metrics':
                if (message.data && message.data.current) {
                    updateMetrics(message.data.current);
                }
                if (message.data && message.data.history) {
                    updateCharts(message.data.history);
                }
                break;
                
            case 'output':
                if (message.data) {
                    appendOutput(message.data);
                }
                break;
                
            case 'error':
                if (message.message) {
                    appendOutput(`Error: ${message.message}`, 'error');
                }
                break;
                
            case 'completed':
                handleTestCompletion(message);
                break;
        }
    } catch (error) {
        console.error('Error processing message:', error);
        appendOutput(`Error processing message: ${error.message}`, 'error');
    }
};

function updateMetrics(metrics) {
    if (!metrics) return;
    
    // Update current metrics display
    document.getElementById('current-vus').textContent = metrics.vus || '0';
    document.getElementById('current-rps').textContent = (metrics.rps || '0').toFixed(2);
    document.getElementById('current-response-time').textContent = (metrics.responseTime || '0').toFixed(2);
    document.getElementById('current-errors').textContent = metrics.errors || '0';
}

function updateCharts(history) {
    if (!history || !history.timestamps || !history.timestamps.length) return;
    
    // Update charts with historical data
    const chartData = {
        labels: history.timestamps,
        datasets: [
            {
                label: 'VUs',
                data: history.vus,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            },
            {
                label: 'RPS',
                data: history.rps,
                borderColor: 'rgb(255, 99, 132)',
                tension: 0.1
            },
            {
                label: 'Response Time (ms)',
                data: history.responseTime,
                borderColor: 'rgb(54, 162, 235)',
                tension: 0.1
            },
            {
                label: 'Errors',
                data: history.errors,
                borderColor: 'rgb(255, 159, 64)',
                tension: 0.1
            }
        ]
    };
    
    if (window.metricsChart) {
        window.metricsChart.data = chartData;
        window.metricsChart.update();
    }
}

function appendOutput(text, type = 'info') {
    const output = document.getElementById('output');
    const line = document.createElement('div');
    line.className = `output-line ${type}`;
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
}

function handleTestCompletion(message) {
    appendOutput('Test completed!');
    if (message.code !== 0) {
        appendOutput(`Exit code: ${message.code}`, 'error');
    }
    if (message.resultsFile) {
        appendOutput(`Results saved to: ${message.resultsFile.csv}`);
        appendOutput(`Summary saved to: ${message.resultsFile.summary}`);
        
        // Display summary data if available
        if (message.resultsFile.summaryData) {
            const summary = message.resultsFile.summaryData;
            appendOutput('\nTest Summary:');
            appendOutput(`Duration: ${summary.duration} seconds`);
            appendOutput(`Total Requests: ${summary.totalRequests}`);
            appendOutput(`Average RPS: ${summary.averageRPS.toFixed(2)}`);
            appendOutput(`Max VUs: ${summary.maxVUs}`);
            appendOutput(`Average Response Time: ${summary.averageResponseTime.toFixed(2)}ms`);
            appendOutput(`95th Percentile Response Time: ${summary.p95ResponseTime.toFixed(2)}ms`);
            appendOutput(`Total Errors: ${summary.totalErrors}`);
            appendOutput(`Error Rate: ${(summary.errorRate * 100).toFixed(2)}%`);
        }
    }
    
    // Re-enable the start button and disable the stop button
    document.getElementById('start-test').disabled = false;
    document.getElementById('stop-test').disabled = true;
} 