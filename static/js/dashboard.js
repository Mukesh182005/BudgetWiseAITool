// ===== BudgetWise Dashboard JS =====
let userCurrency = '₹';
const currencyMap = { 'INR': '₹', 'USD': '$', 'EUR': '€', 'GBP': '£' };

function formatMoney(amount) {
    return userCurrency + parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    initNavigation();
    initModals();
    initForms();
    initDashboardChat();
    loadDashboardData();
    checkCookieConsent();
});

// ===== Sidebar Toggle =====
function initSidebar() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    if (toggle) {
        toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    }
}

// ===== Section Navigation =====
function initNavigation() {
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
            const target = document.getElementById('section-' + section);
            if (target) target.classList.add('active');

            // Load section data
            if (section === 'transactions') loadTransactions();
            if (section === 'budgets') loadBudgets();
            if (section === 'goals') loadGoals();
            if (section === 'forecast') loadForecast();
            if (section === 'health') loadHealthScore();

            // Close mobile sidebar
            document.getElementById('sidebar').classList.remove('open');
        });
    });
}

// ===== API Helper =====
async function api(url, options = {}) {
    const defaults = { headers: { 'Content-Type': 'application/json' } };
    try {
        const response = await fetch(url, { ...defaults, ...options });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Request failed');
        }
        return await response.json();
    } catch (e) {
        console.error(`API Error (${url}):`, e);
        throw e;
    }
}

