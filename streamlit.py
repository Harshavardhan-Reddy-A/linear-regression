import streamlit as st
import pandas as pd
import numpy as np
import warnings

# --- FIX START ---
# CORRECTED: Use pd.errors.SettingWithCopyWarning for modern Pandas versions
warnings.filterwarnings('ignore', category=pd.errors.SettingWithCopyWarning)
# --- FIX END ---

# --- Constants ---
ST_MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December"]

# Merged waste list from manager.js and streamlit.py
ST_WASTE_CATEGORIES = [
    'Luxury Items', 'Jewelry', 'Vacation', 'Pub', 'Liquor Store', 
    'Dining Out', 'Entertainment', 'swiggy', 'uber', 'zomato', 
    'bar', 'delivery', 'coffee', 'cab'
]

# --- Styles ---
def apply_styles():
    st.markdown("""
        <style>
        /* Global Streamlit overrides */
        [data-testid="stSidebar"] {
            background-color: #f5f0f0;
        }
        /* Header emulation */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            background-color: #d9534f;
            color: white;
            padding: 10px 15px;
            margin: -20px -20px 20px -20px; /* Adjust padding to look like a full header */
        }
        .header-title { font-size: 28px; font-weight: bold; text-align: center; flex-grow:1; margin:5px 0;}
        .header button {
            background-color: white; color: #d9534f; font-weight:bold;
            border:none; border-radius:5px; padding:6px 12px; cursor:pointer; margin:5px 5px;
        }

        /* Card and metric styling */
        .card {
            background-color: white;
            padding:20px;
            border-radius:10px;
            box-shadow:0 4px 8px rgba(0,0,0,0.2);
            margin-bottom:20px;
        }

        #totalSpent { font-size:2em; color:#d9534f; font-weight:bold; }
        .waste-list { list-style-type: none; padding: 0; }
        .waste-item { margin-bottom: 10px; text-align: left; }
        .waste-amount { color: #d9534f; font-weight: bold; }
        .waste-bar { height: 8px; background-color: #f5f0f0; border-radius: 4px; margin-top: 2px; }
        .waste-fill { height: 100%; background-color: #d9534f; border-radius: 4px; }
        
        /* Analysis & Prediction Table Styling */
        .prediction-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 0.95em;
            text-align: left;
        }

        .prediction-table th,
        .prediction-table td {
            padding: 8px;
            border-bottom: 1px solid #ddd;
            text-align: center;
        }
        
        .prediction-table th {
            background-color: #f8f8f8;
        }
        
        .prediction-table .category-name {
            text-align: left;
        }
        
        .prediction-table .total-row {
            background-color: #f0f0f0;
            font-weight: bold;
            border-top: 2px solid #d9534f;
        }

        /* Category Split Styling (Emulating analysis.js bars) */
        .category-bar-fill {
            height: 100%; 
            border-radius: 5px;
        }
        </style>
    """, unsafe_allow_html=True)

# --- Data Handling ---
def get_week_of_month(day):
    """Calculates the approximate week number (1-5)."""
    return (day - 1) // 7 + 1

def parse_csv(uploaded_file):
    """Reads CSV, cleans Amount, and calculates date features."""
    try:
        df = pd.read_csv(uploaded_file)
    except Exception as e:
        st.error(f"Error reading CSV: {e}")
        return None
        
    required_cols = ['Date', 'Category', 'Amount']
    # Check for core columns
    if not all(col in df.columns for col in required_cols):
        st.error(f"CSV must have columns: {', '.join(required_cols)}")
        return None
    
    # Robust amount cleaning (similar to index.js logic)
    df['Amount'] = pd.to_numeric(
        df['Amount'].astype(str).str.replace(r'[^0-9.-]', '', regex=True), 
        errors='coerce'
    ).fillna(0)
    
    # Date parsing
    df['DateObj'] = pd.to_datetime(df['Date'], errors='coerce')
    df.dropna(subset=['DateObj'], inplace=True)

    if df.empty:
        st.error("No valid date entries found in the CSV.")
        return None
        
    df['Year'] = df['DateObj'].dt.year
    df['Month'] = df['DateObj'].dt.month
    df['Day'] = df['DateObj'].dt.day
    df['WeekOfMonth'] = df['Day'].apply(get_week_of_month)
    
    # Ensure Description column for manager.js logic emulation (use Category as fallback)
    if 'Description' not in df.columns:
        df['Description'] = df['Category']
        
    return df.sort_values('DateObj')


