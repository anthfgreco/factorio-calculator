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
  await expect(page.locator(".production-target-header")).toContainText("Rate/min")
  await page.locator("#s_rate").check()
  await expect(page.locator(".production-target-header")).toContainText("Rate/s")
  await page.locator("#title_setting").fill(title)
  await expect(page).toHaveTitle(title)
  await expect(page).toHaveURL(/#.+/)
  const persistedHash = new URL(page.url()).hash

  await page.reload()
  await expect(page).toHaveTitle(title)
  await expect(page.locator("#targets > li.target")).toHaveCount(2)
  await expect(page.locator(".production-target-header")).toContainText("Rate/s")
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

test("production targets activate displayed values and preserve belt intent", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await page.goto("/calc.html")

  const target = page.locator("#targets > li.target").first()
  const machines = target.locator(".target-machine-count")
  const rate = target.locator(".target-rate")
  const belts = target.locator(".target-belts")
  const targetItemName = await target.locator(".target-item-name").innerText()

  await machines.fill("24")
  await machines.press("Enter")
  await expect(machines).toHaveClass(/selected/)
  const derivedRate = await rate.inputValue()
  expect(derivedRate).not.toBe("")

  await rate.click()
  await rate.press("Enter")
  await expect(rate).toHaveClass(/selected/)
  await expect(rate).toHaveValue(derivedRate)
  await expect(machines).not.toHaveClass(/selected/)

  await belts.fill("0.5")
  await belts.press("Enter")
  await expect(belts).toHaveClass(/selected/)
  await expect(rate).toHaveValue("450")
  await expect.poll(() => new URL(page.url()).hash).not.toBe("")

  await page.getByRole("button", { name: "Settings" }).click()
  await page.locator("#belt_stack_size").selectOption("4")
  await expect(rate).toHaveValue("450")
  await page.getByRole("button", { name: "Factory" }).click()
  await page.getByRole("combobox", { name: `Belt stacking for ${targetItemName}` }).selectOption("stacked")
  await expect(rate).toHaveValue("1800")
  await page.getByRole("button", { name: "Settings" }).click()
  await page.locator('#belt_selector input[value="fast-transport-belt"]').evaluate((element) => {
    if (!(element instanceof HTMLInputElement) || element.labels?.[0] === undefined) {
      throw new Error("Expected the fast belt input to have a clickable label")
    }
    element.labels[0].click()
  })
  await expect(rate).toHaveValue("3600")

  await page.reload()
  const reloadedTarget = page.locator("#targets > li.target").first()
  await expect(reloadedTarget.locator(".target-belts")).toHaveValue("0.5")
  await expect(reloadedTarget.locator(".target-belts")).toHaveClass(/selected/)
  await expect(reloadedTarget.locator(".target-rate")).toHaveValue("3600")
  await page.getByRole("button", { name: "Factory" }).click()
  await expect(page.getByRole("combobox", { name: `Belt stacking for ${targetItemName}` })).toHaveValue("stacked")

  await reloadedTarget.locator(".production-target-item .dropdownWrapper").click()
  await page
    .locator(".itemDropdown.open label")
    .filter({ hasText: /^Water$/ })
    .click()
  await expect(reloadedTarget.locator(".target-belts")).toBeDisabled()
  await expect(reloadedTarget.locator(".target-belts")).toHaveValue("N/A")
  await expect(reloadedTarget.locator(".target-rate")).toHaveClass(/selected/)
  await expect(reloadedTarget.locator(".target-rate")).toHaveValue("3600")

  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("legacy belt-stack links keep their all-stacked behavior", async ({ page }) => {
  await page.goto("/calc.html#bstack=4")

  await page.getByRole("button", { name: "Settings" }).click()
  await expect(page.locator("#belt_stack_size")).toHaveValue("4")
  await expect(page.locator("#belt_stack_default_policy")).toHaveValue("stacked")
})

test("critical calculator controls remain visible on mobile", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/calc.html")

  await expect(page.getByRole("button", { name: "Add target" })).toBeVisible()
  await expect(page.locator(".tabs")).toBeVisible()
  const target = page.locator("#targets > li.target").first()
  for (const label of ["Quality", "Machines", "Rate/min", "Belts"]) {
    await expect(target.locator(".target-field-label").filter({ hasText: label })).toBeVisible()
  }

  const quality = await target.locator(".target-quality-field").boundingBox()
  const machines = await target.locator(".target-machines-field").boundingBox()
  const rate = await target.locator(".target-rate-field").boundingBox()
  const belts = await target.locator(".target-belts-field").boundingBox()
  if (quality === null || machines === null || rate === null || belts === null) {
    throw new Error("Expected all mobile target fields to have visible layouts")
  }
  expect(Math.abs(quality.x - rate.x)).toBeLessThan(2)
  expect(Math.abs(machines.x - belts.x)).toBeLessThan(2)
  expect(rate.y).toBeGreaterThan(quality.y)
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
