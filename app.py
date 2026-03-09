from typing import List, Optional, Tuple
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
import asyncio
import os
import pytesseract
import cv2
import numpy as np  # Added for np.mean, np.std
import re
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import math  # For math.isnan
from earnings_reaction_calculator import price_changes_for_dates, get_ohlc_and_pct_change_with_implied_move, merge_dfs
from opstra_function import get_opstra_earnings_dates


app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        # "https://your-production-domain.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _read_env_value(key: str) -> Optional[str]:
    value = os.getenv(key)
    if value:
        return value

    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if not os.path.exists(env_path):
        return None

    try:
        with open(env_path, "r", encoding="utf-8") as env_file:
            for raw_line in env_file:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue

                env_key, env_value = line.split("=", 1)
                if env_key.strip() == key:
                    return env_value.strip().strip('"').strip("'")
    except Exception:
        return None

    return None



def extract_dates_times_from_text(text):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    combined_pattern = re.compile(r"(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s*[=:\-]?\s*(\d{2}:\d{2})")
    
    combined_matches = []
    for line in lines:
        match = combined_pattern.match(line)
        if match:
            d, t = match.groups()
            combined_matches.append((d, t))
    if combined_matches:    
        result = []
        for d, t in combined_matches:
            try:
                dt_obj = datetime.strptime(d, "%d %b %Y")
                date_iso = dt_obj.strftime("%Y-%m-%d")
                result.append((date_iso, t))
            except ValueError:
                continue
        return result
    else:
        dates = []
        times = []
        date_pattern = r"\d{1,2} [A-Za-z]{3} \d{4}"
        time_pattern = r"\d{2}:\d{2}"
        for line in lines:
            if re.match(date_pattern, line):
                dates.append(line)
            elif re.match(time_pattern, line):
                times.append(line)
        dates_with_times = []
        for dt, tm in zip(dates, times):
            try:
                dt_obj = datetime.strptime(dt, "%d %b %Y")
                date_formatted = dt_obj.strftime("%Y-%m-%d")
                dates_with_times.append((date_formatted, tm))
            except ValueError:
                continue
        return dates_with_times



