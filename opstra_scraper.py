from playwright.sync_api import sync_playwright
from datetime import datetime
import time

# ================================
# USER VARIABLES
# ================================

EMAIL = "dharaneanirudh@yahoo.com"
PASSWORD = "Seshadripuram@67"
STOCK_TICKER = "ABB"

LOGIN_URL = "https://sso.definedge.com/auth/realms/definedge/protocol/openid-connect/auth?response_type=code&client_id=opstra&redirect_uri=https://opstra.definedge.com/ssologin&state=e2cf559f-356c-425a-87e3-032097f643d0&login=true&scope=openid"

RESULTS_PAGE = "https://opstra.definedge.com/historical-results-timings"


def convert_date(date_str):
    """
    Convert '14 Jan 2026' -> '2026-01-14'
    """
    dt = datetime.strptime(date_str, "%d %b %Y")
    return dt.strftime("%Y-%m-%d")


def run():
    with sync_playwright() as p:

        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        # ===================================
        # STEP 1: OPEN LOGIN PAGE
        # ===================================

        page.goto(LOGIN_URL)

        time.sleep(1)

        # ===================================
        # STEP 2: HANDLE LOGIN IF NEEDED
        # ===================================

        if "sso.definedge.com" in page.url:

            page.fill('input[name="username"]', EMAIL)
            page.fill('input[name="password"]', PASSWORD)

            page.click("#kc-login")

            time.sleep(1)

        # ===================================
        # STEP 3: NAVIGATE TO RESULTS PAGE
        # ===================================

        page.goto(RESULTS_PAGE)

        page.wait_for_selector("input")

        # ===================================
        # STEP 4: ENTER STOCK TICKER
        # ===================================

        dropdown = page.locator("input").first
        dropdown.click()
        dropdown.fill(STOCK_TICKER)

        page.keyboard.press("Enter")

        # Wait for table to load
        page.wait_for_selector("table tbody tr")

        # ===================================
        # STEP 5: SCROLL TABLE
        # ===================================

        previous_height = 0

        while True:
            page.mouse.wheel(0, 3000)
            time.sleep(1)

            height = page.evaluate("document.body.scrollHeight")

            if height == previous_height:
                break

            previous_height = height

        # ===================================
        # STEP 6: EXTRACT TABLE DATA
        # ===================================

        rows = page.locator("table tbody tr")

        count = rows.count()

        dates_with_times = []

        for i in range(count):

            row = rows.nth(i)

            date_text = row.locator("td").nth(3).inner_text().strip()
            time_text = row.locator("td").nth(4).inner_text().strip()

            formatted_date = convert_date(date_text)

            dates_with_times.append((formatted_date, time_text))

        # ===================================
        # STEP 7: PRINT RESULT
        # ===================================

        print("\nDates with Times:\n")
        print(dates_with_times)

        browser.close()


if __name__ == "__main__":
    run()