
#python -m uvicorn app:app --reload
#npm run dev

#Latest
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import timedelta, datetime
import matplotlib.pyplot as plt

import NseUtility

nse = NseUtility.NseUtils()

def fetch_ohlc_for_date(ticker, date):
    """Fetch OHLC data for a given ticker and date."""
    data = yf.download(ticker, start=date.strftime('%Y-%m-%d'),
                       end=(date + timedelta(days=1)).strftime('%Y-%m-%d'),
                       auto_adjust=False)
    if data.empty:
        return None
    return data.iloc[0]

'''
def adjust_dates_to_previous_day(datetime_tuples):
    """Adjust earnings report dates (date/time tuples) to previous trading day."""
    adjusted_dates = []
    for date_str, time_str in datetime_tuples:
        full_str = f"{date_str} {time_str}:00"
        cleaned_str = full_str.replace(',:', ':').replace(',,', ',').strip()
        try:
            date = datetime.strptime(cleaned_str, '%Y-%m-%d %H:%M:%S')
        except ValueError:
            print(f"Skipping invalid datetime format: {cleaned_str}")
            continue
        date = datetime.strptime(full_str, '%Y-%m-%d %H:%M:%S')
        date -= timedelta(days=1)  # decrement by one day
        if date.weekday() == 6:  # If Sunday, move to Friday
            date -= timedelta(days=2)
        adjusted_dates.append(date)
    return adjusted_dates'''

def adjust_dates_to_previous_day(datetime_tuples):
    """Adjust earnings report dates (date/time tuples) to previous trading day."""
    adjusted_dates = []
    for date_str, time_str in datetime_tuples:
        full_str = f"{date_str} {time_str}:00"

        # Clean problematic characters before parsing
        cleaned_str = full_str.replace(',:', ':').replace(',,', ',').strip()

        try:
            date = datetime.strptime(cleaned_str, '%Y-%m-%d %H:%M:%S')
        except ValueError:
            print(f"Skipping invalid datetime format: {cleaned_str}")
            continue

        date -= timedelta(days=1)  # decrement by one day
        if date.weekday() == 6:  # Sunday adjustment to Friday
            date -= timedelta(days=2)
        adjusted_dates.append(date)
    return adjusted_dates


def get_atm_option_prices_and_implied_move(ticker, trade_date):
    """Retrieve ATM call/put prices and calculate implied move for a given trade date."""

    try:
        if trade_date.year < 2024:
            return None, None, None

        formatted_date = trade_date.strftime('%d-%m-%Y')
        fno_df = nse.fno_bhav_copy(formatted_date)

        options = fno_df[(fno_df['TckrSymb'] == ticker) & (fno_df['FinInstrmTp'] == 'STO')]
        if options.empty:
            return None, None, None

        expiry_dates = pd.to_datetime(options['XpryDt'], format='%Y-%m-%d')
        closest_expiry = expiry_dates[expiry_dates >= trade_date].min()
        if pd.isnull(closest_expiry):
            return None, None, None

        options_expiry = options[options['XpryDt'] == closest_expiry.strftime('%Y-%m-%d')]
        if options_expiry.empty:
            return None, None, None

        underlying_price = options_expiry['UndrlygPric'].iloc[0]
        atm_strike = options_expiry.iloc[(options_expiry['StrkPric'] - underlying_price).abs().argsort()]['StrkPric'].values[0]

        atm_call = options_expiry[(options_expiry['StrkPric'] == atm_strike) & (options_expiry['OptnTp'] == 'CE')]
        atm_put = options_expiry[(options_expiry['StrkPric'] == atm_strike) & (options_expiry['OptnTp'] == 'PE')]
        if atm_call.empty or atm_put.empty:
            return None, None, None

        atm_call_price = atm_call['ClsPric'].iloc[0]
        atm_put_price = atm_put['ClsPric'].iloc[0]

        fut_data = fno_df[(fno_df['TckrSymb'] == ticker) & (fno_df['FinInstrmTp'] == 'FUT')]
        if not fut_data.empty:
            underlying_close = fut_data['ClsPric'].iloc[0]
        else:
            underlying_close = underlying_price

        if not underlying_close or underlying_close == 0:
            implied_move = None
        else:
            implied_move = (atm_call_price + atm_put_price) / underlying_close * 100

        return atm_call_price, atm_put_price, implied_move
    
    except (KeyError, Exception) as e:
        # Handle missing columns or any other errors by returning None
        print(f"Warning: Could not calculate implied move for {ticker} on {trade_date}: {str(e)}")
        return None, None, None

