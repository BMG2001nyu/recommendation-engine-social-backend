"""
Luna Social — Phone UI Automation Script (Final)
Matches transcript exactly.
"""
import time, re
from appium import webdriver
from appium.options.ios import XCUITestOptions
from appium.webdriver.common.appiumby import AppiumBy
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

DEVICE_UDID = "00008110-0010455022FA801E"
BUNDLE_ID   = "com.luna.testui"
APPIUM_URL  = "http://localhost:4723"

# Fixed tab bar coordinates
TAB = {
    "Feed":      (62,  792),
    "Venues":    (129, 792),
    "Plans":     (195, 792),
    "Interests": (261, 792),
    "More":      (328, 792),
}

def p(s): time.sleep(s)

def tap_tab(driver, name):
    driver.tap([TAB[name]]); p(1.8)

def safe_tap(driver, acc_id, timeout=10):
    try:
        el = WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((AppiumBy.ACCESSIBILITY_ID, acc_id))
        )
        el.click(); p(0.8)
        return True
    except TimeoutException:
        return False

def tap_xpath(driver, xpath, timeout=10):
    try:
        el = WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((AppiumBy.XPATH, xpath))
        )
        el.click(); p(0.8)
        return True
    except TimeoutException:
        return False

def tap_contains(driver, text, timeout=10):
    return tap_xpath(driver,
        f'//*[contains(@label,"{text}") or contains(@name,"{text}")]', timeout)

def scroll_down(driver, n=1):
    for _ in range(n):
        driver.swipe(195, 560, 195, 280, 650); p(0.9)

def scroll_up(driver, n=1):
    for _ in range(n):
        driver.swipe(195, 280, 195, 560, 650); p(0.9)

def pull_refresh(driver):
    driver.swipe(195, 200, 195, 500, 400); p(2.5)

def go_back(driver):
    safe_tap(driver, "BackButton", timeout=4)

def dismiss_sheet(driver):
    """Swipe down to close a modal sheet."""
    driver.swipe(195, 300, 195, 780, 350); p(1)

def close_create_plan(driver):
    """Tap Cancel on the Create Plan sheet."""
    safe_tap(driver, "Cancel", timeout=4)
    p(0.5)

def first_large_card(driver):
    cards = driver.find_elements(AppiumBy.XPATH,
        '//*[@type="XCUIElementTypeButton" and @visible="true" '
        'and @y > 130 and @y < 700 and @width > 300]')
    # Skip picker buttons (they contain "User,")
    for c in cards:
        name = c.get_attribute("name") or ""
        if "User," not in name and "Venue," not in name and "plus" not in name:
            return c
    return cards[0] if cards else None

# ── User pickers ─────────────────────────────────────────────────────────────

def select_user_topbar(driver, name):
    """Feed/Venues tab: top-left button label = current user name."""
    seed = ["Alex Chen","Sarah Kim","Marcus Williams","Priya Patel",
            "James O'Brien","Sofia Rodriguez","Lena Fischer","Kenji Tanaka",
            "Amara Osei","Noah Bergmann"]
    xpath = '//*[@type="XCUIElementTypeButton" and (' + \
            ' or '.join([f'@name="{u}"' for u in seed]) + ')]'
    try:
        picker = WebDriverWait(driver, 6).until(
            EC.presence_of_element_located((AppiumBy.XPATH, xpath)))
        picker.click(); p(1)
        tap_contains(driver, name, timeout=6)
        p(1.5)
    except TimeoutException:
        print(f"  (topbar picker not found for {name})")

def select_user_form(driver, name):
    """Plans / Interests Express: picker shows as 'User, [Name]'."""
    try:
        picker = WebDriverWait(driver, 6).until(
            EC.presence_of_element_located((AppiumBy.XPATH,
                '//*[contains(@name,"User,")]')))
        picker.click(); p(1)
        tap_contains(driver, name, timeout=6)
        p(1.5)
    except TimeoutException:
        print(f"  (form picker not found for {name})")

# ─── Main ─────────────────────────────────────────────────────────────────────

options = XCUITestOptions()
options.udid             = DEVICE_UDID
options.bundle_id        = BUNDLE_ID
options.platform_version = "18"
options.automation_name  = "XCUITest"
options.no_reset         = True

print("Connecting …")
driver = webdriver.Remote(APPIUM_URL, options=options)
driver.implicitly_wait(3)

# Clean any leftover sheet from previous run
close_create_plan(driver)
dismiss_sheet(driver)
p(1)
print("Connected ✓\n")

