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

test("presets preserve location and Full Legendary upgrades quality only", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await page.goto("/calc.html")

  const nauvis = page.locator("#planet_selector .location-toggle").filter({ hasText: "Nauvis" })
  const vulcanus = page.locator("#planet_selector .location-toggle").filter({ hasText: "Vulcanus" })
  await expect(nauvis).toHaveClass(/selected/)
  await vulcanus.click()
  await expect(vulcanus).toHaveClass(/selected/)
  await expect(nauvis).not.toHaveClass(/selected/)

  await page.getByRole("button", { name: "Settings" }).click()
  const preset = page.getByRole("combobox", { name: "Preset" })
  await expect(preset).toHaveValue("")
  await expect(preset.locator("option:checked")).toHaveText("Custom")
  for (const expected of [
    { value: "early", mining: "0", belt: "transport-belt", stack: "1", quality: "0" },
    { value: "pre-rocket", mining: "20.000", belt: "fast-transport-belt", stack: "1", quality: "2" },
    { value: "first-planets", mining: "30.000", belt: "express-transport-belt", stack: "1", quality: "2" },
  ]) {
    await preset.selectOption(expected.value)
    await expect(preset).toHaveValue(expected.value)
    await expect(page.locator("#mprod")).toHaveValue(expected.mining)
    await expect(page.locator(`#belt_selector input[value="${expected.belt}"]`)).toBeChecked()
    await expect(page.locator("#belt_stack_size")).toHaveValue(expected.stack)
    await expect(page.locator("#max_quality")).toHaveValue(expected.quality)
    await expect(vulcanus).toHaveClass(/selected/)
    await expect(nauvis).not.toHaveClass(/selected/)
  }

  await page.getByRole("combobox", { name: "Default machine quality" }).selectOption("rare")
  await page.getByRole("combobox", { name: "Default module quality" }).selectOption("rare")
  await page.getByRole("combobox", { name: "Default beacon quality" }).selectOption("rare")

  await preset.selectOption("late-space-age")
  await expect(preset).toHaveValue("late-space-age")
  await expect(page.locator("#mprod")).toHaveValue("100")
  await expect(page.locator('#belt_selector input[value="express-transport-belt"]')).toBeChecked()
  await expect(page.locator("#belt_stack_size")).toHaveValue("4")
  await expect(page.locator("#max_quality")).toHaveValue("4")
  await expect(page.getByRole("combobox", { name: "Default machine quality" })).toHaveValue("rare")
  await expect(page.getByRole("combobox", { name: "Default module quality" })).toHaveValue("rare")
  await expect(page.getByRole("combobox", { name: "Default beacon quality" })).toHaveValue("rare")
  await expect(page.locator("#targets > li.target").first().locator(".target-quality")).toHaveValue("0")
  await expect(vulcanus).toHaveClass(/selected/)

  await preset.selectOption("full-legendary")
  await expect(preset).toHaveValue("full-legendary")
  await expect(page.locator("#targets > li.target").first().locator(".target-quality")).toHaveValue("4")
  await expect(page.getByRole("combobox", { name: "Default machine quality" })).toHaveValue("legendary")
  await expect(page.getByRole("combobox", { name: "Default module quality" })).toHaveValue("legendary")
  await expect(page.getByRole("combobox", { name: "Default beacon quality" })).toHaveValue("legendary")
  await expect(page.getByRole("combobox", { name: "Quality factory quality module quality" })).toHaveValue("legendary")
  await expect(page.getByRole("combobox", { name: "Quality factory productivity module quality" })).toHaveValue(
    "legendary",
  )
  await expect(page.locator("#mprod")).toHaveValue("100")
  await expect(page.locator('#belt_selector input[value="express-transport-belt"]')).toBeChecked()
  await expect(page.locator("#belt_stack_size")).toHaveValue("4")
  await expect(vulcanus).toHaveClass(/selected/)
  await expect.poll(() => new URL(page.url()).hash).not.toBe("")

  await page.reload()
  await expect(vulcanus).toHaveClass(/selected/)
  await expect(page.locator("#targets > li.target").first().locator(".target-quality")).toHaveValue("4")
  await page.getByRole("button", { name: "Settings" }).click()
  await expect(page.getByRole("combobox", { name: "Default machine quality" })).toHaveValue("legendary")
  await expect(page.getByRole("combobox", { name: "Default module quality" })).toHaveValue("legendary")
  await expect(page.getByRole("combobox", { name: "Default beacon quality" })).toHaveValue("legendary")

  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("Full Legendary calculates the default Advanced circuit target on Nauvis", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await page.goto("/calc.html")

  const nauvis = page.locator("#planet_selector .location-toggle").filter({ hasText: "Nauvis" })
  await expect(nauvis).toHaveClass(/selected/)

  await page.getByRole("combobox", { name: "Preset" }).selectOption("full-legendary")

  await expect(page.locator("#targets > li.target").first().locator(".target-quality")).toHaveValue("4")
  await expect(page.locator("#calculation_error")).toBeHidden()
  await expect(page.locator("#factory_summary .quality-plan-title-main")).toHaveText("Legendary Advanced circuit")
  await expect(nauvis).toHaveClass(/selected/)
  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("Nauvis Legendary quality plans replace the ordinary table until a Normal target is added", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await page.goto("/calc.html")

  await page.getByRole("combobox", { name: "Preset" }).selectOption("late-space-age")
  const target = page.locator("#targets > li.target").first()
  await target.locator(".target-quality").selectOption("4")
  await target.locator(".target-rate").fill("60")
  await target.locator(".target-rate").press("Enter")

  await expect(page.locator("#calculation_error")).toBeHidden()
  const qualityPlan = page.locator("#factory_summary .quality-plan").first()
  await expect(qualityPlan.locator(".quality-plan-title-main")).toHaveText("Legendary Advanced circuit")
  const feed = qualityPlan.locator(":scope > .quality-plan-material")
  await expect(feed).not.toContainText("Copper cable")
  await expect(feed).not.toContainText("Plastic bar")
  await expect(feed).not.toContainText("Electronic circuit")
  for (const intermediate of ["Copper cable", "Plastic bar", "Electronic circuit"]) {
    await expect(qualityPlan.locator(".quality-plan-build-line", { hasText: intermediate }).first()).toBeAttached()
  }
  await expect(page.locator("table#totals")).toBeHidden()
  await expect(page.locator("table#totals thead")).toBeHidden()

  await page.getByRole("button", { name: "Add target" }).click()
  await expect(page.locator("#targets > li.target")).toHaveCount(2)
  await expect(page.locator("table#totals")).toBeVisible()
  await expect(page.locator("table#totals thead")).toBeVisible()
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
  expect(Math.abs(machines.x - belts.x)).toBeLessThan(2)
  expect(machines.y).toBeGreaterThan(quality.y)
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

test("Vulcanus quality results stay below the KPIs and reveal compact icon-based build stages", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto("/calc.html")

  await page.getByRole("button", { name: "Settings" }).click()
  await expect(page.getByRole("combobox", { name: "Quality factory quality module", exact: true })).toHaveValue(
    "quality-module-2",
  )
  await expect(page.getByRole("combobox", { name: "Quality factory quality module quality" })).toHaveValue("legendary")
  const productivityModule = page.getByRole("combobox", { name: "Quality factory productivity module", exact: true })
  const productivityModuleQuality = page.getByRole("combobox", {
    name: "Quality factory productivity module quality",
  })
  await expect(productivityModule).toHaveValue("productivity-module-3")
  await expect(productivityModuleQuality).toHaveValue("legendary")
  await productivityModule.selectOption("productivity-module-2")
  await productivityModuleQuality.selectOption("rare")
  await page.reload()
  await expect(page.getByRole("combobox", { name: "Quality factory productivity module", exact: true })).toHaveValue(
    "productivity-module-2",
  )
  await expect(page.getByRole("combobox", { name: "Quality factory productivity module quality" })).toHaveValue("rare")
  await page.getByRole("button", { name: "Factory" }).click()

  await page.locator("#planet_selector .location-toggle").filter({ hasText: "Vulcanus" }).click()
  const target = page.locator("#targets > li.target").first()
  await target.locator(".production-target-item .dropdownWrapper").click()
  await page.locator(".itemDropdown.open label").filter({ hasText: "Electronic circuit" }).first().click()
  await target.locator(".target-quality").selectOption("4")
  await target.locator(".target-rate").fill("1")
  await target.locator(".target-rate").press("Enter")
  await target.locator(".target-rate").blur()

  await expect(target.locator(".target-field-label:visible")).toHaveCount(0)
  const rateHeader = await page.locator(".production-target-header > span").nth(4).boundingBox()
  const rateInput = await target.locator(".target-rate").boundingBox()
  if (rateHeader === null || rateInput === null) throw new Error("Expected the desktop rate column to be visible")
  expect(Math.abs(rateInput.x + rateInput.width / 2 - (rateHeader.x + rateHeader.width / 2))).toBeLessThan(2)
  expect(rateInput.width).toBeLessThanOrEqual(rateHeader.width + 2)
  const summaryCards = page.locator("#factory_summary > .factory-summary-card")
  const qualityPlans = page.locator("#factory_summary > .quality-plan-list")
  await expect(qualityPlans).toBeVisible()
  const cardBottoms = await summaryCards.evaluateAll((cards) =>
    cards.map((card) => card.getBoundingClientRect().bottom),
  )
  const qualityPlanTop = await qualityPlans.evaluate((plan) => plan.getBoundingClientRect().top)
  expect(qualityPlanTop).toBeGreaterThanOrEqual(Math.max(...cardBottoms))

  const qualityCard = qualityPlans.locator(".quality-plan")
  await expect(qualityCard.locator(":scope > .quality-plan-metrics")).toHaveCount(0)
  await expect(qualityCard.locator("details.quality-plan-build-stage[open]")).toHaveCount(0)
  const qualityStage = qualityCard
    .locator("details.quality-plan-build-stage")
    .filter({ has: page.getByText("Quality production", { exact: true }) })
  const qualityStageSummary = qualityStage.locator("summary")
  await expect
    .poll(() => qualityStageSummary.evaluate((summary) => getComputedStyle(summary, "::before").content))
    .toBe('"▸"')
  await expect
    .poll(() =>
      qualityCard.locator(":scope > summary").evaluate((summary) => getComputedStyle(summary, "::before").content),
    )
    .toBe('"▾"')
  await qualityStageSummary.click()
  await expect(qualityStage).toHaveAttribute("open", "")
  await expect(
    qualityStage.locator('.quality-plan-equipment-icon[aria-label="Legendary Quality Module 2"]'),
  ).not.toHaveCount(0)
  await expect(qualityStage.locator('.equipment-quality-badge[data-quality="legendary"]').first()).toBeVisible()
  await expect(qualityStage.locator(".quality-plan-build-rate")).toHaveCount(0)

  const guaranteedStage = qualityCard
    .locator("details.quality-plan-build-stage")
    .filter({ has: page.getByText("Guaranteed-quality crafting", { exact: true }) })
  await guaranteedStage.locator("summary").click()
  await expect(
    guaranteedStage.locator('.quality-plan-equipment-icon[aria-label="Rare Productivity Module 2"]'),
  ).not.toHaveCount(0)
  await expect(guaranteedStage.locator('.equipment-quality-badge[data-quality="rare"]').first()).toBeVisible()
  await expect(guaranteedStage).not.toContainText("4 × Rare Productivity module 2")

  await qualityCard.locator("details.quality-plan-advanced > summary").click()
  const operationEquipment = qualityCard.locator(".quality-plan-operation-equipment")
  await expect(operationEquipment.first()).toBeVisible()
  await expect(operationEquipment.locator(".quality-plan-equipment-icon")).not.toHaveCount(0)
  await expect(operationEquipment.filter({ hasText: "Productivity module 2" })).toHaveCount(0)
  expect(browserErrors, "uncaught browser errors").toEqual([])
})