// ===== Load Dashboard Data =====
async function loadDashboardData() {
    try {
        const summary = await api('/api/analytics/summary');
        userCurrency = currencyMap[summary.currency] || summary.currency || '₹';

        document.getElementById('totalIncome').textContent = formatMoney(summary.total_income);
        document.getElementById('totalExpense').textContent = formatMoney(summary.total_expense);
        document.getElementById('totalSavings').textContent = formatMoney(summary.savings);

        // Category breakdown List
        const catDiv = document.getElementById('categoryBreakdown');
        if (summary.category_breakdown && summary.category_breakdown.length > 0) {
            const maxCat = Math.max(...summary.category_breakdown.map(c => c.total));
            catDiv.innerHTML = summary.category_breakdown.map(c => `
                <div class="cat-item">
                    <span class="cat-dot" style="background:${c.color}"></span>
                    <span class="cat-name">${c.icon} ${c.name}</span>
                    <span class="cat-amount">${formatMoney(c.total)}</span>
                    <div class="cat-bar-mini"><div class="cat-bar-fill" style="width:${(c.total / maxCat * 100)}%;background:${c.color}"></div></div>
                </div>
            `).join('');
        } else {
            catDiv.innerHTML = '<p class="empty-state">No expense data yet</p>';
        }

        // Recent transactions
        const txData = await api('/api/transactions?per_page=5');
        const recentDiv = document.getElementById('recentTransactions');
        if (txData.transactions && txData.transactions.length > 0) {
            recentDiv.innerHTML = txData.transactions.map(tx => `
                <div class="tx-item">
                    <div class="tx-icon">${tx.category ? tx.category.icon : '📦'}</div>
                    <div class="tx-info"><div class="tx-desc">${tx.description || 'Transaction'}</div><div class="tx-date">${new Date(tx.date).toLocaleDateString()}</div></div>
                    <div class="tx-amount ${tx.transaction_type}">${tx.transaction_type === 'income' ? '+' : '-'}${formatMoney(tx.amount)}</div>
                </div>
            `).join('');
        }

        // Trends & Charts
        const trends = await api('/api/analytics/trends');
        const heatmap = await api('/api/analytics/heatmap');
        const forecast = await api('/api/analytics/forecast');
        renderPlotlyCharts(summary, trends, heatmap, forecast);

        // Health score
        try {
            const health = await api('/api/health-score');
            document.getElementById('healthScore').textContent = health.score + '/100';
            document.getElementById('healthBadge').textContent = health.status;
            document.getElementById('healthBadge').className = 'sc-badge ' + (health.score >= 60 ? 'up' : 'down');
        } catch (e) { }

        // Load categories for forms
        loadCategoriesForForms();

    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function renderPlotlyCharts(summary, trends, heatmapData, forecastData) {
    // Hide all loading placeholders
    document.querySelectorAll('.dc-body .empty-state').forEach(el => el.style.display = 'none');

    const textColor = '#0F172A';
    const gridColor = '#F1F5F9';
    const brandColor = '#FF3459';

    // 1. Category Distribution (Pie with Expense/Income Toggle)
    window._pieExpenseData = summary.category_breakdown || [];
    window._pieIncomeData = summary.income_breakdown || [];
    renderPieChart('expense');

    // 2. Spending Trends — store data globally for toggle
    window._trendsData = trends;
    window._forecastData = forecastData;
    renderTrendsChart('both');

    // 3. Spending Heatmap (GitHub-style grid)
    renderHeatmapGrid(heatmapData);

    // 4. Budget vs Actual (Grouped Bar)
    if (summary.category_breakdown && summary.category_breakdown.length > 0) {
        const catData = summary.category_breakdown;
        const traces = [
            {
                x: catData.map(c => c.name),
                y: catData.map(c => c.total),
                name: 'Actual',
                type: 'bar',
                marker: { color: brandColor }
            },
            {
                x: catData.map(c => c.name),
                y: catData.map(c => c.budget),
                name: 'Budget',
                type: 'bar',
                marker: { color: 'rgba(15, 23, 42, 0.05)' }
            }
        ];
        const layout = {
            height: 300,
            margin: { t: 30, b: 40, l: 60, r: 20 },
            barmode: 'group',
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { color: textColor, family: 'Inter' },
            showlegend: true,
            legend: { orientation: 'h', y: 1.1, x: 0.5, xanchor: 'center' },
            xaxis: { showgrid: false, zeroline: false },
            yaxis: { gridcolor: gridColor, zeroline: false, tickprefix: userCurrency }
        };
        Plotly.newPlot('budgetVsActualChart', traces, layout, { displayModeBar: false });
    }
}

// ===== Enhanced Trends Chart with Toggle =====
function renderTrendsChart(mode) {
    const trends = window._trendsData;
    const forecastData = window._forecastData;
    if (!trends || trends.length === 0) return;

    const textColor = '#0F172A';
    const gridColor = '#F1F5F9';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const labels = trends.map(t => months[t.month - 1] + ' ' + (t.year % 100));

    const dataPlot = [];

    if (mode === 'expense' || mode === 'both') {
        dataPlot.push({
            x: labels,
            y: trends.map(t => t.total),
            name: 'Expenses',
            type: 'scatter',
            mode: 'lines+markers',
            fill: 'tozeroy',
            fillcolor: 'rgba(255, 52, 89, 0.08)',
            line: { color: '#FF3459', width: 3, shape: 'spline' },
            marker: { color: '#FF3459', size: 8, line: { color: '#fff', width: 2 } },
            hovertemplate: '<b>%{x}</b><br>Expense: ' + userCurrency + '%{y:,.0f}<extra></extra>'
        });
    }

    if (mode === 'income' || mode === 'both') {
        dataPlot.push({
            x: labels,
            y: trends.map(t => t.income || 0),
            name: 'Income',
            type: 'scatter',
            mode: 'lines+markers',
            fill: 'tozeroy',
            fillcolor: 'rgba(22, 163, 74, 0.08)',
            line: { color: '#16a34a', width: 3, shape: 'spline' },
            marker: { color: '#16a34a', size: 8, line: { color: '#fff', width: 2 } },
            hovertemplate: '<b>%{x}</b><br>Income: ' + userCurrency + '%{y:,.0f}<extra></extra>'
        });
    }

    if (mode === 'savings') {
        const savingsValues = trends.map(t => (t.income || 0) - t.total);
        const savingsColors = savingsValues.map(v => v >= 0 ? '#16a34a' : '#dc2626');
        dataPlot.push({
            x: labels,
            y: savingsValues,
            name: 'Savings',
            type: 'bar',
            marker: { color: savingsColors, line: { color: savingsColors.map(c => c === '#16a34a' ? '#15803d' : '#b91c1c'), width: 1 } },
            hovertemplate: '<b>%{x}</b><br>Savings: ' + userCurrency + '%{y:,.0f}<extra></extra>'
        });
    }

    // Add forecast line
    if (forecastData && forecastData.forecast && mode !== 'savings') {
        const f = forecastData.forecast;
        dataPlot.push({
            x: f.map(t => months[t.month - 1] + ' ' + (t.year % 100)),
            y: f.map(t => t.predicted),
            name: 'AI Forecast',
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: '#7C3AED', width: 3, dash: 'dot', shape: 'spline' },
            marker: { color: '#7C3AED', size: 8, symbol: 'diamond', line: { color: '#fff', width: 2 } },
            hovertemplate: '<b>%{x}</b><br>Forecast: ' + userCurrency + '%{y:,.0f}<extra></extra>'
        });
    }

    const layout = {
        height: 340,
        margin: { t: 20, b: 40, l: 60, r: 20 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: textColor, family: 'Inter', size: 12 },
        showlegend: true,
        legend: { orientation: 'h', y: 1.12, x: 0.5, xanchor: 'center', font: { size: 12 } },
        xaxis: { showgrid: false, zeroline: false, tickfont: { size: 11 } },
        yaxis: { gridcolor: gridColor, zeroline: true, zerolinecolor: '#E2E8F0', tickprefix: userCurrency, tickfont: { size: 11 } },
        hovermode: 'x unified',
        hoverlabel: { bgcolor: '#1E293B', font: { color: '#fff', size: 13, family: 'Inter' }, bordercolor: 'transparent' }
    };

    Plotly.newPlot('spendingTrendsChart', dataPlot, layout, {
        displayModeBar: false,
        responsive: true
    });

    // Animate on render
    Plotly.animate('spendingTrendsChart', { data: dataPlot }, {
        transition: { duration: 600, easing: 'cubic-in-out' },
        frame: { duration: 600 }
    });
}

function switchTrendsMode(mode) {
    document.querySelectorAll('#trendsToggle .pt-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    renderTrendsChart(mode);
}

// ===== Enhanced Heatmap — GitHub-style Grid =====
function renderHeatmapGrid(heatmapData) {
    const container = document.getElementById('spendingHeatmapChart');
    if (!heatmapData || !heatmapData.grid) {
        container.innerHTML = '<p class="empty-state">No spending data for heatmap</p>';
        return;
    }

    const { grid, week_labels, days } = heatmapData;
    // Find max value for color scaling
    let maxVal = 0;
    grid.forEach(week => week.forEach(val => { if (val > maxVal) maxVal = val; }));
    if (maxVal === 0) maxVal = 1;

    // Color function: 0 = #F1F5F9, max = #FF3459, mid intensity colors
    function getColor(val) {
        if (val === 0) return '#F1F5F9';
        const ratio = Math.min(val / maxVal, 1);
        if (ratio < 0.25) return '#FFE0E6';
        if (ratio < 0.5) return '#FFB1C1';
        if (ratio < 0.75) return '#FF6B8A';
        return '#FF3459';
    }

    function getLevel(val) {
        if (val === 0) return 'No spending';
        const ratio = Math.min(val / maxVal, 1);
        if (ratio < 0.25) return 'Low';
        if (ratio < 0.5) return 'Moderate';
        if (ratio < 0.75) return 'High';
        return 'Very High';
    }

    let html = '<div class="heatmap-grid-container">';

    // Day labels column
    html += '<div class="heatmap-day-labels">';
    html += '<div class="heatmap-day-label" style="height:16px;"></div>'; // spacer for week labels row
    days.forEach(d => {
        html += `<div class="heatmap-day-label">${d}</div>`;
    });
    html += '</div>';

    // Weeks columns
    html += '<div class="heatmap-weeks">';
    // Week labels row
    html += '<div class="heatmap-week-labels">';
    grid.forEach((_, wi) => {
        const label = wi % 2 === 0 ? week_labels[wi] : '';
        html += `<div class="heatmap-week-label">${label}</div>`;
    });
    html += '</div>';

    // Grid cells (7 rows x 12 cols)
    for (let d = 0; d < 7; d++) {
        html += '<div class="heatmap-row">';
        for (let w = 0; w < grid.length; w++) {
            const val = grid[w][d];
            const color = getColor(val);
            const level = getLevel(val);
            const tooltip = val > 0 ? `${days[d]}, ${week_labels[w]}: ${userCurrency}${val.toLocaleString()} (${level})` : `${days[d]}, ${week_labels[w]}: No spending`;
            html += `<div class="heatmap-cell" style="background:${color};" title="${tooltip}" data-val="${val}"></div>`;
        }
        html += '</div>';
    }
    html += '</div>'; // .heatmap-weeks

    // Legend
    html += '<div class="heatmap-legend">';
    html += '<span class="heatmap-legend-label">Less</span>';
    ['#F1F5F9', '#FFE0E6', '#FFB1C1', '#FF6B8A', '#FF3459'].forEach(c => {
        html += `<div class="heatmap-legend-cell" style="background:${c};"></div>`;
    });
    html += '<span class="heatmap-legend-label">More</span>';
    html += '</div>';

    html += '</div>'; // .heatmap-grid-container
    container.innerHTML = html;

    // Add hover animation
    container.querySelectorAll('.heatmap-cell').forEach(cell => {
        cell.addEventListener('mouseenter', () => {
            cell.style.transform = 'scale(1.3)';
            cell.style.zIndex = '10';
            cell.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        });
        cell.addEventListener('mouseleave', () => {
            cell.style.transform = 'scale(1)';
            cell.style.zIndex = '';
            cell.style.boxShadow = '';
        });
    });
}

// ===== Pie Chart Rendering & Toggle =====
const PIE_COLORS_EXPENSE = [
    '#FF3459', '#7C3AED', '#F59E0B', '#3B82F6', '#EC4899',
    '#06B6D4', '#F97316', '#8B5CF6', '#EF4444', '#14B8A6',
    '#D946EF', '#0EA5E9', '#E11D48', '#A855F7', '#FB923C'
];
const PIE_COLORS_INCOME = [
    '#16A34A', '#10B981', '#059669', '#34D399', '#2DD4BF',
    '#0D9488', '#22C55E', '#4ADE80', '#6EE7B7', '#A7F3D0',
    '#047857', '#065F46', '#15803D', '#86EFAC', '#BBF7D0'
];

function renderPieChart(type) {
    const catData = type === 'income' ? window._pieIncomeData : window._pieExpenseData;
    const colors = type === 'income' ? PIE_COLORS_INCOME : PIE_COLORS_EXPENSE;
    const chartDiv = document.getElementById('categoryDistributionChart');

    if (!catData || catData.length === 0) {
        chartDiv.innerHTML = `<p class="empty-state">No ${type} data to display yet.</p>`;
        return;
    }

    try {
        // Assign vibrant colors
        const sliceColors = catData.map((_, i) => colors[i % colors.length]);

        // Pull out largest slice for emphasis
        const maxVal = Math.max(...catData.map(c => c.total));
        const pull = catData.map(c => c.total === maxVal ? 0.05 : 0);

        // Calculate total for center annotation
        const total = catData.reduce((sum, c) => sum + c.total, 0);

        const data = [{
            values: catData.map(c => c.total),
            labels: catData.map(c => c.name),
            type: 'pie',
            hole: 0.45,
            marker: {
                colors: sliceColors,
                line: { color: '#ffffff', width: 2 }
            },
            textinfo: 'percent+label',
            textposition: 'auto',
            hoverinfo: 'label+value+percent',
            hoverlabel: {
                bgcolor: '#1E293B',
                font: { color: '#fff', size: 13, family: 'Inter' },
                bordercolor: 'transparent'
            },
            pull: pull,
            textfont: { size: 11, family: 'Inter', color: '#fff' },
            sort: true,
            direction: 'clockwise',
            rotation: -40
        }];

        const layout = {
            height: 380,
            margin: { t: 10, b: 60, l: 10, r: 10 },
            showlegend: true,
            legend: {
                orientation: 'h',
                y: -0.15,
                x: 0.5,
                xanchor: 'center',
                font: { size: 11, family: 'Inter', color: '#475569' },
                itemsizing: 'constant'
            },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { color: '#0F172A', family: 'Inter' },
            annotations: [{
                text: `<b>${userCurrency}${total.toLocaleString('en-IN')}</b><br><span style="font-size:11px;color:#94a3b8;">Total ${type === 'income' ? 'Income' : 'Expenses'}</span>`,
                showarrow: false,
                font: { size: 15, family: 'Inter', color: '#0F172A' },
                x: 0.5,
                y: 0.5
            }]
        };

        Plotly.newPlot('categoryDistributionChart', data, layout, {
            displayModeBar: false,
            responsive: true
        });
    } catch (err) {
        console.error('Pie chart error:', err);
        chartDiv.innerHTML = `<p class="empty-state">Could not render chart.</p>`;
    }
}

function switchPieChart(type) {
    // Update toggle buttons
    document.getElementById('ptExpense').classList.toggle('active', type === 'expense');
    document.getElementById('ptIncome').classList.toggle('active', type === 'income');
    // Update title
    document.getElementById('pieChartTitle').textContent =
        type === 'income' ? 'Income Distribution' : 'Expense Distribution';
    // Re-render
    renderPieChart(type);
}

// ===== Load Categories for Form Selects =====
async function loadCategoriesForForms() {
    try {
        const cats = await api('/api/categories');
        const options = cats.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
        const txCat = document.getElementById('txCategory');
        if (txCat) txCat.innerHTML = '<option value="">Auto-detect (AI)</option>' + options;
        const budgetCat = document.getElementById('budgetCategory');
        if (budgetCat) budgetCat.innerHTML = options;
    } catch (e) { }
}

// ===== Transactions =====
async function loadTransactions() {
    const data = await api('/api/transactions');
    const list = document.getElementById('transactionsList');
    if (data.transactions && data.transactions.length > 0) {
        list.innerHTML = data.transactions.map(tx => `
            <div class="tx-item">
                <div class="tx-icon">${tx.category ? tx.category.icon : '📦'}</div>
                <div class="tx-info"><div class="tx-desc">${tx.description || 'Transaction'}</div><div class="tx-date">${new Date(tx.date).toLocaleDateString()}</div></div>
                <div class="tx-amount ${tx.transaction_type}">${tx.transaction_type === 'income' ? '+' : '-'}${formatMoney(tx.amount)}</div>
                <button class="tx-delete" onclick="deleteTransaction(${tx.id})">🗑️</button>
            </div>
        `).join('');
    } else {
        list.innerHTML = '<p class="empty-state">No transactions yet. Start tracking your expenses!</p>';
    }
}

async function deleteTransaction(id) {
    if (!confirm('Delete this transaction?')) return;
    await api('/api/transactions/' + id, { method: 'DELETE' });
    loadTransactions();
    loadDashboardData();
}

// ===== Budgets =====
async function loadBudgets() {
    const data = await api('/api/budgets');
    const list = document.getElementById('budgetsList');
    if (data && data.length > 0) {
        list.innerHTML = data.map(b => {
            const pctClass = b.percentage > 90 ? 'danger' : b.percentage > 75 ? 'warn' : '';
            const barColor = b.percentage > 90 ? '#dc2626' : b.percentage > 75 ? '#f59e0b' : '#FF3459';
            return `
            <div class="budget-item">
                <div class="bi-header"><span class="bi-name">${b.category ? b.category.icon + ' ' + b.category.name : 'Total'}</span><span class="bi-amounts">${formatMoney(b.spent)} / ${formatMoney(b.amount)}</span></div>
                <div class="bi-bar"><div class="bi-fill" style="width:${Math.min(b.percentage, 100)}%;background:${barColor}"></div></div>
                <div class="bi-pct ${pctClass}">${b.percentage}% used</div>
            </div>`;
        }).join('');
    } else {
        list.innerHTML = '<p class="empty-state">No budgets set for this month.</p>';
    }
}

// ===== Goals =====
async function loadGoals() {
    const data = await api('/api/goals');
    const list = document.getElementById('goalsList');

    if (data && data.length > 0) {
        // Update summary stats
        const totalSaved = data.reduce((s, g) => s + g.current_amount, 0);
        const completed = data.filter(g => g.progress >= 100).length;
        const active = data.length - completed;

        document.getElementById('gsTotalSaved').textContent = formatMoney(totalSaved);
        document.getElementById('gsActiveGoals').textContent = active;
        document.getElementById('gsCompleted').textContent = completed;

        // Nearest deadline
        const upcoming = data
            .filter(g => g.deadline && g.progress < 100)
            .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
        document.getElementById('gsNearest').textContent = upcoming.length > 0
            ? new Date(upcoming[0].deadline).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
            : '—';

        document.getElementById('goalsSummary').style.display = '';

        // SVG gradient definition (shared)
        const svgDefs = `<svg width="0" height="0"><defs><linearGradient id="goalGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FF3459"/><stop offset="100%" stop-color="#57F2D1"/></linearGradient></defs></svg>`;

        list.innerHTML = svgDefs + data.map(g => {
            const pct = Math.min(g.progress, 100);
            const r = 30; // radius
            const c = 2 * Math.PI * r; // circumference
            const offset = c - (pct / 100) * c;
            const isCompleted = pct >= 100;
            const remaining = Math.max(0, g.target_amount - g.current_amount);

            // Deadline logic
            let deadlineHtml = '';
            let deadlineClass = '';
            if (g.deadline) {
                const dl = new Date(g.deadline);
                const now = new Date();
                const daysLeft = Math.ceil((dl - now) / (1000 * 60 * 60 * 24));
                if (daysLeft < 0) {
                    deadlineHtml = `⏰ Overdue by ${Math.abs(daysLeft)} days`;
                    deadlineClass = 'urgent';
                } else if (daysLeft <= 30) {
                    deadlineHtml = `⏰ ${daysLeft} days left`;
                    deadlineClass = 'soon';
                } else if (daysLeft <= 90) {
                    deadlineHtml = `📅 ${daysLeft} days left`;
                    deadlineClass = '';
                } else {
                    deadlineHtml = `📅 Due ${dl.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;
                }
            }

            return `
            <div class="goal-card ${isCompleted ? 'completed' : ''}" data-id="${g.id}">
                <div class="gc-top">
                    <div class="gc-icon">${g.icon}</div>
                    <div class="gc-title-area">
                        <div class="gc-name">${g.name}</div>
                        ${deadlineHtml ? `<div class="gc-deadline ${deadlineClass}">${deadlineHtml}</div>` : ''}
                    </div>
                    <div class="gc-actions">
                        <button class="gc-action-btn" onclick="editGoal(${g.id})" title="Edit">✏️</button>
                        <button class="gc-action-btn delete" onclick="deleteGoal(${g.id})" title="Delete">🗑️</button>
                    </div>
                </div>
                <div class="gc-progress-area">
                    <div class="gc-ring">
                        <svg viewBox="0 0 72 72">
                            <circle class="gc-ring-bg" cx="36" cy="36" r="${r}"/>
                            <circle class="gc-ring-fill" cx="36" cy="36" r="${r}"
                                stroke-dasharray="${c}" stroke-dashoffset="${offset}"
                                ${isCompleted ? 'style="stroke: #16a34a;"' : ''}/>
                        </svg>
                        <div class="gc-ring-pct">${pct.toFixed(0)}%</div>
                    </div>
                    <div class="gc-amounts">
                        <div class="gc-saved">${formatMoney(g.current_amount)}</div>
                        <div class="gc-target">of ${formatMoney(g.target_amount)}</div>
                        ${!isCompleted ? `<div class="gc-remaining">${formatMoney(remaining)} remaining</div>` : ''}
                    </div>
                </div>
                <div class="gc-bar"><div class="gc-bar-fill" style="width:${pct}%"></div></div>
                ${isCompleted
                    ? '<div class="gc-completed-badge">🏆 Goal Achieved!</div>'
                    : `<button class="gc-deposit-btn" onclick="showDeposit(${g.id}, decodeURIComponent('${encodeURIComponent(g.name)}'), ${g.current_amount})">💰 Add Savings</button>`
                }
            </div>`;
        }).join('');
    } else {
        document.getElementById('goalsSummary').style.display = 'none';
        list.innerHTML = '<p class="empty-state">No goals yet. Create your first savings goal!</p>';
    }
}

// ===== Goal Actions =====
function showDeposit(goalId, goalName, currentAmount) {
    document.getElementById('depositGoalId').value = goalId;
    document.getElementById('depositGoalName').textContent = goalName;
    document.getElementById('depositAmount').value = '';
    window._depositCurrentAmount = currentAmount;
    document.getElementById('depositModal').classList.add('active');
}

function setDeposit(amount) {
    document.getElementById('depositAmount').value = amount;
}

async function editGoal(goalId) {
    const data = await api('/api/goals');
    const goal = data.find(g => g.id === goalId);
    if (!goal) return;

    document.getElementById('goalModalTitle').textContent = 'Edit Goal';
    document.getElementById('goalSubmitBtn').textContent = 'Update Goal';
    document.getElementById('goalEditId').value = goalId;
    document.getElementById('goalName').value = goal.name;
    document.getElementById('goalTarget').value = goal.target_amount;
    document.getElementById('goalCurrent').value = goal.current_amount;
    document.getElementById('goalDeadline').value = goal.deadline ? goal.deadline.split('T')[0] : '';

    // Select icon
    document.querySelectorAll('#goalIconPicker .ip-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.icon === goal.icon);
    });

    document.getElementById('goalModal').classList.add('active');
}

async function deleteGoal(goalId) {
    if (!confirm('Are you sure you want to delete this goal?')) return;
    await api(`/api/goals/${goalId}`, { method: 'DELETE' });
    loadGoals();
}

function celebrateGoal(name) {
    const overlay = document.createElement('div');
    overlay.className = 'goal-celebrate';
    overlay.innerHTML = `<div class="celebrate-text">🎉 "${name}" Achieved! 🏆</div>`;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 3500);
}

// ===== Forecast =====
async function loadForecast() {
    const data = await api('/api/forecast');
    const div = document.getElementById('forecastContent');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const analysis = data.analysis || {};
    const insights = data.insights || [];
    const recommendations = data.recommendations || [];

    let html = '';

    // === Analysis Summary ===
    if (analysis.trend) {
        html += `
        <div class="fc-analysis">
            <div class="fc-analysis-header">
                <span class="fc-analysis-icon">${analysis.trend_icon}</span>
                <span class="fc-analysis-title">Spending Analysis</span>
                <span class="fc-confidence-badge fc-conf-${data.confidence}">${data.confidence} confidence</span>
            </div>
            <div class="fc-stats-grid">
                <div class="fc-stat">
                    <div class="fc-stat-label">Trend</div>
                    <div class="fc-stat-value fc-trend-${analysis.trend}">${analysis.trend_icon} ${analysis.trend.charAt(0).toUpperCase() + analysis.trend.slice(1)}</div>
                </div>
                <div class="fc-stat">
                    <div class="fc-stat-label">MoM Change</div>
                    <div class="fc-stat-value ${analysis.change_pct >= 0 ? 'fc-neg' : 'fc-pos'}">${analysis.change_pct >= 0 ? '+' : ''}${analysis.change_pct}%</div>
                </div>
                <div class="fc-stat">
                    <div class="fc-stat-label">Avg Monthly</div>
                    <div class="fc-stat-value">${formatMoney(analysis.avg_monthly)}</div>
                </div>
                <div class="fc-stat">
                    <div class="fc-stat-label">Volatility</div>
                    <div class="fc-stat-value fc-vol-${analysis.volatility.toLowerCase()}">${analysis.volatility}</div>
                </div>
            </div>
        </div>`;
    }

    // === Monthly Forecasts ===
    html += `<div class="fc-card">
        <div class="fc-method">📊 ${data.method === 'prophet' ? 'Prophet AI' : 'Moving Average'} Forecast — Next ${data.forecast?.length || 3} Months</div>`;

    if (data.forecast && data.forecast.length > 0) {
        const maxUpper = Math.max(...data.forecast.map(f => f.upper));
        html += data.forecast.map(f => {
            const pctPred = (f.predicted / maxUpper * 100).toFixed(1);
            const pctLower = (f.lower / maxUpper * 100).toFixed(1);
            const pctUpper = (f.upper / maxUpper * 100).toFixed(1);
            return `
            <div class="fc-month-row">
                <div class="fc-month-info">
                    <span class="fc-month-name">${months[f.month - 1]} ${f.year}</span>
                    <span class="fc-predicted">${formatMoney(f.predicted)}</span>
                </div>
                <div class="fc-bar-container">
                    <div class="fc-bar-range" style="left:${pctLower}%;width:${pctUpper - pctLower}%"></div>
                    <div class="fc-bar-predicted" style="left:${pctPred}%"></div>
                </div>
                <div class="fc-range-label">${formatMoney(f.lower)} — ${formatMoney(f.upper)}</div>
            </div>`;
        }).join('');
    } else {
        html += '<p class="empty-state">Not enough data for forecasting yet.</p>';
    }
    html += '</div>';

    // === Insights ===
    if (insights.length > 0) {
        html += `<div class="fc-insights">
            <h4 class="fc-section-title">🔍 Key Insights</h4>
            <div class="fc-insight-grid">
                ${insights.map(i => `
                    <div class="fc-insight-card fc-insight-${i.type}">
                        <div class="fc-insight-icon">${i.icon}</div>
                        <div class="fc-insight-content">
                            <div class="fc-insight-title">${i.title}</div>
                            <div class="fc-insight-text">${i.text}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    // === Recommendations ===
    if (recommendations.length > 0) {
        html += `<div class="fc-recommendations">
            <h4 class="fc-section-title">💡 What You Should Do</h4>
            <div class="fc-rec-list">
                ${recommendations.map(r => `
                    <div class="fc-rec-item">
                        <span class="fc-rec-icon">${r.icon}</span>
                        <div class="fc-rec-body">
                            <div class="fc-rec-title">${r.title}</div>
                            <div class="fc-rec-text">${r.text}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    div.innerHTML = html;
}

// ===== Health Score =====
async function loadHealthScore() {
    const data = await api('/api/health-score');
    const div = document.getElementById('healthDashboard');
    const statusClass = data.score >= 80 ? 'excellent' : data.score >= 60 ? 'good' : data.score >= 40 ? 'fair' : 'poor';

    // Dynamic gradient: green for high, red for low
    const gradStart = data.score >= 70 ? '#16a34a' : data.score >= 50 ? '#f59e0b' : '#FF3459';
    const gradEnd = data.score >= 70 ? '#22d3ee' : data.score >= 50 ? '#FF8A00' : '#FF5A78';

    // Component data
    const comps = data.components || {};
    const recs = data.recommendations || [];
    const fin = data.financials || {};

    div.innerHTML = `
        <div class="hd-score-container">
            <div class="hd-score-card">
                <div class="hd-ring-container">
                    <svg viewBox="0 0 200 200" class="hd-svg">
                        <circle cx="100" cy="100" r="85" fill="none" stroke="#F1F5F9" stroke-width="12" />
                        <circle cx="100" cy="100" r="85" fill="none" stroke="url(#hdGrad)" stroke-width="12"
                            stroke-linecap="round" stroke-dasharray="534" stroke-dashoffset="534"
                            id="hdCircle" style="transition: stroke-dashoffset 2s ease-out;" />
                        <defs>
                            <linearGradient id="hdGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="${gradStart}" />
                                <stop offset="100%" stop-color="${gradEnd}" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div class="hd-score-value">
                        <span id="hdScoreNum">0</span><span class="hd-max-small">/100</span>
                    </div>
                </div>
                <div class="hd-status ${statusClass}">${data.status}</div>
                <div class="hd-tip">💡 ${data.tip}</div>

                <!-- Financial Summary -->
                <div class="hd-fin-summary">
                    <div class="hd-fin-item income">
                        <span class="hd-fin-label">Income</span>
                        <span class="hd-fin-value">${formatMoney(fin.income || 0)}</span>
                    </div>
                    <div class="hd-fin-item expense">
                        <span class="hd-fin-label">Expenses</span>
                        <span class="hd-fin-value">${formatMoney(fin.expenses || 0)}</span>
                    </div>
                    <div class="hd-fin-item savings">
                        <span class="hd-fin-label">Savings</span>
                        <span class="hd-fin-value">${formatMoney(fin.savings || 0)}</span>
                    </div>
                </div>
            </div>

            <div class="hd-right-panel">
                <!-- Component Breakdown -->
                <div class="hd-components">
                    <h4 class="hd-section-title">Score Breakdown</h4>
                    ${_renderComponent('💸', 'Spending', comps.spending)}
                    ${_renderComponent('💰', 'Savings', comps.savings)}
                    ${_renderComponent('📋', 'Budget', comps.budget)}
                    ${_renderComponent('🎯', 'Goals', comps.goals)}
                </div>

                <!-- Quick Metrics -->
                <div class="hd-metrics">
                    <div class="hd-metric">
                        <div class="hd-metric-label">Spending Ratio</div>
                        <div class="hd-metric-value">${data.details.spending_ratio}%</div>
                    </div>
                    <div class="hd-metric">
                        <div class="hd-metric-label">Savings Rate</div>
                        <div class="hd-metric-value">${data.details.savings_rate}%</div>
                    </div>
                    <div class="hd-metric">
                        <div class="hd-metric-label">Budget Adherence</div>
                        <div class="hd-metric-value">${data.details.budget_adherence}%</div>
                    </div>
                    <div class="hd-metric">
                        <div class="hd-metric-label">Risk Level</div>
                        <div class="hd-metric-value hd-risk-${data.details.risk_level.toLowerCase()}">${data.details.risk_level}</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Recommendations -->
        ${recs.length > 0 ? `
        <div class="hd-recommendations">
            <h4 class="hd-section-title" style="margin-top:24px;">💡 Recommendations</h4>
            <div class="hd-rec-grid">
                ${recs.map(r => `
                    <div class="hd-rec-card hd-rec-${r.type}">
                        <div class="hd-rec-icon">${r.icon}</div>
                        <div class="hd-rec-content">
                            <div class="hd-rec-title">${r.title}</div>
                            <div class="hd-rec-text">${r.text}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>` : ''}
    `;

    // Animate score and ring
    setTimeout(() => {
        const circle = document.getElementById('hdCircle');
        const numEl = document.getElementById('hdScoreNum');
        if (!circle || !numEl) return;

        const circumference = 2 * Math.PI * 85;
        const offset = circumference - (data.score / 100) * circumference;
        circle.style.strokeDashoffset = offset;

        // Counter animation
        const duration = 2000;
        const start = Date.now();
        const step = () => {
            const progress = Math.min((Date.now() - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            numEl.textContent = Math.floor(eased * data.score);
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);

        // Animate component bars
        document.querySelectorAll('.hd-comp-bar-fill').forEach(bar => {
            const pct = bar.dataset.pct;
            setTimeout(() => { bar.style.width = pct + '%'; }, 300);
        });
    }, 100);
}

function _renderComponent(icon, label, comp) {
    if (!comp) return '';
    const pct = Math.round(comp.score / comp.max * 100);
    const ratingClass = comp.rating === 'Excellent' ? 'success' : comp.rating === 'Good' ? 'good' : comp.rating === 'Fair' ? 'fair' : 'warning';
    return `
        <div class="hd-comp-row">
            <div class="hd-comp-info">
                <span class="hd-comp-icon">${icon}</span>
                <span class="hd-comp-label">${label}</span>
                <span class="hd-comp-score">${comp.score}/${comp.max}</span>
                <span class="hd-comp-badge hd-badge-${ratingClass}">${comp.rating}</span>
            </div>
            <div class="hd-comp-bar"><div class="hd-comp-bar-fill hd-bar-${ratingClass}" data-pct="${pct}" style="width:0"></div></div>
        </div>
    `;
}

// ===== Modals =====
function initModals() {
    document.getElementById('addTransactionBtn')?.addEventListener('click', () => showAddTransaction());
    document.querySelectorAll('.modal-overlay').forEach(m => {
        m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('active'); });
    });
}

function showAddTransaction() {
    document.getElementById('txDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('transactionModal').classList.add('active');
}
function showAddBudget() { document.getElementById('budgetModal').classList.add('active'); }
function showAddGoal() {
    document.getElementById('goalModalTitle').textContent = 'Add Goal';
    document.getElementById('goalSubmitBtn').textContent = 'Create Goal';
    document.getElementById('goalEditId').value = '';
    document.getElementById('goalForm').reset();
    // Reset icon picker
    document.querySelectorAll('#goalIconPicker .ip-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelector('#goalIconPicker .ip-btn[data-icon="🎯"]').classList.add('selected');
    document.getElementById('goalModal').classList.add('active');
}
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// ===== Forms =====
function initForms() {
    // Transaction form
    document.getElementById('transactionForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            amount: parseFloat(document.getElementById('txAmount').value),
            description: document.getElementById('txDesc').value,
            transaction_type: document.getElementById('txType').value,
            category_id: document.getElementById('txCategory').value || null,
            date: document.getElementById('txDate').value || null
        };
        await api('/api/transactions', { method: 'POST', body: JSON.stringify(data) });
        closeModal('transactionModal');
        e.target.reset();
        loadDashboardData();
    });

    // Budget form
    document.getElementById('budgetForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            category_id: parseInt(document.getElementById('budgetCategory').value),
            amount: parseFloat(document.getElementById('budgetAmount').value)
        };
        await api('/api/budgets', { method: 'POST', body: JSON.stringify(data) });
        closeModal('budgetModal');
        e.target.reset();
        loadBudgets();
    });

    // Goal form (ADD + EDIT)
    document.getElementById('goalForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = document.getElementById('goalEditId').value;
        const selectedIcon = document.querySelector('#goalIconPicker .ip-btn.selected')?.dataset.icon || '🎯';
        const data = {
            name: document.getElementById('goalName').value,
            target_amount: parseFloat(document.getElementById('goalTarget').value),
            current_amount: parseFloat(document.getElementById('goalCurrent').value) || 0,
            deadline: document.getElementById('goalDeadline').value || null,
            icon: selectedIcon
        };

        if (editId) {
            await api(`/api/goals/${editId}`, { method: 'PUT', body: JSON.stringify(data) });
        } else {
            await api('/api/goals', { method: 'POST', body: JSON.stringify(data) });
        }

        // Check if goal just completed
        if (data.current_amount >= data.target_amount) {
            celebrateGoal(data.name);
        }

        closeModal('goalModal');
        e.target.reset();
        document.getElementById('goalEditId').value = '';
        loadGoals();
    });

    // Icon picker
    document.getElementById('goalIconPicker')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.ip-btn');
        if (!btn) return;
        document.querySelectorAll('#goalIconPicker .ip-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
    });

    // Deposit form
    document.getElementById('depositForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const goalId = document.getElementById('depositGoalId').value;
        const depositAmt = parseFloat(document.getElementById('depositAmount').value);
        if (!goalId || !depositAmt) return;

        const newAmount = (window._depositCurrentAmount || 0) + depositAmt;
        await api(`/api/goals/${goalId}`, { method: 'PUT', body: JSON.stringify({ current_amount: newAmount }) });

        // Check if this deposit completes the goal
        const goals = await api('/api/goals');
        const goal = goals.find(g => g.id == goalId);
        if (goal && goal.progress >= 100) {
            celebrateGoal(goal.name);
        }

        closeModal('depositModal');
        e.target.reset();
        loadGoals();
    });

    // Profile form
    document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            full_name: document.getElementById('profileName').value,
            phone_number: document.getElementById('profilePhone').value,
            city: document.getElementById('profileCity').value,
            country: document.getElementById('profileCountry').value,
            currency: document.getElementById('profileCurrency').value
        };
        try {
            const res = await api('/api/profile', { method: 'PUT', body: JSON.stringify(data) });
            const msg = document.getElementById('profileMsg');
            msg.textContent = '✅ Profile updated successfully!';
            msg.style.display = 'block';
            msg.style.color = '#FF3459';

            // Update currency globally if changed
            userCurrency = currencyMap[data.currency] || data.currency || '₹';

            setTimeout(() => {
                msg.style.display = 'none';
                location.reload(); // Reload to refresh all currency symbols
            }, 2000);
        } catch (e) {
            console.error('Profile update error:', e);
            const msg = document.getElementById('profileMsg');
            msg.textContent = '❌ Update failed. Please try again.';
            msg.style.display = 'block';
            msg.style.color = '#FE3459';
        }
    });

    // Profile photo upload
    document.getElementById('photoUpload')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('photo', file);

        try {
            const response = await fetch('/api/profile/upload-photo', {
                method: 'POST',
                body: formData
                // Note: We don't set Content-Type header for FormData, browser does it with boundary
            });
            const res = await response.json();
            if (response.ok) {
                // Update preview
                const preview = document.getElementById('profilePhotoPreview');
                if (preview) {
                    preview.src = `/static/uploads/profiles/${res.photo_url}`;
                } else {
                    // Replace letter avatar with photo
                    const wrapper = document.querySelector('.profile-photo-wrapper');
                    const letterAvatar = document.getElementById('avatarLetter');
                    if (letterAvatar) letterAvatar.remove();
                    const img = document.createElement('img');
                    img.src = `/static/uploads/profiles/${res.photo_url}`;
                    img.id = 'profilePhotoPreview';
                    img.className = 'profile-avatar-img';
                    wrapper.insertBefore(img, wrapper.firstChild);
                }
            } else {
                alert(res.error || 'Photo upload failed');
            }
        } catch (error) {
            console.error('Photo upload error:', error);
            alert('An error occurred during upload.');
        }
    });
}

// ===== Dashboard AI Chat =====
function initDashboardChat() {
    const sendBtn = document.getElementById('dashChatSend');
    const input = document.getElementById('dashChatInput');

    if (sendBtn) {
        sendBtn.addEventListener('click', sendDashboardChat);
    }
    if (input) {
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendDashboardChat(); });
    }
}

