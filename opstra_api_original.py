from playwright.sync_api import sync_playwright
from datetime import datetime

EMAIL = ""
PASSWORD = ""
STOCK = "INFY"

LOGIN_URL = "https://sso.definedge.com/auth/realms/definedge/protocol/openid-connect/auth?response_type=code&client_id=opstra&redirect_uri=https://opstra.definedge.com/ssologin&state=e2cf559f-356c-425a-87e3-032097f643d0&login=true&scope=openid"

RESULTS_PAGE = "https://opstra.definedge.com/historical-results-timings"


from datetime import datetime

def convert_date(date_str):
    return datetime.strptime(date_str, "%d-%m-%Y").strftime("%Y-%m-%d")


with sync_playwright() as p:

    browser = p.chromium.launch(headless=False)
    page = browser.new_page()

    page.goto(LOGIN_URL)

    # Login if required
    if "sso.definedge.com" in page.url:
        page.fill('input[name="username"]', EMAIL)
        page.fill('input[name="password"]', PASSWORD)
        page.click("#kc-login")
        page.wait_for_url("**opstra.definedge.com**")

    page.goto(RESULTS_PAGE)

    # Listen for API response
    with page.expect_response(lambda r: STOCK in r.url and r.request.resource_type == "xhr") as response_info:

        dropdown = page.locator("input").first
        dropdown.click()
        dropdown.fill(STOCK)
        page.keyboard.press("Enter")

    response = response_info.value
    data = response.json()

    dates_with_times = []

    for row in data:
        date = convert_date(row["Date"])
        time = row["Time"]
        dates_with_times.append((date, time))

    dates_with_times = dates_with_times.reverse()
    print(dates_with_times)

    browser.close()