# --- Filtering Utility (Used by Manage and Analyze) ---
def filter_data(df, scope, year, month_name, week):
    """Filters DataFrame based on selected scope and period."""
    if df.empty: return df

    filtered_df = df.copy()
    month = ST_MONTH_NAMES.index(month_name) + 1 if month_name else None

    if year:
        filtered_df = filtered_df[filtered_df['Year'] == year]

    if scope in ['monthly', 'weekly'] and month:
        filtered_df = filtered_df[filtered_df['Month'] == month]

    if scope == 'weekly' and week:
        filtered_df = filtered_df[filtered_df['WeekOfMonth'] == week]

    # Exclude non-expense categories from spending totals
    expense_df = filtered_df[
        (filtered_df['Amount'] > 0) & 
        (~filtered_df['Category'].isin(['Income', 'Savings', 'Transfer']))
    ]
    
    return expense_df


# --- Pages ---

def home_page():
    st.markdown('<div class="card"><h2>Upload Your Bank Statement</h2></div>', unsafe_allow_html=True)
    uploaded_file = st.file_uploader("Upload CSV", type=['csv'])
    if uploaded_file:
        df = parse_csv(uploaded_file)
        if df is not None and not df.empty:
            st.session_state['df'] = df
            
            # Set initial selection to the latest date
            latest_date = df['DateObj'].max()
            st.session_state['selected_year'] = latest_date.year
            st.session_state['selected_month_name'] = ST_MONTH_NAMES[latest_date.month - 1]
            st.session_state['selected_week'] = get_week_of_month(latest_date.day)

            st.success("File uploaded and processed successfully!")
            st.dataframe(df.head(), use_container_width=True)
        elif df is not None:
            st.warning("Processed file is empty or contains no valid data.")

# ----------------------------------------------------------------------
def manage_page():
    st.markdown('<h2>Manage Spending</h2>', unsafe_allow_html=True)
    if 'df' not in st.session_state or st.session_state['df'].empty:
        st.warning("Upload CSV in Home first.")
        return
    
    df = st.session_state['df']
    unique_years = sorted(df['Year'].unique(), reverse=True)

    # --- Sidebar Filters ---
    st.sidebar.markdown('### Manage Scope')
    # Using a key and ensuring we reset month selection if scope changes to yearly
    scope = st.sidebar.selectbox('Manage Scope', ['monthly', 'yearly'], key='manage_scope', 
                                 on_change=lambda: st.session_state.pop('selected_month_name', None) if st.session_state['manage_scope'] == 'yearly' else None)
    
    year = st.sidebar.selectbox('Year', unique_years, 
                                index=unique_years.index(st.session_state.get('selected_year', unique_years[0])))
    
    month_name = None
    if scope == 'monthly':
        month_name = st.sidebar.selectbox('Month', ST_MONTH_NAMES, 
                                          index=ST_MONTH_NAMES.index(st.session_state.get('selected_month_name', ST_MONTH_NAMES[0])))
    
    st.session_state['selected_year'] = year
    if month_name: st.session_state['selected_month_name'] = month_name

    # --- Data Filtering and Summary ---
    current_data = filter_data(df, scope, year, month_name, None)
    total_spent = current_data['Amount'].sum()
    
    summary_text = f"Summary ({month_name} {year})" if scope == 'monthly' else f"Summary ({year})"

    st.markdown(f'<h3>{summary_text}</h3>', unsafe_allow_html=True)
    st.markdown(f'<div class="card"><h3>Total Spent:</h3><div id="totalSpent">${total_spent:.2f}</div></div>', unsafe_allow_html=True)

    # --- Waste Analysis Logic (Manager.js emulation) ---
    st.markdown('<div class="card"><h3>💰 Where is the Money Wasted?</h3>', unsafe_allow_html=True)
    
    # Filter for waste (Category or Description keyword match)
    waste_data = current_data[
        current_data.apply(lambda row: 
            row['Category'] in ST_WASTE_CATEGORIES or 
            any(keyword.lower() in str(row.get('Description', '')).lower() for keyword in ST_WASTE_CATEGORIES), 
            axis=1
        )
    ]
    
    if waste_data.empty:
        st.markdown("<p>Great job! We didn't find any high-waste activities in your spending for this period.</p>", unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)
        return

    # Group and sum waste by Category
    waste_summary = waste_data.groupby('Category')['Amount'].sum().reset_index()
    waste_summary = waste_summary.sort_values('Amount', ascending=False)
    total_waste = waste_summary['Amount'].sum()

    st.markdown(f'<p>You spent a total of <strong>${total_waste:.2f}</strong> on the following high-waste activities this period:</p>', unsafe_allow_html=True)
    
    waste_html = '<ul class="waste-list">'
    for _, row in waste_summary.iterrows():
        category = row['Category']
        amount = row['Amount']
        percentage = (amount / total_waste) * 100
        
        waste_html += f"""
            <li class="waste-item">
                <strong class="waste-amount">${amount:.2f}</strong> wasted on <strong>{category}</strong> ({percentage:.1f}%)
                <div class="waste-bar">
                    <div class="waste-fill" style="width: {percentage:.1f}%;"></div>
                </div>
            </li>
        """
    waste_html += '</ul>'
    # FIX: Set unsafe_allow_html=True for the waste list content
    st.markdown(waste_html, unsafe_allow_html=True) 

    st.markdown('</div>', unsafe_allow_html=True)

