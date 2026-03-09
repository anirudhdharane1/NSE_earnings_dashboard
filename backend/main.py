from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import numpy as np
import pandas as pd
from PIL import Image
import easyocr
import io
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="NSE Earnings Analytics API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://[::]:8080"],  # Frontend runs on port 8080
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize EasyOCR reader
reader = easyocr.Reader(['en'])

def extract_dates_from_image(image_bytes: bytes) -> List[str]:
    """Extract dates from uploaded earnings image using EasyOCR."""
    try:
        # Convert bytes to PIL Image
        image = Image.open(io.BytesIO(image_bytes))
        
        # Use EasyOCR to extract text
        results = reader.readtext(np.array(image))
        
        # Extract text from results
        text_lines = [result[1] for result in results]
        all_text = " ".join(text_lines)
        
        logger.info(f"Extracted text: {all_text}")
        
        # Date patterns to match various formats
        date_patterns = [
            r'\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b',  # MM/DD/YYYY or MM-DD-YYYY
            r'\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b',  # YYYY/MM/DD or YYYY-MM-DD
            r'\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b',  # DD Mon YYYY
            r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b',  # Mon DD, YYYY
        ]
        
        extracted_dates = []
        for pattern in date_patterns:
            matches = re.findall(pattern, all_text, re.IGNORECASE)
            extracted_dates.extend(matches)
        
        # Remove duplicates while preserving order
        unique_dates = list(dict.fromkeys(extracted_dates))
        
        logger.info(f"Extracted dates: {unique_dates}")
        return unique_dates
        
    except Exception as e:
        logger.error(f"Error extracting dates from image: {e}")
        return []

def generate_mock_price_data(ticker: str, earnings_dates: List[str]) -> List[Dict[str, Any]]:
    """Generate mock stock price data for demonstration."""
    # This is where you would integrate with your actual price data source
    # For now, generating realistic mock data
    
    mock_data = []
    np.random.seed(hash(ticker) % 1000)  # Consistent randomization based on ticker
    
    for date_str in earnings_dates[:12]:  # Limit to 12 most recent
        try:
            # Parse the date string (simplified - would need robust date parsing)
            date_obj = datetime.now() - timedelta(days=np.random.randint(30, 1095))
            
            # Generate realistic price movement (T+1 day after earnings)
            base_volatility = 0.05  # 5% base volatility
            earnings_impact = np.random.normal(0, 0.08)  # Additional earnings volatility
            price_change = (base_volatility + abs(earnings_impact)) * np.random.choice([-1, 1])
            
            mock_data.append({
                "date": date_obj.strftime("%Y-%m-%d"),
                "move": round(price_change * 100, 2),  # Convert to percentage
                "direction": "up" if price_change > 0 else "down"
            })
            
        except Exception as e:
            logger.warning(f"Could not process date {date_str}: {e}")
            continue
    
    # Sort by date (most recent first)
    mock_data.sort(key=lambda x: x["date"], reverse=True)
    return mock_data

def calculate_statistics(price_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate statistical measures from price movement data."""
    if not price_data:
        return {}
    
    moves = [item["move"] for item in price_data]
    abs_moves = [abs(move) for move in moves]
    
    # Basic statistics
    mean_abs_move = np.mean(abs_moves)
    std_dev = np.std(abs_moves)
    win_rate = len([m for m in moves if m > 0]) / len(moves) * 100
    
    # Calculate histogram data
    hist, bin_edges = np.histogram(moves, bins=7, range=(-8, 8))
    
    histogram_data = []
    for i in range(len(hist)):
        histogram_data.append({
            "binStart": round(bin_edges[i], 1),
            "binEnd": round(bin_edges[i + 1], 1),
            "frequency": int(hist[i]),
            "binLabel": f"{bin_edges[i]:.1f} to {bin_edges[i + 1]:.1f}"
        })
    
    return {
        "totalEarnings": len(price_data),
        "avgMove": round(mean_abs_move, 2),
        "winRate": round(win_rate, 1),
        "stdDev1": round(mean_abs_move + std_dev, 2),
        "stdDev2": round(mean_abs_move + 2 * std_dev, 2),
        "stdDev3": round(mean_abs_move + 3 * std_dev, 2),
        "histogram": histogram_data,
        "mean": round(np.mean(moves), 2)
    }

@app.post("/analyze")
async def analyze_earnings(
    file: UploadFile = File(...),
    ticker: str = Form(...)
):
    """Analyze earnings impact from uploaded image and ticker symbol."""
    try:
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Read image file
        image_bytes = await file.read()
        logger.info(f"Processing analysis for {ticker} with image {file.filename}")
        
        # Extract dates from image
        extracted_dates = extract_dates_from_image(image_bytes)
        
        if not extracted_dates:
            logger.warning("No dates found in image, using mock dates")
            # Fallback to mock dates if OCR fails
            extracted_dates = [
                "2024-01-15", "2024-04-18", "2024-07-22", "2024-10-25",
                "2023-10-20", "2023-07-18", "2023-04-15", "2023-01-12",
                "2022-10-18", "2022-07-15", "2022-04-12", "2022-01-14"
            ]
        
        # Generate price movement data (mock for demonstration)
        price_data = generate_mock_price_data(ticker, extracted_dates)
        
        # Calculate statistics
        statistics = calculate_statistics(price_data)
        
        # Prepare response
        response_data = {
            **statistics,
            "data": price_data,
            "ticker": ticker.upper(),
            "extractedDates": extracted_dates[:10],  # Include extracted dates for debugging
            "message": "Analysis completed successfully"
        }
        
        logger.info(f"Analysis completed for {ticker}")
        return JSONResponse(content=response_data)
        
    except Exception as e:
        logger.error(f"Error during analysis: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "NSE Earnings Analytics API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)