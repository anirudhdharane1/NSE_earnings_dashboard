
from typing import List
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
import pytesseract
import cv2
import numpy as np
import re
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from earnings_reaction_calculator import price_changes_for_dates

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

def extract_dates_times_from_text(text):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
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
    images: List[UploadFile] = File(...)
):
    all_dates_with_times = []
    for image in images:
        contents = await image.read()
        npimg = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
        ocr_text = pytesseract.image_to_string(img)
        dates_with_times = extract_dates_times_from_text(ocr_text)
        all_dates_with_times.extend(dates_with_times)
    # Sort by date (and time if needed)
    all_dates_with_times.sort()
    if not all_dates_with_times:
        return JSONResponse(
            {"error": "Could not extract any valid date/time pairs from images."},
            status_code=400
        )
    results = price_changes_for_dates(ticker, all_dates_with_times)
    output_results = []
    valid_changes = []
    for date, change, open_p, high_p, low_p, close_p in results:
        output_results.append({
            "date": date,
            "price_change_pct": change,
            "open": open_p,
            "high": high_p,
            "low": low_p,
            "close": close_p
        })
        if change is not None:
            valid_changes.append(abs(change))
    stats = {}
    if valid_changes:
        stats["total_input_dates"] = len(all_dates_with_times)
        stats["absolute_mean"] = round(np.mean(valid_changes), 2)
        stats["first_std"] = round(np.mean(valid_changes) + np.std(valid_changes), 2)
        stats["second_std"] = round(np.mean(valid_changes) + 2 * np.std(valid_changes), 2)
        stats["third_std"] = round(np.mean(valid_changes) + 3 * np.std(valid_changes), 2)
    else:
        stats["total_input_dates"] = len(all_dates_with_times)
        stats["absolute_mean"] = None
        stats["first_std"] = None
        stats["second_std"] = None
        stats["third_std"] = None
    return JSONResponse({
        "results": output_results,
        "stats": stats
    })