# ----------------------------------------------------------------------
def analyze_page():
    st.markdown('<h2>Analyze Spending</h2>', unsafe_allow_html=True)
    if 'df' not in st.session_state or st.session_state['df'].empty:
        st.warning("Upload CSV in Home first.")
        return
    
    df = st.session_state['df']
    unique_years = sorted(df['Year'].unique(), reverse=True)
    
    # --- Sidebar Filters ---
    st.sidebar.markdown('### Analysis Scope')
    scope = st.sidebar.selectbox('Analysis Scope', ['monthly', 'yearly', 'weekly'], key='analyze_scope')
    
    year = st.sidebar.selectbox('Year', unique_years, 
                                index=unique_years.index(st.session_state.get('selected_year', unique_years[0])))
    
    month_name = None
    if scope in ['monthly', 'weekly']:
        month_name = st.sidebar.selectbox('Month', ST_MONTH_NAMES, 
                                          index=ST_MONTH_NAMES.index(st.session_state.get('selected_month_name', ST_MONTH_NAMES[0])))
    
    week = None
    if scope == 'weekly':
        # Determine max week based on selected year and month
        month_index = ST_MONTH_NAMES.index(month_name) + 1 if month_name else 1
        max_week = df[
            (df['Year'] == year) & (df['Month'] == month_index)
        ]['WeekOfMonth'].max() if month_name else 5
        weeks = list(range(1, int(max_week) + 1))
        # Ensure default selection is within bounds
        default_week = st.session_state.get('selected_week', 1)
        if default_week not in weeks:
            default_week = weeks[0] if weeks else 1
            
        week = st.sidebar.selectbox('Week', weeks, index=weeks.index(default_week))
    
    st.session_state['selected_year'] = year
    if month_name: st.session_state['selected_month_name'] = month_name
    if week: st.session_state['selected_week'] = week

    # --- Data Filtering ---
    filtered_df = filter_data(df, scope, year, month_name, week)
    
    # --- Analysis Components ---
    col1, col2 = st.columns(2)

    with col1:
        st.markdown('<div class="card"><h3>Split Up by Category</h3>', unsafe_allow_html=True)
        if filtered_df.empty:
            st.markdown('<p>No expenses found for this period.</p>', unsafe_allow_html=True)
        else:
            category_summary = filtered_df.groupby('Category')['Amount'].sum().sort_values(ascending=False).reset_index()
            total_expense = category_summary['Amount'].sum()
            
            # Emulate Pie Chart with HTML/CSS for visualization
            chart_html = '<ul style="list-style-type: none; padding: 0; text-align: left;">'
            for _, row in category_summary.iterrows():
                category = row['Category']
                amount = row['Amount']
                percentage = (amount / total_expense) * 100
                # Color logic from analysis.js: highlight food/delivery/cab categories
                color = '#ff7f0e' if any(w in category for w in ['Food', 'Delivery', 'Cab', 'Bar']) else '#d9534f'
                
                chart_html += f"""
                    <li style="margin-bottom: 5px;">
                        <strong>{category}:</strong> ${amount:.2f} ({percentage:.1f}%)
                        <div style="height: 10px; background-color: #eee; border-radius: 5px; margin-top: 3px;">
                            <div class="category-bar-fill" style="width: {percentage:.1f}%; background-color: {color};"></div>
                        </div>
                    </li>
                """
            chart_html += '</ul>'
            # FIX: Set unsafe_allow_html=True for the category split list content
            st.markdown(chart_html, unsafe_allow_html=True) 
        st.markdown('</div>', unsafe_allow_html=True)

    with col2:
        trend_title = {
            'yearly': 'Monthly Spending Trend',
            'monthly': 'Weekly Spending Trend',
            'weekly': 'Daily Spending Trend'
        }.get(scope, 'Spending Trend')
        st.markdown(f'<div class="card"><h3 id="trendTitle">{trend_title}</h3>', unsafe_allow_html=True)

        if filtered_df.empty:
            st.markdown('<p>No spending data to visualize trends.</p>', unsafe_allow_html=True)
        else:
            # Grouping key logic (analysis.js emulation)
            if scope == 'yearly':
                trend_data = filtered_df.groupby('Month')['Amount'].sum().reset_index()
                trend_data['Period'] = trend_data['Month'].apply(lambda m: ST_MONTH_NAMES[m - 1])
                st.bar_chart(trend_data.set_index('Period')['Amount'], use_container_width=True)
            elif scope == 'monthly':
                trend_data = filtered_df.groupby('WeekOfMonth')['Amount'].sum().reset_index()
                trend_data['Period'] = trend_data['WeekOfMonth'].apply(lambda w: f'Week {w}')
                st.bar_chart(trend_data.set_index('Period')['Amount'], use_container_width=True)
            elif scope == 'weekly':
                # Use standard line chart for daily trend as in original JS logic
                trend_data = filtered_df.groupby('DateObj')['Amount'].sum().reset_index()
                trend_data['Period'] = trend_data['DateObj'].dt.date
                st.line_chart(trend_data.set_index('Period')['Amount'], use_container_width=True)
        st.markdown('</div>', unsafe_allow_html=True)

    # --- Detailed Statement ---
    st.markdown('<div class="card full-width"><h3>Detailed Statement</h3>', unsafe_allow_html=True)
    if filtered_df.empty:
        st.info("No data available for this selection.")
    else:
        # Select the relevant columns for display
        display_df = filtered_df[['DateObj', 'Category', 'Amount']].copy()
        display_df.rename(columns={'DateObj': 'Date', 'Amount': 'Amount ($)'}, inplace=True)
        # Format amount to 2 decimal places
        display_df['Amount ($)'] = display_df['Amount ($)'].apply(lambda x: f"${x:.2f}")
        st.dataframe(display_df, use_container_width=True, hide_index=True)
    st.markdown('</div>', unsafe_allow_html=True)