def get_ohlc_and_pct_change_with_implied_move(ticker, datetime_tuples):
    """Calculate stock open/close pct change with implied move info for previous trading day dates."""
    nse_ticker = f"{ticker}.NS"
    adjusted_dates = adjust_dates_to_previous_day(datetime_tuples)
    implied_moves = []

    for idx, date in enumerate(adjusted_dates):
        ohlc = fetch_ohlc_for_date(nse_ticker, date)
        while ohlc is None:
            date -= timedelta(days=1)
            if date.weekday() == 6:
                date -= timedelta(days=2)
            ohlc = fetch_ohlc_for_date(nse_ticker, date)

        open_price = float(ohlc['Open'].iloc[0]) if hasattr(ohlc['Open'], 'iloc') else float(ohlc['Open'])
        close_price = float(ohlc['Close'].iloc[0]) if hasattr(ohlc['Close'], 'iloc') else float(ohlc['Close'])
        pct_change = ((close_price - open_price) / open_price) * 100

        atm_call_price, atm_put_price, implied_move = get_atm_option_prices_and_implied_move(ticker, date)

        implied_moves.append({
            'Date': datetime_tuples[idx][0],
            'Implied Move (%)': implied_move
        })

    df_implied_move = pd.DataFrame(implied_moves)
    df_implied_move['Implied Move (%)'] = df_implied_move['Implied Move (%)'].replace({np.nan: None})
    print(df_implied_move.to_string(index=False))
    return df_implied_move

def extract_dates_times_from_text(text):
    # Pattern for 'DD MMM YYYY HH:MM', e.g. '18 Jul 2025 19:33'
    pattern = r"(\d{1,2} [A-Za-z]{3} \d{4})\s+(\d{2}:\d{2})"
    matches = re.findall(pattern, text)
    dates_with_times = []
    for dt_str, time_str in matches:
        try:
            dt_obj = datetime.strptime(dt_str, "%d %b %Y")
            date_formatted = dt_obj.strftime("%Y-%m-%d")
            dates_with_times.append((date_formatted, time_str))
        except ValueError:
            continue
    return dates_with_times

# Helper function to adjust Saturday dates to next Monday
def adjust_dates_for_saturday(dates):
    adjusted_dates = []
    adjustments = {}  # Track changes for output notes
    for date_str in dates:
        date = pd.to_datetime(date_str)
        original_date = date.strftime('%Y-%m-%d')
        if date.weekday() == 5:  # Saturday
            date += timedelta(days=2)  # Next Monday
            adjustments[original_date] = date.strftime('%Y-%m-%d')
        adjusted_dates.append(date)
    return adjusted_dates, adjustments

# Helper function to adjust dates based on time > 15:15 (after Saturday adjustment, skipping Saturday-adjusted ones)
def adjust_dates_for_time(adjusted_dates, times, saturday_adjustments):
    final_dates = []
    time_adjustments = {}  # Track time-based changes
    original_dates = sorted(dates)  # Assuming 'dates' is accessible; original sorted dates

    for i, date in enumerate(adjusted_dates):
        original_date = original_dates[i]
        time_str = times[i]

        # Skip time adjustment if this date was adjusted for Saturday
        if original_date in saturday_adjustments:
            final_dates.append(date)
            continue

        try:
            # Parse time (military format, e.g., "15:30" -> datetime.time)
            time_obj = datetime.strptime(time_str, "%H:%M").time()
            threshold_time = datetime.strptime("15:15", "%H:%M").time()
            if time_obj > threshold_time:
                date += timedelta(days=1)  # Shift to next date
                time_adjustments[original_date] = date.strftime('%Y-%m-%d')
        except ValueError:
            print(f"Invalid time format for {original_date}: {time_str}. Skipping time adjustment.")

        final_dates.append(date)
    return final_dates, time_adjustments

