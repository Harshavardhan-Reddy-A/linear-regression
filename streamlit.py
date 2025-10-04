import streamlit as st
import pandas as pd
import numpy as np

# --- Constants ---
ST_MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December"]
ST_WASTE_CATEGORIES = [
    'Luxury Items', 'Jewelry', 'Vacation', 'Pub',
    'Liquor Store', 'Dining Out', 'Entertainment',
    'swiggy', 'uber', 'zomato', 'bar', 'delivery', 'coffee', 'cab'
]

# --- Styles ---
def apply_styles():
    st.markdown("""
        <style>
        /* Header */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            background-color: #d9534f;
            color: white;
            padding: 10px 15px;
        }
        .header-title { font-size: 28px; font-weight: bold; text-align: center; flex-grow:1; margin:5px 0;}
        .header button {
            background-color: white; color: #d9534f; font-weight:bold;
            border:none; border-radius:5px; padding:6px 12px; cursor:pointer; margin:5px 5px;
        }

        /* Cards */
        .card {
            background-color: white;
            padding:20px;
            border-radius:10px;
            box-shadow:0 4px 8px rgba(0,0,0,0.2);
            margin-bottom:20px;
        }

        #totalSpent { font-size:2em; color:#d9534f; font-weight:bold; }

        @media(max-width:768px){
            .header { flex-direction: column; }
            .header-title { text-align:center; margin:10px 0; }
        }
        </style>
    """, unsafe_allow_html=True)

# --- Data Handling ---
def parse_csv(uploaded_file):
    df = pd.read_csv(uploaded_file)
    required_cols = ['Date', 'Category', 'Amount']
    if not all(col in df.columns for col in required_cols):
        st.error(f"CSV must have columns: {', '.join(required_cols)}")
        return None
    df['Amount'] = pd.to_numeric(df['Amount'].astype(str).str.replace(r'[^0-9.-]', '', regex=True), errors='coerce').fillna(0)
    df['DateObj'] = pd.to_datetime(df['Date'], errors='coerce')
    df.dropna(subset=['DateObj'], inplace=True)
    df['Year'] = df['DateObj'].dt.year
    df['Month'] = df['DateObj'].dt.month
    df['Day'] = df['DateObj'].dt.day
    df['WeekOfMonth'] = df['Day'].apply(lambda x: (x-1)//7 + 1)
    return df

# --- Navigation ---
def set_page(page_name):
    st.session_state['page'] = page_name

# --- Pages ---
def home_page():
    st.markdown('<div class="card"><h2>Upload Your Bank Statement</h2></div>', unsafe_allow_html=True)
    uploaded_file = st.file_uploader("Upload CSV", type=['csv'])
    if uploaded_file:
        df = parse_csv(uploaded_file)
        if df is not None:
            st.session_state['df'] = df
            st.success("File uploaded successfully!")

def manage_page():
    st.markdown('<div class="card"><h2>Manage Spending</h2></div>', unsafe_allow_html=True)
    if 'df' not in st.session_state or st.session_state['df'].empty:
        st.warning("Upload CSV in Home first.")
        return
    df = st.session_state['df']
    total_spent = df['Amount'].sum()
    st.markdown('<div class="card"><h3>Total Spent:</h3><div id="totalSpent">${:.2f}</div></div>'.format(total_spent), unsafe_allow_html=True)

def analyze_page():
    st.markdown('<div class="card"><h2>Analyze Spending</h2></div>', unsafe_allow_html=True)
    if 'df' not in st.session_state or st.session_state['df'].empty:
        st.warning("Upload CSV in Home first.")
        return
    df = st.session_state['df']
    category_summary = df.groupby('Category')['Amount'].sum().reset_index()
    st.bar_chart(category_summary, x='Category', y='Amount', use_container_width=True)
    st.dataframe(df[['Date','Category','Amount']], use_container_width=True)

def predict_page():
    st.markdown('<div class="card"><h2>Predict Spending</h2></div>', unsafe_allow_html=True)
    if 'df' not in st.session_state or st.session_state['df'].empty:
        st.warning("Upload CSV in Home first.")
        return
    df = st.session_state['df']
    monthly = df.groupby(['Year','Month'])['Amount'].sum().reset_index()
    if len(monthly) < 2:
        st.info("Need at least 2 months of data for prediction")
        return
    monthly['seq'] = np.arange(1, len(monthly)+1)
    m, b = np.polyfit(monthly['seq'], monthly['Amount'], 1)
    next_month = max(0, m*(monthly['seq'].max()+1)+b)
    next_year = max(0, (m*(monthly['seq'].max()+12)+b)*12)
    st.markdown(f'<div class="card"><h3>Forecast Results</h3>'
                f'<p>Next Month: <strong>${next_month:.2f}</strong></p>'
                f'<p>Next Year: <strong>${next_year:.2f}</strong></p></div>', unsafe_allow_html=True)
    # Trend chart
    monthly['MonthLabel'] = monthly['Month'].apply(lambda m: ST_MONTH_NAMES[m-1])
    monthly['Predicted'] = m*monthly['seq'] + b
    st.line_chart(monthly.set_index('MonthLabel')[['Amount','Predicted']], use_container_width=True)

# --- Main App ---
def main():
    st.set_page_config(layout="wide")
    apply_styles()
    if 'page' not in st.session_state: st.session_state['page']='home'
    if 'df' not in st.session_state: st.session_state['df'] = pd.DataFrame()

    # Header Navigation
    col1, col2, col3, col4, col5 = st.columns([1,2,1,1,1])
    with col1:
        if st.button("Home"): set_page('home')
    with col2:
        st.markdown('<div class="header-title">SpendWise</div>', unsafe_allow_html=True)
    with col3:
        if st.button("Manage"): set_page('manage')
    with col4:
        if st.button("Analyze"): set_page('analyze')
    with col5:
        if st.button("Predict"): set_page('predict')

    st.markdown("---")

    # Page routing
    page = st.session_state['page']
    if page == 'home': home_page()
    elif page == 'manage': manage_page()
    elif page == 'analyze': analyze_page()
    elif page == 'predict': predict_page()

if __name__ == "__main__":
    main()