try:
    # ── 1. Cold start — Amara Osei (u9) ──────────────────────────────────────
    print("[1] Cold start — Amara Osei (u9) …")
    tap_tab(driver, "Feed")
    select_user_topbar(driver, "Amara Osei")
    p(2); scroll_down(driver, 2); p(3)

    # ── 2. Personalised — Alex Chen ───────────────────────────────────────────
    print("[2] Personalised — Alex Chen …")
    select_user_topbar(driver, "Alex Chen")
    p(2); scroll_down(driver, 2); p(3)

    # ── 3. Personalised — Marcus Williams ────────────────────────────────────
    print("[3] Personalised — Marcus Williams …")
    select_user_topbar(driver, "Marcus Williams")
    p(2); scroll_down(driver, 2); p(3)

    # ── 4. Personalised — Priya Patel ─────────────────────────────────────────
    print("[4] Personalised — Priya Patel …")
    select_user_topbar(driver, "Priya Patel")
    p(2); scroll_down(driver, 1); p(3)

    # ── 5. Venues — quality + trending ────────────────────────────────────────
    print("[5] Venues tab …")
    tap_tab(driver, "Venues")
    p(2); scroll_down(driver, 2); p(2)

    # ── 6. Venue detail — content richness ────────────────────────────────────
    print("[6] Venue detail …")
    scroll_up(driver, 3); p(1)
    card = first_large_card(driver)
    if card:
        card.click(); p(2)
        scroll_down(driver, 2); p(3)
        go_back(driver)

    # ── 7. Feed venue → suggested people + best time ──────────────────────────
    print("[7] Feed venue detail — suggested people …")
    tap_tab(driver, "Feed")
    select_user_topbar(driver, "Alex Chen")
    p(2)
    card = first_large_card(driver)
    if card:
        card.click(); p(2)
        scroll_down(driver, 3); p(3)
        go_back(driver)

    # ── 8. Express interest — Sarah Kim → Blue Note ───────────────────────────
    print("[8] Express interest — Sarah Kim …")
    tap_tab(driver, "Interests")
    safe_tap(driver, "Express"); p(1)
    select_user_form(driver, "Sarah Kim")
    # Level is already Interested by default — tap Express Interest
    safe_tap(driver, "Express Interest") or tap_contains(driver, "Submit")
    p(2.5)

    # ── 9. My History — Alex Chen ─────────────────────────────────────────────
    # My History has no picker — it uses the globally active user.
    # Switch to Alex on the Feed tab first so My History shows his data.
    print("[9] Interest history — Alex Chen …")
    tap_tab(driver, "Feed")
    select_user_topbar(driver, "Alex Chen")
    p(1)
    tap_tab(driver, "Interests")
    safe_tap(driver, "My History"); p(0.5)
    # Tap the refresh button to load Alex's history
    safe_tap(driver, "arrow.clockwise", timeout=5)
    p(2); scroll_down(driver, 2); p(3)

    # ── 10. Feed refresh — social score boosted ───────────────────────────────
    print("[10] Feed refresh — propagation …")
    tap_tab(driver, "Feed")
    select_user_topbar(driver, "Alex Chen")
    p(1); pull_refresh(driver)
    scroll_down(driver, 1); p(3)

    # ── 11. Social proof flywheel — Developer tab ─────────────────────────────
    print("[11] Social proof — Developer tab …")
    tap_tab(driver, "More")
    safe_tap(driver, "Dev") or tap_contains(driver, "Developer")
    p(1.5); scroll_down(driver, 4); p(1)
    tap_contains(driver, "Social Proof v1"); p(2)
    scroll_down(driver, 2); p(4)
    go_back(driver)

    # ── 12. Fire async event ──────────────────────────────────────────────────
    print("[12] Async event pipeline …")
    tap_tab(driver, "More")
    safe_tap(driver, "Dev") or tap_contains(driver, "Developer")
    p(1.5); scroll_down(driver, 2); p(1)
    tap_contains(driver, "Fire Event"); p(3)

    # ── 13. Create a plan — Alex invites Sarah + Marcus ───────────────────────
    print("[13] Create plan …")
    tap_tab(driver, "Plans")
    select_user_form(driver, "Alex Chen"); p(1)
    # Tap + button
    safe_tap(driver, "plus"); p(2)
    # Creator picker already shows Alex Chen — set invitees
    scroll_down(driver, 1); p(0.5)
    tap_contains(driver, "Sarah Kim"); p(0.5)
    tap_contains(driver, "Marcus Williams"); p(0.5)
    safe_tap(driver, "Create"); p(2.5)

    # ── 14. Sarah accepts invitation ──────────────────────────────────────────
    print("[14] Sarah Kim accepts …")
    tap_tab(driver, "Plans")
    select_user_form(driver, "Sarah Kim"); p(1)
    safe_tap(driver, "Invitations") or tap_contains(driver, "Invitation"); p(1.5)
    card = first_large_card(driver)
    if card:
        card.click(); p(2)
        safe_tap(driver, "Accept") or tap_contains(driver, "Accept"); p(2)
    go_back(driver)

    # ── 15. AI Booking Agent ──────────────────────────────────────────────────
    print("[15] AI Booking Agent …")
    tap_tab(driver, "Plans")
    select_user_form(driver, "Alex Chen"); p(1)
    safe_tap(driver, "Plans") or tap_contains(driver, "My Plans"); p(1)
    card = first_large_card(driver)
    if card:
        card.click(); p(2)
        scroll_down(driver, 4); p(1)
        tap_contains(driver, "Book with AI Agent", timeout=8)
        p(8); scroll_down(driver, 1); p(3)
        go_back(driver)

    # ── 16. Quick Tests — raw API ─────────────────────────────────────────────
    print("[16] Quick Tests …")
    tap_tab(driver, "More")
    safe_tap(driver, "Dev") or tap_contains(driver, "Developer")
    p(1.5); scroll_down(driver, 3); p(1)
    tap_contains(driver, "Feed (u1)"); p(2)
    scroll_down(driver, 2); p(3)
    go_back(driver)

    print("\n✅ Demo complete!")

except Exception as e:
    import traceback
    print(f"\n❌ Error: {e}")
    traceback.print_exc()

finally:
    driver.quit()
