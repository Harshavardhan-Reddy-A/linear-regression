// prediction.js - PURE JAVASCRIPT LINEAR REGRESSION FOR CATEGORIES

const runForecastBtn = document.getElementById("runForecastBtn");
const predictionResultContent = document.getElementById("predictionResultContent");
const modelDetailsContent = document.getElementById("modelDetailsContent");

let allBankData = []; 
let categoryMonthlyData = {}; // Will hold data grouped by Category

// --- PURE JS LINEAR REGRESSION CORE ---
/**
 * Calculates the slope (m) and intercept (b) for the linear regression line 
 * y = mx + b, where x is the sequence number and y is the spending amount.
 */
function calculateLinearRegression(data) {
    if (data.length < 2) {
        // Not enough data for a trend. Return an average if one point exists.
        return { m: 0, b: data.length > 0 ? data[0].amount : 0, mse: 0 };
    }
    
    // x = sequence, y = amount
    const n = data.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    data.forEach(d => {
        const x = d.sequence;
        const y = d.amount;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
    });

    const denominator = (n * sumXX - sumX * sumX);
    if (denominator === 0) {
         // Should not happen with diverse data, but prevents division by zero
         return { m: 0, b: sumY / n, mse: 0 }; 
    }

    // Calculate slope (m)
    const m = (n * sumXY - sumX * sumY) / denominator;
    
    // Calculate intercept (b)
    const b = (sumY - m * sumX) / n;

    // Calculate MSE for displaying loss/accuracy
    let mse = 0;
    data.forEach(d => {
        const predictedY = m * d.sequence + b;
        mse += Math.pow(predictedY - d.amount, 2);
    });
    mse /= n;

    return { m, b, mse };
}

/**
 * Predicts the spending for a given sequence number using the calculated regression line.
 */
function predictSpending(sequence, m, b) {
    // Prediction is simply y = mx + b
    const predictedAmount = m * sequence + b;
    return Math.max(0, predictedAmount); // Ensure spending is not negative
}
// --- END PURE JS CORE ---


// 1. Data Preparation and Grouping (MODIFIED FOR CATEGORIES)
function getMonthlyCategorySpendingData(data) {
    console.log("DEBUG: Starting getMonthlyCategorySpendingData (Category-based).");
    
    const spendingMap = data.filter(d => 
        d.Category && d.Category !== 'Income' && d.Category !== 'Savings' && d.Category !== 'Transfer'
    ).reduce((acc, item) => {
        const itemAmount = Number(item.Amount) || 0; 
        const category = item.Category;
        
        if (itemAmount > 0) {
            const monthKey = `${item.Year}-${item.Month.toString().padStart(2, '0')}`;
            
            if (!acc[category]) {
                acc[category] = {};
            }
            
            acc[category][monthKey] = {
                amount: (acc[category][monthKey] ? acc[category][monthKey].amount : 0) + itemAmount,
                year: item.Year,
                month: item.Month
            };
        }
        return acc;
    }, {});
    
    // Transform map into sequence-based arrays for regression
    const result = {};
    
    // Determine the global time sequence (useful if categories don't start/end at same time)
    const allMonths = new Set();
    Object.values(spendingMap).forEach(categoryMonths => {
        Object.keys(categoryMonths).forEach(monthKey => allMonths.add(monthKey));
    });
    const sortedMonths = Array.from(allMonths).sort();
    const monthSequenceMap = sortedMonths.reduce((map, monthKey, index) => {
        map[monthKey] = index + 1;
        return map;
    }, {});
    
    Object.keys(spendingMap).forEach(category => {
        const categoryMonths = spendingMap[category];
        const categoryData = Object.keys(categoryMonths).sort().map(monthKey => {
            const dataPoint = categoryMonths[monthKey];
            
            return {
                sequence: monthSequenceMap[monthKey], // Use global sequence
                month_of_year: Number(dataPoint.month) || 0, 
                year: Number(dataPoint.year) || 0, 
                amount: Number(dataPoint.amount) || 0
            };
        });
        
        // Filter out categories with less than 2 data points for meaningful trend
        if (categoryData.length >= 2) {
            result[category] = categoryData;
        }
    });

    return result; // Format: { 'Category1': [ {sequence: 1, amount: 100}, ... ], 'Category2': [ ... ] }
}

