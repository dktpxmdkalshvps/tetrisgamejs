import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        await page.goto("http://localhost:5174/")

        # Wait for game to render
        await page.wait_for_timeout(2000)

        # Take light mode screenshot
        await page.screenshot(path="theme_light.png")

        # Click toggle to dark mode
        await page.click("button:has-text('DARK')")

        # Wait for transition
        await page.wait_for_timeout(1000)

        # Take dark mode screenshot
        await page.screenshot(path="theme_dark.png")

        await browser.close()

asyncio.run(run())
