// analysis.js

// Month names mapping
const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
];

let allBankData = []; // To store all parsed data

// Utility function to determine the week number of the month
function getWeekOfMonth(date) {
    // Calculates the approximate week number within a month (1-4 or 5)
    const dayOfMonth = date.getDate();
    return Math.ceil(dayOfMonth / 7);
}

// Load saved bank statement and initialize dashboard
document.addEventListener("DOMContentLoaded", () => {
    const savedData = localStorage.getItem("bankData");
    
    // Get selectors and labels
    const scopeSelect = document.getElementById("scopeSelect");
    const yearSelect = document.getElementById("yearSelect");
    const monthSelect = document.getElementById("monthSelect");
    const weekSelect = document.getElementById("weekSelect");

    if (savedData) {
        try {
            allBankData = JSON.parse(savedData).map(row => {
                // Pre-process and enhance data
                const dateObj = new Date(row.Date);
                row.DateObj = dateObj;
                row.Year = dateObj.getFullYear();
                row.Month = dateObj.getMonth() + 1; // 1-12
                row.WeekOfMonth = getWeekOfMonth(dateObj);
                row.DayOfWeek = dateObj.getDay(); // 0 (Sun) - 6 (Sat)
                return row;
            });

            if (allBankData.length > 0) {
                initializePeriodSelectors();
                
                // Set default period to the latest month
                const latestYear = Math.max(...allBankData.map(d => d.Year));
                const latestMonth = Math.max(...allBankData.filter(d => d.Year === latestYear).map(d => d.Month));
                
                yearSelect.value = latestYear;
                monthSelect.value = MONTH_NAMES[latestMonth - 1]; // Set by name
                
                // Initial render and set correct initial visibility
                updateScopeVisibility();

                // Attach event listeners for dynamic updates
                scopeSelect.addEventListener("change", updateScopeVisibility);
                
                // Changed to call filterAndRender directly when period selectors change
                yearSelect.addEventListener("change", filterAndRender);
                monthSelect.addEventListener("change", filterAndRender);
                weekSelect.addEventListener("change", filterAndRender);
                
            } else {
                document.querySelector('.main-area').innerHTML = '<p class="card full-width">No bank statement data available.</p>';
            }
        } catch (error) {
            console.error("Error parsing bankData from localStorage:", error);
            document.querySelector('.main-area').innerHTML = '<p class="card full-width">Error loading data. Please re-upload your statement.</p>';
        }
    } else {
        document.querySelector('.main-area').innerHTML = '<p class="card full-width">No bank statement uploaded. Please go to Home and upload a CSV file.</p>';
    }
});


// Populate year and month selectors based on data
function initializePeriodSelectors() {
    const yearSelect = document.getElementById("yearSelect");
    const monthSelect = document.getElementById("monthSelect");
    
    // Populate Years
    const uniqueYears = [...new Set(allBankData.map(d => d.Year))].sort((a, b) => b - a);
    yearSelect.innerHTML = uniqueYears.map(year => `<option value="${year}">${year}</option>`).join('');
    
    // Populate Months (static list)
    monthSelect.innerHTML = MONTH_NAMES.map(month => `<option value="${month}">${month}</option>`).join('');

    // Populate Weeks (static for now, dynamically adjusted later)
    const weekSelect = document.getElementById("weekSelect");
    weekSelect.innerHTML = `
        <option value="1">Week 1</option>
        <option value="2">Week 2</option>
        <option value="3">Week 3</option>
        <option value="4">Week 4</option>
        <option value="5">Week 5 (if applicable)</option>
    `;
}