// 2. Training and Prediction Logic (Pure JS - MODIFIED FOR CATEGORIES)
function runForecastPrediction() {
    try {
        console.log("DEBUG: runForecastPrediction started (Category-based).");
        
        const categories = Object.keys(categoryMonthlyData);
        if (categories.length === 0) { 
            predictionResultContent.innerHTML = '<p style="color: #d9534f;">Need at least 2 months of historical data in at least two categories to calculate a trend line.</p>';
            return;
        }
        
        runForecastBtn.disabled = true;
        predictionResultContent.innerHTML = '<p>Calculating Linear Regression Trend for all categories...</p>';
        
        const allSequences = Object.values(categoryMonthlyData).flatMap(arr => arr.map(d => d.sequence));
        const maxSequence = allSequences.length > 0 ? Math.max(...allSequences) : 0;
        
        const nextSequence = maxSequence + 1; // Sequence for next month's prediction
        
        let resultsHtml = `<table class="prediction-table">
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Next Month Forecast</th>
                    <th>Next Year Total Forecast</th>
                    <th>MSE Loss</th>
                </tr>
            </thead>
            <tbody>`;
        
        let totalForecastNextMonth = 0;
        let totalForecastNextYear = 0;
        
        categories.sort().forEach(category => {
            const data = categoryMonthlyData[category];
            const lastDataPoint = data[data.length - 1];

            // Calculate the Linear Regression parameters and MSE
            const { m, b, mse } = calculateLinearRegression(data);
            
            // 1. Forecast Next Month (Sequence N + 1)
            const forecastedMonth = predictSpending(nextSequence, m, b);
            
            // 2. Forecast Next Year (Sequence N + 12)
            const predictedMonthlySpendingInOneYear = predictSpending(nextSequence + 11, m, b);
            const forecastedYear = predictedMonthlySpendingInOneYear * 12; 
            
            totalForecastNextMonth += forecastedMonth;
            totalForecastNextYear += forecastedYear;

            // --- Render the results row ---
            resultsHtml += `
                <tr>
                    <td class="category-name">${category}</td>
                    <td class="forecast-value">$${forecastedMonth.toFixed(2)}</td>
                    <td class="forecast-value">$${forecastedYear.toFixed(2)}</td>
                    <td>${mse.toFixed(2)}</td>
                </tr>
            `;
        });
        
        resultsHtml += `
            <tr class="total-row">
                <td class="category-name"><strong>TOTAL FORECAST</strong></td>
                <td class="forecast-value"><strong>$${totalForecastNextMonth.toFixed(2)}</strong></td>
                <td class="forecast-value"><strong>$${totalForecastNextYear.toFixed(2)}</strong></td>
                <td>N/A</td>
            </tr>
        `;
        
        resultsHtml += `</tbody></table>`;
        
        predictionResultContent.innerHTML = resultsHtml;

        // Update the rationale
        if (modelDetailsContent) {
            modelDetailsContent.innerHTML = `
                <p>
                    This forecast uses a **Pure JavaScript Linear Regression Model** applied **individually to each spending category's historical data**.
                </p>
                <p>
                    A separate best-fit line ($y = mx + b$) is calculated for the monthly spending trend of every category. This provides a more detailed, category-specific projection.
                </p>
                <p>
                    **Model Structure:**
                    <ul>
                        <li>**Method:** Simple Linear Regression ($y = mx + b$) run independently for ${categories.length} categories.</li>
                        <li>**Input (x):** Global Month Sequence Number (1, 2, 3, ...).</li>
                        <li>**Output (y):** Predicted Monthly Spending for the specific category.</li>
                    </ul>
                </p>
            `;
        }
        
        runForecastBtn.disabled = false;

    } catch (e) {
        console.error("FATAL ERROR during prediction:", e);
        predictionResultContent.innerHTML = `<p style="color: red;">FATAL ERROR during prediction. Error detail: ${e.message}</p>`;
        runForecastBtn.disabled = false;
    }
}


// 4. DOMContentLoaded 
document.addEventListener("DOMContentLoaded", () => {
    
    // Standard navigation logic (no changes)
    document.getElementById('homeBtn').addEventListener('click', () => {
        window.location.href = 'index.html';
    });
    document.getElementById("manageBtn").addEventListener("click", () => {
        window.location.href = "manager.html";
    });
    document.getElementById("analyzeBtn").addEventListener("click", () => {
        window.location.href = "analysis.html";
    });
    document.getElementById("predictBtn").addEventListener("click", () => {
        window.location.href = "prediction.html";
    });

    const savedData = localStorage.getItem("bankData");
    
    if (savedData) {
        try {
            allBankData = JSON.parse(savedData).map(row => {
                const dateObj = new Date(row.Date);
                row.Year = dateObj.getFullYear();
                row.Month = dateObj.getMonth() + 1;
                
                let amountString = String(row.Amount);
                amountString = amountString.replace(/[^0-9.-]/g, ''); 
                
                row.Amount = parseFloat(amountString) || 0; 
                
                return row;
            });
            
            // USE THE NEW CATEGORY FUNCTION
            categoryMonthlyData = getMonthlyCategorySpendingData(allBankData);
            const validCategories = Object.keys(categoryMonthlyData).length;

            runForecastBtn.addEventListener("click", runForecastPrediction);
            
            if (validCategories === 0) {
                predictionResultContent.innerHTML = `<p style="color: #d9534f;">Need at least 2 months of expense data in at least two categories for the prediction model.</p>`;
                runForecastBtn.disabled = true;
            } else {
                predictionResultContent.innerHTML = `<p>Found ${validCategories} categories with sufficient historical data. Click "Run Linear Regression Forecast" to calculate individual trends.</p>`;
            }

        } catch (error) {
            console.error("Error loading or parsing data:", error);
            predictionResultContent.innerHTML = '<p style="color: #d9534f;">Error loading data. Please re-upload your statement.</p>';
            runForecastBtn.disabled = true;
        }
    } else {
        predictionResultContent.innerHTML = '<p>No bank statement uploaded. Please go to Home and upload a CSV file to enable the forecast.</p>';
        runForecastBtn.disabled = true;
    }
});