# Function to calculate price change and get OHLC for given dates (handles far-apart dates)
def price_changes_for_dates(stock_symbol, dates_with_times, window_days=7, max_fallback_attempts=10):
    # Extract dates and times from input tuples, sort by date
    sorted_pairs = sorted(dates_with_times, key=lambda x: pd.to_datetime(x[0]))
    global dates  # Make dates global for access in helpers (temporary workaround)
    dates = [pair[0] for pair in sorted_pairs]
    times = [pair[1] for pair in sorted_pairs]

    # First, adjust for Saturdays
    adjusted_dates, saturday_adjustments = adjust_dates_for_saturday(dates)

    # Then, adjust for time > 15:15, skipping Saturday-adjusted dates
    final_dates, time_adjustments = adjust_dates_for_time(adjusted_dates, times, saturday_adjustments)
    final_dates = pd.to_datetime(final_dates)  # Ensure datetime format

    results = []
    na_fallback_adjustments = {}  # Track N/A fallback increments

    for i, date in enumerate(final_dates):
        original_date = dates[i]  # For output reference
        attempt_date = date  # Start with final adjusted date
        initial_attempt_date = attempt_date  # For tracking if adjustment happens
        data_fetched = False
        attempts = 0

        while attempts < max_fallback_attempts:
            attempts += 1
            # Define small fetch range: window_days before the date to the date itself
            start_date = (attempt_date - timedelta(days=window_days)).strftime('%Y-%m-%d')
            end_date = (attempt_date + timedelta(days=1)).strftime('%Y-%m-%d')  # +1 to include the date

            # Download historical data for this small range (add .NS for NSE stocks), suppress warning
            data = yf.download(stock_symbol + ".NS", start=start_date, end=end_date, auto_adjust=False)

            # Flatten multi-index columns if present
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)

            if data.empty or attempt_date not in data.index:
                # No data: increment date by 1 and continue
                attempt_date += timedelta(days=1)
                continue

            # Get the row for the current date using loc
            current_row = data.loc[attempt_date]

            # Safely extract OHLC, handling possible casing variations
            open_price = current_row.get('Open', current_row.get('open', None))
            high_price = current_row.get('High', current_row.get('high', None))
            low_price = current_row.get('Low', current_row.get('low', None))
            close_price = current_row.get('Close', current_row.get('close', None))

            if close_price is None:  # No valid close: increment and continue
                attempt_date += timedelta(days=1)
                continue

            # Valid data found
            data_fetched = True

            # Find the last non-NaN close before this date, checking both casings
            close_col = 'Close' if 'Close' in data.columns else 'close' if 'close' in data.columns else None
            if close_col is None:
                attempt_date += timedelta(days=1)
                continue

            prev_data = data[data.index < attempt_date].dropna(subset=[close_col])
            if not prev_data.empty:
                prev_close = prev_data[close_col].iloc[-1]
                # Calculate percentage change
                price_change = ((close_price - prev_close) / prev_close) * 100
                results.append((original_date, round(price_change, 2), round(open_price, 2) if open_price else None,
                                round(high_price, 2) if high_price else None, round(low_price, 2) if low_price else None,
                                round(close_price, 2)))
            else:
                # Still include OHLC even if no previous close
                results.append((original_date, None, round(open_price, 2) if open_price else None,
                                round(high_price, 2) if high_price else None, round(low_price, 2) if low_price else None,
                                round(close_price, 2)))
            break  # Successful fetch

        if not data_fetched:
            results.append((original_date, None, None, None, None, None))

        # Record fallback if adjustment happened
        if attempt_date != initial_attempt_date:
            na_fallback_adjustments[original_date] = f"{initial_attempt_date.strftime('%Y-%m-%d')} (original adjusted) -> {attempt_date.strftime('%Y-%m-%d')}"

    # Print any adjustments made
    if saturday_adjustments or time_adjustments or na_fallback_adjustments:
        print("Date Adjustments:")
        for orig, adj in saturday_adjustments.items():
            print(f"Saturday Adjustment: {orig} -> {adj}")
        for orig, adj in time_adjustments.items():
            print(f"Time Adjustment (>15:15): {orig} -> {adj}")
        for orig, adj in na_fallback_adjustments.items():
            print(f"N/A Fallback Adjustment: {orig} {adj}")

    df_results = pd.DataFrame(results, columns=['Date', 'Pct Change (%)', 'Open', 'High', 'Low', 'Close'])
    return df_results