// Controls visibility of selectors based on analysis scope (FIXED: targets new container divs)
function updateScopeVisibility() {
    const scope = document.getElementById("scopeSelect").value;
    
    // Use the new container IDs created in analysis.html
    const yearContainer = document.getElementById("yearSelectorContainer");
    const monthContainer = document.getElementById("monthSelectorContainer");
    const weekContainer = document.getElementById("weekSelectorContainer");

    document.getElementById("analysisTitle").textContent = 
        scope.charAt(0).toUpperCase() + scope.slice(1) + " Analysis";

    if (scope === 'yearly') {
        yearContainer.style.display = 'flex';
        monthContainer.style.display = 'none';
        weekContainer.style.display = 'none';
        document.getElementById("trendTitle").textContent = "Monthly Spending Trend";
    } else if (scope === 'monthly') {
        yearContainer.style.display = 'flex';
        monthContainer.style.display = 'flex';
        weekContainer.style.display = 'none';
        document.getElementById("trendTitle").textContent = "Weekly Spending Trend";
    } else if (scope === 'weekly') {
        yearContainer.style.display = 'flex';
        monthContainer.style.display = 'flex';
        weekContainer.style.display = 'flex';
        document.getElementById("trendTitle").textContent = "Daily Spending Trend";
    }
    filterAndRender();
}


// Filter data and render all components
function filterAndRender() {
    const scope = document.getElementById("scopeSelect").value;
    const year = parseInt(document.getElementById("yearSelect").value);
    const monthName = document.getElementById("monthSelect").value;
    const week = parseInt(document.getElementById("weekSelect").value);
    const month = MONTH_NAMES.indexOf(monthName) + 1; // 1-12

    let filteredData = allBankData;
    let trendGroupingKey = '';

    // 1. Apply Filters based on Scope
    if (scope === 'yearly' || scope === 'monthly' || scope === 'weekly') {
        filteredData = filteredData.filter(d => d.Year === year);
    }
    if (scope === 'monthly' || scope === 'weekly') {
        filteredData = filteredData.filter(d => d.Month === month);
    }
    if (scope === 'weekly') {
        filteredData = filteredData.filter(d => d.WeekOfMonth === week);
    }

    // 2. Determine Trend Grouping Key
    if (scope === 'yearly') {
        trendGroupingKey = 'Month';
    } else if (scope === 'monthly') {
        trendGroupingKey = 'WeekOfMonth';
    } else if (scope === 'weekly') {
        trendGroupingKey = 'Date'; // Show daily data for a selected week
    }

    // 3. Render
    renderTable(filteredData);
    renderPieChart(filteredData);
    renderTrendGraph(filteredData, trendGroupingKey, scope);
}


// Render statement table
function renderTable(data) {
    const table = document.getElementById("statementTable");
    table.innerHTML = "";

    if (!data || data.length === 0) {
        table.innerHTML = "<thead><tr><th>Date</th><th>Category</th><th>Amount</th></tr></thead><tbody><tr><td colspan='3'>No data available for this selection.</td></tr></tbody>";
        return;
    }

    // Filter to only display relevant columns: Date, Category, Amount
    const headers = Object.keys(data[0]).filter(key => ['Date', 'Category', 'Amount'].includes(key));
    let headerHtml = "<thead><tr>";
    headers.forEach(h => { headerHtml += `<th>${h}</th>`; });
    headerHtml += "</tr></thead>";
    
    let rowsHtml = "<tbody>";
    data.forEach(row => {
        let rowHtml = "<tr>";
        headers.forEach(h => {
            let cellContent = row[h];
            if (h === 'Amount') {
                cellContent = `$${row[h].toFixed(2)}`;
            }
            rowHtml += `<td>${cellContent}</td>`;
        });
        rowHtml += "</tr>";
        rowsHtml += rowHtml;
    });
    rowsHtml += "</tbody>";

    table.innerHTML = headerHtml + rowsHtml;
}