async function sendDashboardChat() {
    const input = document.getElementById('dashChatInput');
    const msg = input.value.trim();
    if (!msg) return;

    addDashBubble(msg, 'user');
    input.value = '';

    // Show typing
    const typing = document.createElement('div');
    typing.className = 'chat-d-msg bot typing-indicator-dash';
    typing.innerHTML = '<div class="d-bubble">Thinking...</div>';
    document.getElementById('dashChatMessages').appendChild(typing);

    try {
        const data = await api('/api/chat', { method: 'POST', body: JSON.stringify({ message: msg }) });
        typing.remove();
        addDashBubble(data.reply, 'bot');
    } catch (e) {
        typing.remove();
        addDashBubble('Sorry, I encountered an error. Please try again.', 'bot');
    }
}

function addDashBubble(text, type) {
    const container = document.getElementById('dashChatMessages');
    const div = document.createElement('div');
    div.className = `chat-d-msg ${type}`;
    div.innerHTML = `<div class="d-bubble">${text.replace(/\n/g, '<br>')}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// ===== Cookie Consent =====
function checkCookieConsent() {
    const consent = localStorage.getItem('cookieWiseConsent');
    if (!consent) {
        setTimeout(() => {
            const banner = document.getElementById('cookieBanner');
            if (banner) banner.classList.add('active');
        }, 2000);
    }
}

function acceptCookies() {
    localStorage.setItem('cookieWiseConsent', 'true');
    const banner = document.getElementById('cookieBanner');
    if (banner) banner.classList.remove('active');
}