@app.post("/analyze")
async def analyze(
    ticker: str = Form(...),
    images: Optional[List[UploadFile]] = File(None)
):
    all_dates_with_times: List[Tuple[str, str]] = []
    input_source = "opstra"

    opstra_email = _read_env_value("OPSTRA_EMAIL")
    opstra_password = _read_env_value("OPSTRA_PASSWORD")

    # Primary source: Opstra scraping by ticker.
    if opstra_email and opstra_password:
        all_dates_with_times = await asyncio.to_thread(
            get_opstra_earnings_dates,
            ticker,
            opstra_email,
            opstra_password,
        )

    # Fallback source: OCR from uploaded screenshots.
    if not all_dates_with_times:
        input_source = "ocr"
        images = images or []

        for image in images:
            contents = await image.read()
            npimg = np.frombuffer(contents, np.uint8)
            img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
            if img is None:
                continue

            ocr_text = pytesseract.image_to_string(img)
            print("OCR Output:\n", ocr_text)
            dates_with_times = extract_dates_times_from_text(ocr_text)
            print("Extracted Dates/Times:", dates_with_times)
            all_dates_with_times.extend(dates_with_times)

    all_dates_with_times = list(dict.fromkeys(all_dates_with_times))
    all_dates_with_times.sort(key=lambda x: (x[0], x[1]))

    if not all_dates_with_times:
        return JSONResponse(
            {
                "error": "Could not fetch date/time pairs from Opstra and no valid OCR dates were extracted.",
                "hint": "Provide OPSTRA_EMAIL/OPSTRA_PASSWORD or upload clear screenshots for OCR fallback."
            },
            status_code=400
        )


    
    '''
    MIN_DATES = 5

    if len(all_dates_with_times) < MIN_DATES:
        dummy_dates = [
            ("2020-01-01", "00:00"),
            ("2021-01-01", "00:00"),
            ("2022-01-01", "00:00"),
        ]
    # Add only enough dummy dates to reach MIN_DATES
    needed = MIN_DATES - len(all_dates_with_times)
    all_dates_with_times.extend(dummy_dates[:needed])
    '''


    # Fetch price reaction data
    df_results = price_changes_for_dates(ticker, all_dates_with_times)
    # Fetch implied moves data
    df_implied_move = get_ohlc_and_pct_change_with_implied_move(ticker, all_dates_with_times)
    # Merge the dataframes
    df_final = merge_dfs(df_results, df_implied_move, all_dates_with_times)
    # Prepare JSON-serializable output (list of dicts from DF rows)
    output_results = df_final.to_dict('records')



    def replace_nan_with_none(obj):
        if isinstance(obj, float) and math.isnan(obj):
            return None
        elif isinstance(obj, dict):
            return {k: replace_nan_with_none(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [replace_nan_with_none(item) for item in obj]
        else:
            return obj



    # Clean output_results
    output_results = replace_nan_with_none(output_results)  # Note: to_dict returns list, so direct call



    # Extract valid changes for existing stats (unchanged)
    valid_changes = []
    for row in output_results:
        change = row.get('price_change_pct')  # Changed from 'Pct Change (%)' to 'price_change_pct'
        if change is not None and not (isinstance(change, float) and math.isnan(change)):
            valid_changes.append(abs(change))

    # New calculations for additional stats
    signed_changes = []  # For average_move (signed pct changes)
    implied_moves = []   # For average_implied_move
    abs_valid_moves = [] # For average_abs_valid_moves (abs pct where implied not null)

    for row in output_results:
        pct_change = row.get('price_change_pct')
        implied = row.get('implied_move')
        
        # Signed changes (all non-null pct)
        if pct_change is not None and not (isinstance(pct_change, float) and math.isnan(pct_change)):
            signed_changes.append(pct_change)
        
        # Implied moves (all non-null)
        if implied is not None and not (isinstance(implied, float) and math.isnan(implied)):
            implied_moves.append(implied)
            
            # Abs valid moves (only where implied exists)
            if pct_change is not None and not (isinstance(pct_change, float) and math.isnan(pct_change)):
                abs_valid_moves.append(abs(pct_change))

    # Build stats dict (existing + new)
    stats = {}
    stats["total_input_dates"] = len(all_dates_with_times)

    # Existing stats
    if valid_changes:
        stats["absolute_mean"] = round(np.mean(valid_changes), 2)
        stats["first_std"] = round(np.mean(valid_changes) + np.std(valid_changes), 2)
        stats["second_std"] = round(np.mean(valid_changes) + 2 * np.std(valid_changes), 2)
        stats["third_std"] = round(np.mean(valid_changes) + 3 * np.std(valid_changes), 2)
    else:
        stats["absolute_mean"] = stats["first_std"] = stats["second_std"] = stats["third_std"] = None

    # New stats
    if signed_changes:
        stats["average_move"] = round(np.mean(signed_changes), 2)
    else:
        stats["average_move"] = None

    if implied_moves:
        stats["average_implied_move"] = round(np.mean(implied_moves), 2)
        if abs_valid_moves:
            stats["average_abs_valid_moves"] = round(np.mean(abs_valid_moves), 2)
            stats["alpha"] = round(stats["average_implied_move"] - stats["average_abs_valid_moves"], 2)
        else:
            stats["average_abs_valid_moves"] = None
            stats["alpha"] = None
    else:
        stats["average_implied_move"] = stats["average_abs_valid_moves"] = stats["alpha"] = None

    stats = replace_nan_with_none(stats)
    return JSONResponse({
        "results": output_results,
        "stats": stats,
        "input_source": input_source
    })



if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)