// Render Pie Chart (Category Spending)
function renderPieChart(data) {
    const chartDiv = document.getElementById("pieChart");
    
    // Group by category and sum amounts (excluding Income and Credits)
    const spendingByCategory = data.reduce((acc, item) => {
        if (item.Amount > 0 && item.Category !== 'Income' && item.Category !== 'Savings' && item.Category !== 'Transfer') {
            acc[item.Category] = (acc[item.Category] || 0) + item.Amount;
        }
        return acc;
    }, {});
    
    const sortedCategories = Object.entries(spendingByCategory).sort(([, a], [, b]) => b - a);
    const totalExpense = sortedCategories.reduce((sum, [, amount]) => sum + amount, 0);

    if (totalExpense === 0) {
        chartDiv.innerHTML = "<p>No expenses found for this period.</p>";
        return;
    }
    
    let html = '<ul style="list-style-type: none; padding: 0; text-align: left;">';
    sortedCategories.forEach(([category, amount]) => {
        const percentage = ((amount / totalExpense) * 100).toFixed(1);
        const color = category.startsWith('Food') || category.startsWith('Delivery') || category.startsWith('Cab') ? '#ff7f0e' : '#d9534f'; // Highlight high-waste categories
        html += `<li style="margin-bottom: 5px;">
            <strong>${category}:</strong> $${amount.toFixed(2)} (${percentage}%)
            <div style="height: 10px; background-color: #eee; border-radius: 5px; margin-top: 3px;">
                <div style="width: ${percentage}%; height: 100%; background-color: ${color}; border-radius: 5px;"></div>
            </div>
        </li>`;
    });
    html += '</ul>';
    chartDiv.innerHTML = html;
}


// Render Trend Graph (Weekly/Monthly/Daily Spending)
function renderTrendGraph(data, groupingKey, scope) {
    const chartDiv = document.getElementById("trendGraph");

    if (!data || data.length === 0) {
        chartDiv.innerHTML = "<p>No spending data to visualize trends.</p>";
        return;
    }
    
    // Group and aggregate data
    const spendingByPeriod = data.reduce((acc, item) => {
        if (item.Amount > 0 && item.Category !== 'Income' && item.Category !== 'Savings' && item.Category !== 'Transfer') {
            let key;
            if (groupingKey === 'Month') {
                key = MONTH_NAMES[item.Month - 1];
            } else if (groupingKey === 'WeekOfMonth') {
                key = `Week ${item.WeekOfMonth}`;
            } else if (groupingKey === 'Date') {
                key = item.Date.substring(0, 10); // Use date string for daily
            }
            
            acc[key] = (acc[key] || 0) + item.Amount;
        }
        return acc;
    }, {});
    
    const sortedPeriods = Object.entries(spendingByPeriod).sort(([a], [b]) => {
        if (scope === 'yearly') return MONTH_NAMES.indexOf(a) - MONTH_NAMES.indexOf(b);
        if (scope === 'monthly') return parseInt(a.replace('Week ', '')) - parseInt(b.replace('Week ', ''));
        if (scope === 'weekly') return new Date(a) - new Date(b); // Sort by date
        return 0;
    });

    const maxAmount = Math.max(...Object.values(spendingByPeriod));

    if (maxAmount === 0) {
        chartDiv.innerHTML = "<p>No expenses found for this period.</p>";
        return;
    }

    // Dynamic rendering of bars
    let html = '<div style="display: flex; flex-direction: column; gap: 10px; padding: 10px;">';
    sortedPeriods.forEach(([period, amount]) => {
        const width = (amount / maxAmount) * 100;
        const barColor = '#5cb85c'; 
        
        html += `<div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 100px; font-weight: bold; text-align: right; white-space: nowrap;">${period}:</div>
            <div style="flex-grow: 1; background-color: #f5f0f0; height: 20px; border-radius: 5px;">
                <div style="width: ${width}%; height: 100%; background-color: ${barColor}; border-radius: 5px; display: flex; align-items: center; padding-left: 5px; box-sizing: border-box; min-width: 10px;">
                    <span style="font-size: 0.8em; color: white; text-shadow: 0 0 2px black;">$${amount.toFixed(2)}</span>
                </div>
            </div>
        </div>`;
    });
    html += '</div>';
    
    chartDiv.innerHTML = html;
}
