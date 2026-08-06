import { expect, test, type Page } from "@playwright/test"

const title = "Codex regression plan"

function collectBrowserErrors(page: Page): string[] {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })
  return errors
}

test("calculator workflow persists settings and renders the graph", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await page.goto("/calc.html")

  await expect(page.locator("#targets > li.target")).toHaveCount(1)
  await expect(page.locator("#factory_summary")).toBeVisible()
  await expect(page.locator("#calculation_error")).toBeHidden()
  await expect(page.locator("#data_set")).not.toHaveValue("")

  await page.getByRole("button", { name: "Add target" }).click()
  await expect(page.locator("#targets > li.target")).toHaveCount(2)

  await page.getByRole("button", { name: "Settings" }).click()
  await expect(page.locator("#settings_button")).toHaveClass(/active/)
  await page.locator("#title_setting").fill(title)
  await expect(page).toHaveTitle(title)
  await expect(page).toHaveURL(/#.+/)
  const persistedHash = new URL(page.url()).hash

  await page.reload()
  await expect(page).toHaveTitle(title)
  await expect(page.locator("#targets > li.target")).toHaveCount(2)
  await expect.poll(() => new URL(page.url()).hash).toBe(persistedHash)

  await page.getByRole("button", { name: "Settings" }).click()
  await page.locator("#progression_preset").selectOption("first-planets")
  await expect(page.locator("#mprod")).toHaveValue("30.000")
  await expect(page.locator("#max_quality")).toHaveValue("2")

  await page.getByRole("button", { name: "Visualize" }).click()
  await expect(page.locator("#graph_button")).toHaveClass(/active/)
  await expect(page.locator("#visualization_summary")).not.toHaveText("")

  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("critical calculator controls remain visible on mobile", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/calc.html")

  await expect(page.getByRole("button", { name: "Add target" })).toBeVisible()
  await expect(page.locator(".tabs")).toBeVisible()
  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("opening a target picker and selecting a shorter target do not shift the page", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1032 })
  await page.goto("/calc.html")

  const targetsHeading = page.locator(".targets-heading")
  const plannerToolbar = page.locator(".planner-toolbar")
  const initialLeft = await targetsHeading.evaluate((element) => element.getBoundingClientRect().left)
  const initialToolbarTop = await plannerToolbar.evaluate((element) => element.getBoundingClientRect().top)
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollHeight > document.documentElement.clientHeight))
    .toBe(true)

  await page.locator(".production-target-item .dropdownWrapper").click()
  await expect(page.locator(".itemDropdown.open")).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollHeight > document.documentElement.clientHeight))
    .toBe(true)
  await expect
    .poll(() => plannerToolbar.evaluate((element) => element.getBoundingClientRect().top))
    .toBe(initialToolbarTop)

  await page.locator(".itemDropdown.open label").filter({ hasText: "Iron plate" }).first().click()
  await expect(page.locator(".itemDropdown input:checked + label .target-item-name")).toHaveText("Iron plate")
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollHeight <= document.documentElement.clientHeight))
    .toBe(true)

  await expect(page.locator("html")).toHaveCSS("scrollbar-gutter", "stable")
  await expect.poll(() => targetsHeading.evaluate((element) => element.getBoundingClientRect().left)).toBe(initialLeft)
})