# ----------------------------------------------------------------------
def predict_page():
    st.markdown('<h2>Predict Spending</h2>', unsafe_allow_html=True)
    if 'df' not in st.session_state or st.session_state['df'].empty:
        st.warning("Upload CSV in Home first.")
        return
    
    df = st.session_state['df']
    
    # 1. Aggregate Monthly Data by Category (prediction.js logic)
    category_monthly = df[~df['Category'].isin(['Income', 'Savings', 'Transfer'])]
    category_monthly = category_monthly.groupby(['Year', 'Month', 'Category'])['Amount'].sum().reset_index()

    # Filter out categories with less than 2 months of data for trend calculation
    valid_categories = category_monthly['Category'].value_counts()
    valid_categories = valid_categories[valid_categories >= 2].index
    category_monthly = category_monthly[category_monthly['Category'].isin(valid_categories)]

    if category_monthly.empty:
        st.error("Need at least 2 months of historical expense data in a category for prediction.")
        return

    # Create a global sequence number (prediction.js logic)
    monthly_map = category_monthly.groupby(['Year', 'Month']).size().reset_index().sort_values(['Year', 'Month'])
    monthly_map['seq'] = monthly_map.index + 1
    category_monthly = pd.merge(category_monthly, monthly_map[['Year', 'Month', 'seq']], on=['Year', 'Month'])

    # 2. Run Linear Regression and Forecast for Each Category (prediction.js logic)
    results = []
    max_sequence = category_monthly['seq'].max()
    next_sequence = max_sequence + 1
    
    for category in valid_categories:
        data = category_monthly[category_monthly['Category'] == category]
        
        # Linear Regression: y = mx + b (x=seq, y=Amount)
        try:
            m, b = np.polyfit(data['seq'], data['Amount'], 1)
        except np.linalg.LinAlgError:
            m, b = 0, data['Amount'].mean() # Fallback to mean if linear fit fails
        
        # Prediction for next month and next year (sequence N+1 and N+12)
        forecasted_month = max(0, m * next_sequence + b)
        # Forecasted spending one year from now (N+12) and multiply by 12 months for annual projection
        forecasted_year_amount = max(0, m * (next_sequence + 11) + b)
        forecasted_year_total = forecasted_year_amount * 12

        # Calculate MSE
        predicted_y = m * data['seq'] + b
        mse = np.mean((data['Amount'] - predicted_y) ** 2)

        results.append({
            'Category': category,
            'Next Month Forecast': forecasted_month,
            'Next Year Total Forecast': forecasted_year_total,
            'MSE Loss': mse
        })
        
    results_df = pd.DataFrame(results).sort_values('Category')

    # --- 3. Render Results ---
    st.markdown('<div class="card"><h3>📈 Linear Regression Forecast Results</h3>', unsafe_allow_html=True)
    
    if results_df.empty:
        st.info("Not enough data to run category-specific prediction.")
    else:
        # Calculate Totals
        total_next_month = results_df['Next Month Forecast'].sum()
        total_next_year = results_df['Next Year Total Forecast'].sum()

        # Format DataFrame for display (HTML Table emulation)
        display_df = results_df.copy()
        display_df['Next Month Forecast'] = display_df['Next Month Forecast'].apply(lambda x: f'${x:.2f}')
        display_df['Next Year Total Forecast'] = display_df['Next Year Total Forecast'].apply(lambda x: f'${x:.2f}')
        display_df['MSE Loss'] = display_df['MSE Loss'].apply(lambda x: f'{x:.2f}')
        
        # Custom HTML table rendering to include the TOTAL row 
        table_html = """
        <table class="prediction-table">
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Next Month Forecast</th>
                    <th>Next Year Total Forecast</th>
                    <th>MSE Loss</th>
                </tr>
            </thead>
            <tbody>
        """
        for _, row in display_df.iterrows():
            table_html += f"""
                <tr>
                    <td class="category-name">{row['Category']}</td>
                    <td>{row['Next Month Forecast']}</td>
                    <td>{row['Next Year Total Forecast']}</td>
                    <td>{row['MSE Loss']}</td>
                </tr>
            """
        table_html += f"""
            <tr class="total-row">
                <td class="category-name"><strong>TOTAL FORECAST</strong></td>
                <td><strong>${total_next_month:.2f}</strong></td>
                <td><strong>${total_next_year:.2f}</strong></td>
                <td>N/A</td>
            </tr>
        """
        table_html += '</tbody></table>'
        # FIX: Set unsafe_allow_html=True for the prediction table content
        st.markdown(table_html, unsafe_allow_html=True) 

    st.markdown('</div>', unsafe_allow_html=True)
    
    # Model Details Rationale
    st.markdown('<div class="card"><h3>💡 Model Rationale: Simple Linear Regression</h3>', unsafe_allow_html=True)
    st.markdown(f"""
        <p>
            This forecast uses a **Simple Linear Regression Model** ($y = mx + b$) applied **individually to each spending category's historical monthly data** (for {len(valid_categories)} categories with sufficient data).
        </p>
        <p>
            The model calculates a best-fit straight line based on the monthly sequence (x) and the category spending (y) to project future trends.
        </p>
    """, unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)


# --- Main App ---
def main():
    st.set_page_config(layout="wide", page_title="SpendWise")
    apply_styles()
    
    # Initialize session state for navigation and data persistence
    if 'page' not in st.session_state: st.session_state['page']='home'
    if 'df' not in st.session_state: st.session_state['df'] = pd.DataFrame()
    
    # Use st.sidebar for navigation to keep the main content clean
    with st.sidebar:
        st.markdown('<div class="header-title" style="color: #d9534f; margin-top:0;">SpendWise</div>', unsafe_allow_html=True)
        
        if st.button("🏠 Home", use_container_width=True): st.session_state['page']='home'
        if st.button("📊 Manage", use_container_width=True): st.session_state['page']='manage'
        if st.button("🔎 Analyze", use_container_width=True): st.session_state['page']='analyze'
        if st.button("🔮 Predict", use_container_width=True): st.session_state['page']='predict'
        st.markdown("---")


    # Page routing
    page = st.session_state['page']
    
    if page == 'home': home_page()
    elif page == 'manage': manage_page()
    elif page == 'analyze': analyze_page()
    elif page == 'predict': predict_page()

if __name__ == "__main__":
    main()
