// S.I.L.T. System - Charts Configuration
// Chart.js setup and chart creation functions

// Default chart colors
const CHART_COLORS = {
    purple: '#a855f7',
    purpleDark: '#9333ea',
    purpleLight: '#c084fc',
    green: '#22c55e',
    blue: '#3b82f6',
    orange: '#f59e0b',
    red: '#ef4444',
    text: '#ffffff',
    textSecondary: '#a1a1aa',
    grid: 'rgba(168, 85, 247, 0.1)'
};

// Chart.js defaults for dark theme
Chart.defaults.color = CHART_COLORS.textSecondary;
Chart.defaults.borderColor = CHART_COLORS.grid;
Chart.defaults.font.family = "'Segoe UI', system-ui, sans-serif";

// Store chart instances for updates
const chartInstances = {};

// Create Portfolio Distribution Pie Chart
function createPortfolioChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    // Destroy existing chart if any
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Pools', 'AAVE'],
            datasets: [{
                data: [data.pools || 0, data.aave || 0],
                backgroundColor: [
                    CHART_COLORS.purple,
                    CHART_COLORS.blue
                ],
                borderColor: 'transparent',
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(11, 11, 15, 0.9)',
                    titleColor: CHART_COLORS.text,
                    bodyColor: CHART_COLORS.text,
                    borderColor: CHART_COLORS.purple,
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${label}: ${formatCurrency(value)} (${percentage}%)`;
                        }
                    }
                }
            },
            animation: {
                animateRotate: true,
                duration: 1000
            }
        }
    });

    chartInstances[canvasId] = chart;
    return chart;
}

// Create Weekly Performance Bar Chart
function createWeeklyChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels || ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{
                label: 'Invested',
                data: data.invested || [],
                backgroundColor: CHART_COLORS.purple,
                borderRadius: 6,
                borderSkipped: false
            }, {
                label: 'Profit',
                data: data.profit || [],
                backgroundColor: CHART_COLORS.green,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(11, 11, 15, 0.9)',
                    titleColor: CHART_COLORS.text,
                    bodyColor: CHART_COLORS.text,
                    borderColor: CHART_COLORS.purple,
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 12
                        }
                    }
                },
                y: {
                    grid: {
                        color: CHART_COLORS.grid
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value, true);
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });

    chartInstances[canvasId] = chart;
    return chart;
}

// Create Monthly Trend Line Chart
function createTrendChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels || [],
            datasets: [{
                label: 'Total Balance',
                data: data.values || [],
                borderColor: CHART_COLORS.purple,
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                    gradient.addColorStop(0, 'rgba(168, 85, 247, 0.3)');
                    gradient.addColorStop(1, 'rgba(168, 85, 247, 0)');
                    return gradient;
                },
                fill: true,
                tension: 0.4,
                pointBackgroundColor: CHART_COLORS.purple,
                pointBorderColor: CHART_COLORS.text,
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(11, 11, 15, 0.9)',
                    titleColor: CHART_COLORS.text,
                    bodyColor: CHART_COLORS.text,
                    borderColor: CHART_COLORS.purple,
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            return `Balance: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    grid: {
                        color: CHART_COLORS.grid
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value, true);
                        }
                    }
                }
            },
            animation: {
                duration: 1500,
                easing: 'easeOutQuart'
            }
        }
    });

    chartInstances[canvasId] = chart;
    return chart;
}

// Create Pool Performance Chart
function createPoolPerformanceChart(canvasId, poolData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    // Group by pool name
    const pools = {};
    poolData.forEach(record => {
        if (!pools[record.pool_name]) {
            pools[record.pool_name] = { invested: 0, profit: 0 };
        }
        pools[record.pool_name].invested += parseFloat(record.invested_value) || 0;
        pools[record.pool_name].profit += parseFloat(record.profit_value) || 0;
    });

    const labels = Object.keys(pools);
    const investedData = labels.map(p => pools[p].invested);
    const profitData = labels.map(p => pools[p].profit);

    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Invested',
                data: investedData,
                backgroundColor: CHART_COLORS.purple,
                borderRadius: 6
            }, {
                label: 'Profit',
                data: profitData,
                backgroundColor: CHART_COLORS.green,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    backgroundColor: 'rgba(11, 11, 15, 0.9)',
                    titleColor: CHART_COLORS.text,
                    bodyColor: CHART_COLORS.text,
                    borderColor: CHART_COLORS.purple,
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    grid: { color: CHART_COLORS.grid },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value, true);
                        }
                    }
                }
            }
        }
    });

    chartInstances[canvasId] = chart;
    return chart;
}

// Update all charts with new currency
function updateChartsCurrency(exchangeRate) {
    Object.values(chartInstances).forEach(chart => {
        if (chart) {
            chart.update('none'); // Update without animation
        }
    });
}

// Format currency helper
function formatCurrency(value, compact = false) {
    const currency = window.CURRENCY || 'USD';
    const symbol = currency === 'BRL' ? 'R$' : '$';

    if (compact && Math.abs(value) >= 1000000) {
        return symbol + (value / 1000000).toFixed(1) + 'M';
    } else if (compact && Math.abs(value) >= 1000) {
        return symbol + (value / 1000).toFixed(1) + 'K';
    }

    return symbol + parseFloat(value).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Export chart functions
window.SILTCharts = {
    createPortfolioChart,
    createWeeklyChart,
    createTrendChart,
    createPoolPerformanceChart,
    updateChartsCurrency,
    formatCurrency,
    CHART_COLORS
};
