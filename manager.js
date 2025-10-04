// manager.js

const totalSpentEl = document.getElementById("totalSpent");
// REMOVED: suggestedSavingsEl
const wastedContentEl = document.getElementById("wastedContent");

// NEW: Comprehensive list of categories considered waste
const HIGH_WASTE_CATEGORIES = [
    'Luxury Items', 'Jewelry', 'Vacation', 'Pub', 
    'Liquor Store', 'Dining Out', 'Entertainment',
    // Including common transactional descriptions as a fallback for waste:
    'swiggy', 'uber', 'zomato', 'bar', 'delivery', 'coffee', 'cab'
]; 

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
];

let allBankData = []; // To store all parsed data

function updateDashboard(totalSpent, year, monthName, scope) {
    totalSpentEl.textContent = `$${totalSpent.toFixed(2)}`;
    
    // Update the header based on the selected scope
    let summaryText = 'Summary';
    if (scope === 'monthly') {
        summaryText = `Monthly Summary (${monthName} ${year})`;
    } else if (scope === 'yearly') {
        summaryText = `Yearly Summary (${year})`;
    }
    document.getElementById('summaryTitle').textContent = summaryText;
}

// Function to analyze wasteful spending (Groups by Category, as requested)
function analyzeWastedSpending(data) {
    if (!data || data.length === 0) {
        wastedContentEl.innerHTML = "<p>No expenses found this period to analyze.</p>";
        return;
    }

    // Filter for expenses that match the high-waste categories or contain keywords in Description
    const wasteData = data.filter(d => 
        d.Amount > 0 && 
        d.Category && // Must have a category
        d.Category !== 'Income' && 
        d.Category !== 'Savings' && 
        d.Category !== 'Transfer' 
    ).filter(d => {
        const categoryMatch = HIGH_WASTE_CATEGORIES.includes(d.Category);
        const descriptionText = (d.Description || '').toLowerCase();
        
        // Check if description contains any of the transactional waste keywords
        const descriptionMatch = HIGH_WASTE_CATEGORIES.some(keyword => 
            descriptionText.includes(keyword.toLowerCase())
        );

        return categoryMatch || descriptionMatch;
    });

    if (wasteData.length === 0) {
        wastedContentEl.innerHTML = "<p>Great job! We didn't find any high-waste activities in your spending for this period.</p>";
        return;
    }

    // Group by Category and sum the amount
    const wasteSummary = wasteData.reduce((acc, item) => {
        // Use the Category name for grouping
        const categoryName = item.Category || 'Uncategorized Waste'; 
        acc[categoryName] = (acc[categoryName] || 0) + item.Amount;
        return acc;
    }, {});

    const sortedWaste = Object.entries(wasteSummary).sort(([, a], [, b]) => b - a);

    const totalWaste = sortedWaste.reduce((sum, [, amount]) => sum + amount, 0);

    let html = `<p>You spent a total of <strong>$${totalWaste.toFixed(2)}</strong> on the following high-waste activities this period:</p>`;
    html += '<ul style="list-style-type: none; padding: 0; text-align: left;">';
    
    // Display in the requested format: $Amount wasted on Category
    sortedWaste.forEach(([category, amount]) => {
        const percentage = ((amount / totalWaste) * 100).toFixed(1);
        
        html += `<li style="margin-bottom: 8px;">
            <strong style="color: #d9534f;">$${amount.toFixed(2)}</strong> wasted on <strong>${category}</strong> (${percentage}%)
            <div style="height: 8px; background-color: #f5f0f0; border-radius: 4px; margin-top: 2px;">
                <div style="width: ${percentage}%; height: 100%; background-color: #d9534f; border-radius: 4px;"></div>
            </div>
        </li>`;
    });
    html += '</ul>';

    wastedContentEl.innerHTML = html;
}

