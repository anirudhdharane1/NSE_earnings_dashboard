from playwright.sync_api import sync_playwright
from datetime import datetime


LOGIN_URL = "https://sso.definedge.com/auth/realms/definedge/protocol/openid-connect/auth?response_type=code&client_id=opstra&redirect_uri=https://opstra.definedge.com/ssologin&state=e2cf559f-356c-425a-87e3-032097f643d0&login=true&scope=openid"

RESULTS_PAGE = "https://opstra.definedge.com/historical-results-timings"


def convert_date(date_str):
    return datetime.strptime(date_str, "%d-%m-%Y").strftime("%Y-%m-%d")


def get_opstra_earnings_dates(stock: str, email: str, password: str):
    """
    Fetch earnings announcement dates and times for a stock from Opstra.

    Args:
        stock (str): Stock ticker (e.g. "INFY")
        email (str): Definedge login email
        password (str): Definedge login password

    Returns:
        list[tuple]: List of tuples -> [(YYYY-MM-DD, HH:MM), ...]
    """

    with sync_playwright() as p:

        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.goto(LOGIN_URL)

        # Login if required
        if "sso.definedge.com" in page.url:
            page.fill('input[name="username"]', email)
            page.fill('input[name="password"]', password)
            page.click("#kc-login")
            page.wait_for_url("**opstra.definedge.com**")

        page.goto(RESULTS_PAGE)

        # Capture API response
        with page.expect_response(lambda r: stock in r.url and r.request.resource_type == "xhr") as response_info:

            dropdown = page.locator("input").first
            dropdown.click()
            dropdown.fill(stock)
            page.keyboard.press("Enter")

        response = response_info.value
        data = response.json()

        dates_with_times = []

        for row in data:
            date = convert_date(row["Date"])
            time = row["Time"]
            dates_with_times.append((date, time))

        browser.close()

        # Reverse order (oldest → newest or vice versa depending on preference)
        dates_with_times.reverse()

        return dates_with_times