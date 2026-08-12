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
  await expect(rate).toHaveValue("1,800")
  await page.getByRole("button", { name: "Settings" }).click()
  await page.locator('#belt_selector input[value="fast-transport-belt"]').evaluate((element) => {
    if (!(element instanceof HTMLInputElement) || element.labels?.[0] === undefined) {
      throw new Error("Expected the fast belt input to have a clickable label")
    }
    element.labels[0].click()
  })
  await expect(rate).toHaveValue("3,600")

  await page.reload()
  const reloadedTarget = page.locator("#targets > li.target").first()
  await expect(reloadedTarget.locator(".target-belts")).toHaveValue("0.5")
  await expect(reloadedTarget.locator(".target-belts")).toHaveClass(/selected/)
  await expect(reloadedTarget.locator(".target-rate")).toHaveValue("3,600")
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
  await expect(reloadedTarget.locator(".target-rate")).toHaveValue("3,600")

  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("legacy belt-stack links keep their all-stacked behavior", async ({ page }) => {
  await page.goto("/calc.html#bstack=4")

  await page.getByRole("button", { name: "Settings" }).click()
  await expect(page.locator("#belt_stack_size")).toHaveValue("4")
  await expect(page.locator("#belt_stack_default_policy")).toHaveValue("stacked")
})