// Controls visibility of selectors based on analysis scope
function updateScopeVisibility() {
    const scope = document.getElementById("scopeSelect").value;
    // Use the container IDs from manager.html
    const monthContainer = document.getElementById("monthSelectorContainer");

    if (scope === 'yearly') {
        // Hide month selector for yearly scope
        monthContainer.style.display = 'none';
    } else { // monthly scope
        // Show month selector for monthly scope
        monthContainer.style.display = 'flex';
    }
    filterAndRender();
}


// Populate year and month selectors based on data
function initializePeriodSelectors() {
    const yearSelect = document.getElementById("yearSelect");
    const monthSelect = document.getElementById("monthSelect");
    
    yearSelect.innerHTML = '';
    
    // Populate Years
    const uniqueYears = [...new Set(allBankData.map(d => d.Year))].sort((a, b) => b - a);
    uniqueYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });
    
    // Populate Months (static list)
    monthSelect.innerHTML = MONTH_NAMES.map(month => `<option value="${month}">${month}</option>`).join('');

    // Set default period to the latest month
    if (uniqueYears.length > 0) {
        const latestYear = uniqueYears[0];
        const latestMonth = Math.max(...allBankData.filter(d => d.Year === latestYear).map(d => d.Month));
        
        yearSelect.value = latestYear;
        monthSelect.value = MONTH_NAMES[latestMonth - 1]; 
    }
}

// Filter data and calculate total spent for the selected period
function filterAndRender() {
    const scope = document.getElementById("scopeSelect").value;
    const yearSelect = document.getElementById("yearSelect");
    const monthSelect = document.getElementById("monthSelect");
    
    if (yearSelect.value === '') { // Year is mandatory for both scopes
        updateDashboard(0, 'N/A', 'N/A', scope);
        analyzeWastedSpending(null);
        return;
    }
    
    const year = parseInt(yearSelect.value);
    
    let currentFilteredData = allBankData.filter(d => d.Year === year);
    let monthName = '';

    if (scope === 'monthly') {
        monthName = monthSelect.value;
        if (monthName === '') {
            updateDashboard(0, year, 'N/A', scope);
            analyzeWastedSpending(null);
            return;
        }
        const month = MONTH_NAMES.indexOf(monthName) + 1; // 1-12
        currentFilteredData = currentFilteredData.filter(d => d.Month === month);
    }
    
    // Calculate total spending (excluding Income and Savings from 'spent')
    const totalSpent = currentFilteredData
        .filter(d => d.Amount > 0 && d.Category !== 'Income' && d.Category !== 'Savings' && d.Category !== 'Transfer')
        .reduce((sum, d) => sum + d.Amount, 0);

    updateDashboard(totalSpent, year, monthName, scope);
    analyzeWastedSpending(currentFilteredData); 
}


document.addEventListener("DOMContentLoaded", () => {
    const savedData = localStorage.getItem("bankData");
    
    if (savedData) {
        try {
            allBankData = JSON.parse(savedData).map(row => {
                const dateObj = new Date(row.Date);
                row.Year = dateObj.getFullYear();
                row.Month = dateObj.getMonth() + 1;
                // Ensure there is a 'Description' for waste analysis (use Category if missing)
                row.Description = row.Description || row.Category || ''; 
                return row;
            });

            if (allBankData.length > 0) {
                initializePeriodSelectors();
                
                // Set initial scope visibility and render
                updateScopeVisibility(); 
                
                // Attach event listeners for dynamic updates
                document.getElementById("scopeSelect").addEventListener("change", updateScopeVisibility);
                document.getElementById("yearSelect").addEventListener("change", filterAndRender);
                document.getElementById("monthSelect").addEventListener("change", filterAndRender);
                
            } else {
                // Handle no data case
                updateDashboard(0, 'N/A', 'N/A', 'monthly');
                analyzeWastedSpending(null);
            }
        } catch (error) {
            console.error("Error loading or parsing data:", error);
            updateDashboard(0, 'Error', 'Loading', 'monthly');
            analyzeWastedSpending(null);
        }
    } else {
        // No data in localStorage
        updateDashboard(0, 'N/A', 'N/A', 'monthly');
        analyzeWastedSpending(null);
    }
});