def merge_dfs(df_results, df_implied_move, dates_with_times):
    """
    Merges the price reaction dataframe with the implied moves dataframe on 'Date'.
    Ensures alignment with input dates and handles missing values.
    
    Args:
        df_results: DataFrame from price_changes_for_dates (columns: Date, Pct Change (%), Open, High, Low, Close)
        df_implied_move: DataFrame from get_ohlc_and_pct_change_with_implied_move (columns: Date, Implied Move (%))
        dates_with_times: List of (date_str, time_str) tuples for original alignment
    
    Returns:
        Merged DataFrame with all columns, indexed by input order.
    """
    import pandas as pd
    from datetime import datetime
    
    # Ensure both DFs have 'Date' as index or column for merging
    if 'Date' not in df_results.columns:
        df_results['Date'] = pd.to_datetime([datetime.strptime(f"{date} {time}", '%Y-%m-%d %H:%M') for date, time in dates_with_times])
        df_results = df_results.set_index('Date')
    if 'Date' not in df_implied_move.columns:
        df_implied_move['Date'] = pd.to_datetime([datetime.strptime(f"{date} {time}", '%Y-%m-%d %H:%M') for date, time in dates_with_times])
        df_implied_move = df_implied_move.set_index('Date')
    
    # Merge on 'Date' with left join (keep all price data, add implied where available)
    df_final = pd.merge(df_results, df_implied_move[['Date', 'Implied Move (%)']], on='Date', how='left')
    
    # Reset index to match input order (reverse if needed, as in original code)
    df_final = df_final.iloc[::-1].reset_index(drop=True)
    
    # Convert Implied Move to numeric, fill NaN with NaN (for JSON handling)
    df_final['Implied Move (%)'] = pd.to_numeric(df_final['Implied Move (%)'], errors='coerce')

    df_final['Implied Move (%)'] = df_final['Implied Move (%)'].where(df_final['Implied Move (%)'].notna(), None)

    # Full rename to simple keys (as before)
    df_final = df_final.rename(columns={
    'Date': 'date',
    'Pct Change (%)': 'price_change_pct',
    'Open': 'open',
    'High': 'high',
    'Low': 'low',
    'Close': 'close',
    'Implied Move (%)': 'implied_move'
    })

    df_final['date'] = pd.to_datetime(df_final['date']).dt.strftime('%Y-%m-%d')  # Clean date

    df_final = df_final[['date', 'price_change_pct', 'open', 'high', 'low', 'close', 'implied_move']]  # Order

    return df_final

#  python -m uvicorn app:app --reload
    


# Example usage with your date-time pairs
'''stock_symbol = "BPCL"  # Without .NS, as it's added in the function
dates_with_times = extract_dates_times_from_text(ocr_texttext)
dates_with_times = [
    ("2025-04-29", "15:50"),
    ("2025-01-23", "11:25"),
    ("2024-10-25", "17:37"),
    ("2024-07-19", "20:10"),
    ("2024-05-10", "12:34"),
    ("2024-01-29", "13:40"),
    ("2023-10-27", "19:30"),
    ("2023-07-26", "14:38"),
    ("2023-05-22", "20:40"),
    ("2023-01-30", "17:39"),
    ("2022-11-07", "21:18"),
    ("2022-08-06", "19:32"),
    ("2022-05-26", "14:28"),
    ("2022-01-31", "17:20"),
    ("2021-10-29", "18:01"),
    ("2021-08-12", "15:30"),
    ("2021-05-26", "19:40"),
]
'''


