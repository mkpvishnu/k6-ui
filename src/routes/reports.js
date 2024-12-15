// ... previous code ...

function generateCsvFromReport(report) {
    const csvLines = [];

    // Add test summary
    csvLines.push('Test Summary');
    csvLines.push(`Start Time,${report.startTime}`);
    csvLines.push(`Duration,${report.duration}ms`);
    csvLines.push(`Total Requests,${report.requests.length}`);
    csvLines.push(`Total Errors,${report.errors.length}`);
    csvLines.push('');

    // Add metrics section
    csvLines.push('Time Series Metrics');
    csvLines.push('Timestamp,VUs,Requests/sec,Response Time (ms),Error Rate (%)');

    // Get all unique timestamps
    const timestamps = new Set();
    Object.values(report.metrics).forEach(metric => {
        if (Array.isArray(metric)) {
            metric.forEach(point => timestamps.add(point.timestamp));
        }
    });

    // Sort timestamps and create rows
    Array.from(timestamps).sort().forEach(timestamp => {
        const row = [timestamp];
        const metrics = ['vus', 'rps', 'responseTime', 'errorRate'];
        
        metrics.forEach(metricName => {
            const point = report.metrics[metricName]?.find(p => p.timestamp === timestamp);
            row.push(point ? point.value : '');
        });

        csvLines.push(row.join(','));
    });
    csvLines.push('');

    // Add requests section
    csvLines.push('HTTP Requests');
    csvLines.push('Timestamp,Method,URL,Status,Duration (ms)');
    report.requests.forEach(req => {
        csvLines.push([
            req.timestamp,
            req.method,
            `"${req.url}"`,
            req.status,
            req.duration
        ].join(','));
    });
    csvLines.push('');

    // Add thresholds section
    csvLines.push('Thresholds');
    csvLines.push('Name,Value,Threshold,Status');
    
    // Add passed thresholds
    report.thresholds.passed.forEach(threshold => {
        csvLines.push([
            `"${threshold.name}"`,
            threshold.value,
            `"${threshold.threshold}"`,
            'PASSED'
        ].join(','));
    });
    
    // Add failed thresholds
    report.thresholds.failed.forEach(threshold => {
        csvLines.push([
            `"${threshold.name}"`,
            threshold.value,
            `"${threshold.threshold}"`,
            'FAILED'
        ].join(','));
    });

    return csvLines.join('\n');
}

module.exports = router;