test("equipment quality stays compact and round-trips through the URL", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await page.goto("/calc.html")
  const initialHash = new URL(page.url()).hash

  const circuitRow = page
    .locator("tr.display-row")
    .filter({ has: page.locator(".item-name", { hasText: "Advanced circuit" }) })
  await expect(circuitRow).toHaveCount(1)
  await expect(page.locator("tr.factory-header th", { hasText: /^Quality$/ })).toHaveCount(0)

  await circuitRow.locator(".machine-selector .dropdownWrapper").click()
  await page
    .locator(".machine-dropdown.open .machine-option")
    .filter({ hasText: /^Assembling machine 3/ })
    .click()
  await circuitRow.locator(".machine-selector .dropdownWrapper").click()
  const machineQualityStrip = page.locator(".machine-dropdown.open > .equipment-quality-strip")
  await expect(machineQualityStrip.getByRole("button")).toHaveCount(5)
  await machineQualityStrip.getByRole("button", { name: "Legendary quality" }).click()
  await expect(circuitRow.locator(".machine-selector .equipment-quality-badge")).toHaveAttribute(
    "title",
    "Legendary machine quality",
  )
  await expect(circuitRow.locator("tt.building-count")).toHaveAttribute(
    "data-tooltip",
    /^Legendary Assembling Machine 3\nEffective crafting speed/,
  )

  const circuitFirstModule = circuitRow.locator(".module-cell .module-wrapper").first()
  await circuitFirstModule.locator(".dropdownWrapper").click()
  const targetModuleQualityStrip = page.locator(".tippy-dropdown-menu.open > .equipment-quality-strip")
  await targetModuleQualityStrip.getByRole("button", { name: "Epic quality" }).click()
  await expect(targetModuleQualityStrip).toBeVisible()
  const emptyModuleOption = page.locator('.tippy-dropdown-menu.open span.input[data-tooltip="Empty Module Slot"]')
  await emptyModuleOption.hover()
  const visibleTextTooltip = page.locator('.tippy-box[data-theme~="factorio"] .tippy-content:visible')
  await expect(visibleTextTooltip).toHaveCount(1)
  await expect(visibleTextTooltip).toHaveText("Empty Module Slot")
  await page.keyboard.press("Escape")

  const oreRow = page.locator("tr.display-row").filter({ has: page.locator(".item-name", { hasText: "Iron ore" }) })
  await oreRow.locator(".module-cell .module-wrapper").first().locator(".dropdownWrapper").click()
  const moduleQualityStrip = page.locator(".tippy-dropdown-menu.open > .equipment-quality-strip")
  await moduleQualityStrip.getByRole("button", { name: "Rare quality" }).click()
  await expect(moduleQualityStrip).toBeVisible()
  await expect(page.locator('.tippy-dropdown-menu.open span.input[data-tooltip^="Rare Speed Module"]')).toHaveCount(3)
  await expect(
    page.locator('.tippy-dropdown-menu.open span.input[data-tooltip^="Rare Speed Module"]').first(),
  ).toHaveAttribute("data-tooltip", /Speed \+32%/)
  await page.locator('.tippy-dropdown-menu.open span.input[data-tooltip^="Rare Speed Module"]').first().hover()
  await expect(visibleTextTooltip).toHaveCount(1)
  await expect(visibleTextTooltip).toContainText("Rare Speed Module\nSpeed +32%")
  await page.locator('.tippy-dropdown-menu.open img[alt="Speed module"]').click()
  const oreModuleBadges = oreRow.locator(".module-cell .module-wrapper .equipment-quality-badge")
  await expect(oreModuleBadges).toHaveCount(3)
  await expect(oreModuleBadges.first()).toHaveAttribute("title", "Rare quality")
  await expect(oreModuleBadges.last()).toHaveAttribute("title", "Rare quality")
  await expect(oreModuleBadges.first()).toHaveAttribute("src", "images/pixel.gif")
  await expect(oreRow.locator("tt.building-count")).toHaveAttribute("data-tooltip", /Resource drain/)
  await expect(oreRow.locator("tt.building-count")).toHaveAttribute("data-tooltip", /Expected patch yield/)

  await oreRow.locator(".beacon-container .module-wrapper").first().locator(".dropdownWrapper").click()
  await page.locator('.tippy-dropdown-menu.open img[alt="Speed module"]').click()
  await oreRow.locator(".beacon-container .module-wrapper").first().locator(".dropdownWrapper").click()
  await page
    .locator(".tippy-dropdown-menu.open > .equipment-quality-strip")
    .getByRole("button", { name: "Uncommon quality" })
    .click()
  const beaconModuleBadges = oreRow.locator(".beacon-container .module-wrapper .equipment-quality-badge")
  await expect(beaconModuleBadges).toHaveCount(2)
  await expect(beaconModuleBadges.last()).toHaveAttribute("title", "Uncommon quality")
  await oreRow.locator(".beacon-quality-selector .dropdownWrapper").click()
  const beaconQualityChoices = page.locator(".tippy-dropdown-menu.open > .equipment-quality-strip")
  await expect(beaconQualityChoices.locator("button img")).toHaveCount(5)
  await beaconQualityChoices.locator('button[title="Legendary quality"]').click()
  await expect(oreRow.locator(".beacon-quality-selector .dropdownWrapper")).toHaveAttribute(
    "aria-label",
    "Legendary beacon quality",
  )
  await expect(oreRow.locator(".beacon-quality-selector .dropdownWrapper")).toHaveAttribute(
    "data-tooltip",
    /^Legendary Beacon\n250% distribution effectivity/,
  )

  await page.getByRole("button", { name: "Settings" }).click()
  await page.getByRole("combobox", { name: "Default module quality" }).selectOption("rare")
  await expect.poll(() => new URL(page.url()).hash).not.toBe(initialHash)
  const qualityHash = new URL(page.url()).hash

  await page.reload()
  await expect.poll(() => new URL(page.url()).hash).toBe(qualityHash)
  await expect(page.getByRole("combobox", { name: "Default module quality" })).toHaveValue("rare")
  await page.getByRole("button", { name: "Factory" }).click()
  const reloadedCircuitRow = page
    .locator("tr.display-row")
    .filter({ has: page.locator(".item-name", { hasText: "Advanced circuit" }) })
  await expect(reloadedCircuitRow.locator(".machine-selector .equipment-quality-badge")).toHaveAttribute(
    "title",
    "Legendary machine quality",
  )
  await expect(
    reloadedCircuitRow.locator(".module-cell .module-wrapper").first().locator(".equipment-quality-badge"),
  ).toHaveAttribute("title", "Epic quality")
  const reloadedOreRow = page
    .locator("tr.display-row")
    .filter({ has: page.locator(".item-name", { hasText: "Iron ore" }) })
  await expect(
    reloadedOreRow.locator(".module-cell .module-wrapper").first().locator(".equipment-quality-badge"),
  ).toHaveAttribute("title", "Rare quality")
  await expect(reloadedOreRow.locator(".beacon-quality-selector .dropdownWrapper")).toHaveAttribute(
    "aria-label",
    "Legendary beacon quality",
  )
  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("normal-only datasets hide equipment quality controls", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await page.goto("/calc.html#data=2-0-55")

  await expect(page.locator("#data_set")).toHaveValue("2-0-55")
  await page.getByRole("button", { name: "Settings" }).click()
  await expect(page.getByText("Equipment quality defaults", { exact: true })).toBeHidden()

  await page.getByRole("button", { name: "Factory" }).click()
  const firstModule = page.locator("tr.display-row .module-cell .module-wrapper").first()
  await firstModule.locator(".dropdownWrapper").click()
  await expect(page.locator(".tippy-dropdown-menu.open > .equipment-quality-strip")).toHaveCount(0)
  await expect(firstModule.locator(".equipment-quality-badge")).toHaveCount(0)
  await expect(page.locator(".beacon-quality-selector:visible")).toHaveCount(0)
  expect(browserErrors, "uncaught browser errors").toEqual([])
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
