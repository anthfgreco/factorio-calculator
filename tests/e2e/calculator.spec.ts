import { expect, test, type Page } from "@playwright/test"

function collectBrowserErrors(page: Page): string[] {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })
  return errors
}

async function openReadyCalculator(page: Page): Promise<void> {
  await page.goto("/calc.html")
  await expect(page.getByRole("region", { name: "Production targets" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Choose output for target 1: Advanced circuit" })).toBeVisible()
  await expect(page.getByRole("button", { name: "+ Add target" })).toBeEnabled()
}

test("loads, edits targets, and restores the URL-backed plan", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await openReadyCalculator(page)

  await expect(page.getByRole("region", { name: "Factory summary" })).toBeVisible()

  let output = page.getByRole("button", { name: "Choose output for target 1: Advanced circuit" })
  await output.click()
  let outputDialog = page.getByRole("dialog", { name: "Choose output for target 1" })
  await outputDialog.getByLabel("Search target outputs").fill("processing unit")
  await outputDialog.getByRole("button", { name: "Select Processing unit as output" }).click()
  output = page.getByRole("button", { name: "Choose output for target 1: Processing unit" })
  await expect(output).toBeVisible()
  await output.click()
  outputDialog = page.getByRole("dialog", { name: "Choose output for target 1" })
  await outputDialog.getByLabel("Search target outputs").fill("advanced circuit")
  await outputDialog.getByLabel("Search target outputs").press("Enter")
  await expect(page.getByRole("button", { name: "Choose output for target 1: Advanced circuit" })).toBeVisible()

  const rate = page.getByLabel("Rate for Advanced circuit")
  await rate.fill("120")
  await rate.press("Enter")
  await expect(rate).toHaveValue("120")
  await expect.poll(() => new URL(page.url()).hash).not.toBe("")

  await page.getByRole("button", { name: "+ Add target" }).click()
  await expect(page.locator("#targets > li")).toHaveCount(2)
  await page.getByRole("button", { name: "Remove Advanced circuit target" }).last().click()
  await expect(page.locator("#targets > li")).toHaveCount(1)

  await page.reload()
  await expect(page.getByRole("button", { name: "Choose output for target 1: Advanced circuit" })).toBeVisible()
  await expect(page.getByLabel("Rate for Advanced circuit")).toHaveValue("120")
  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("settings are native React controls and persist without DOM adapters", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await openReadyCalculator(page)

  await page.getByRole("radio", { name: "Relaxed" }).check()
  await expect(page.locator('[data-density="comfortable"]')).toBeVisible()

  await page.getByRole("button", { name: "Settings" }).click()
  await expect(page.getByText("Quality factory", { exact: true })).toBeVisible()
  await expect(page.getByLabel("Search recipes")).toBeVisible()
  await expect(page.getByText("Show unavailable recipes", { exact: true })).toBeVisible()
  await page.getByText("Recycling recipes", { exact: true }).click()
  await expect(page.getByRole("button", { name: "Disable all recycling recipes" })).toBeVisible()

  const title = page.getByLabel("Plan title")
  await title.fill("Circuit plan")
  await title.press("Enter")
  await expect(page).toHaveTitle("Circuit plan")

  await page.getByRole("radio", { name: "items/hour" }).check()
  await page.getByLabel("Search recipes").fill("recycling")
  await expect(page.getByText(/\d+ matching recipes?/)).toBeVisible()
  await expect.poll(() => new URL(page.url()).hash).not.toBe("")

  await page.reload()
  await expect(page).toHaveTitle("Circuit plan")
  await page.getByRole("button", { name: "Settings" }).click()
  await expect(page.getByRole("radio", { name: "items/hour" })).toBeChecked()
  await expect(page.locator('[data-density="comfortable"]')).toBeVisible()
  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("Visualize renders and updates a declarative React SVG", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await openReadyCalculator(page)

  await page.getByRole("button", { name: "Visualize" }).click()
  const graph = page.getByRole("img", { name: "Factory recipe flow graph" })
  await expect(graph).toBeVisible()
  await expect(graph.locator("path").first()).toBeAttached()
  await expect(graph.locator("g").first()).toBeAttached()
  await expect(graph.locator("image").first()).toHaveAttribute("href", /sprite-sheet-.+\.webp/)

  await page.getByRole("radio", { name: "Recipe graph" }).check()
  await page.getByRole("radio", { name: "Fit" }).check()
  await page.getByRole("radio", { name: "Top to bottom" }).check()
  await expect(page.getByRole("radio", { name: "Recipe graph" })).toBeChecked()
  await expect(page.getByRole("radio", { name: "Fit" })).toBeChecked()
  await expect(page.getByRole("radio", { name: "Top to bottom" })).toBeChecked()
  const graphHash = new URL(page.url()).hash
  expect(graphHash).not.toBe("")
  await page.reload()
  await expect(page.getByRole("img", { name: "Factory recipe flow graph" })).toBeVisible()
  await expect(page.getByRole("radio", { name: "Recipe graph" })).toBeChecked()
  await expect(page.getByRole("radio", { name: "Fit" })).toBeChecked()
  await expect(page.getByRole("radio", { name: "Top to bottom" })).toBeChecked()
  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("factory equipment, quality, beacons, and location are edited inline", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await openReadyCalculator(page)

  await expect(page.getByText("Equipment, modules, beacons, and location", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("dialog")).toHaveCount(0)

  await page.getByRole("button", { name: /^Space platform/ }).click({ modifiers: ["Shift"] })
  const location = page.getByLabel("Choose production location for Advanced circuit")
  await expect(location).toBeVisible()
  await location.selectOption("nauvis")

  const machine = page.getByRole("button", { name: "Choose a machine for Advanced circuit" })
  await machine.click()
  let machineDialog = page.getByRole("dialog", { name: "Machine and quality for Advanced circuit" })
  await machineDialog.getByRole("button", { name: "Rare quality", exact: true }).click()
  await machine.click()
  machineDialog = page.getByRole("dialog", { name: "Machine and quality for Advanced circuit" })
  await machineDialog.getByRole("button", { name: /^Assembling machine 3 —/ }).click()
  await expect(machine).toBeFocused()
  await expect(page.getByRole("dialog")).toHaveCount(0)

  const firstModule = page.getByRole("button", { name: /^Advanced circuit module 1/ })
  await firstModule.click()
  const moduleDialog = page.getByRole("dialog", { name: "Module 1 and quality for Advanced circuit" })
  await moduleDialog.getByRole("button", { name: "Rare quality", exact: true }).click()
  await expect(moduleDialog).toBeVisible()
  await moduleDialog
    .getByRole("button", {
      name: "Rare Speed module for Advanced circuit module 1 — changes matching slots",
      exact: true,
    })
    .click()
  await expect(firstModule).toBeFocused()
  await expect(page.getByRole("button", { name: /^Advanced circuit module 4/ })).toHaveAccessibleName(
    /Rare Speed module/,
  )

  await firstModule.hover()
  await page.keyboard.press("q")

  await expect(page.locator("#module_pipette_status")).toContainText("Pipette: Rare Speed module")
  const ghost = page.locator("#module_pipette_ghost")
  await expect(ghost).toBeVisible()
  await expect(ghost.locator('[role="img"]')).toHaveAttribute("aria-label", "Rare Speed module")

  const secondModule = page.getByRole("button", { name: /^Advanced circuit module 2/ })
  await secondModule.click()
  await expect(secondModule).toHaveAccessibleName(/Rare Speed module/)
  await expect(ghost).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(ghost).toHaveCount(0)

  const firstBeaconModule = page.getByRole("button", { name: /^Advanced circuit beacon module 1/ })
  await firstBeaconModule.click()
  const beaconModuleDialog = page.getByRole("dialog", {
    name: "Beacon module 1 and quality for Advanced circuit",
  })
  await beaconModuleDialog.getByRole("button", { name: "Epic quality", exact: true }).click()
  await expect(beaconModuleDialog).toBeVisible()
  await beaconModuleDialog
    .getByRole("button", { name: "Epic Speed module for Advanced circuit beacon module 1", exact: true })
    .click()
  await expect(firstBeaconModule).toBeFocused()
  await expect(page.getByRole("button", { name: /^Advanced circuit beacon module 2/ })).toHaveAccessibleName(
    /Epic Speed module/,
  )

  const beaconQuality = page.getByRole("button", { name: /beacon quality for Advanced circuit$/ })
  await beaconQuality.click()
  const beaconQualityDialog = page.getByRole("dialog", { name: "Beacon quality for Advanced circuit" })
  await beaconQualityDialog.getByRole("button", { name: "Rare quality", exact: true }).click()
  await expect(beaconQuality).toBeFocused()
  await expect(beaconQuality).toHaveAccessibleName("Rare beacon quality for Advanced circuit")

  const pipetteHash = new URL(page.url()).hash
  await page.reload()
  await expect.poll(() => new URL(page.url()).hash).toBe(pipetteHash)
  await expect(page.getByLabel("Choose production location for Advanced circuit")).toHaveValue("nauvis")
  await expect(page.getByRole("button", { name: /^Advanced circuit module 2/ })).toHaveAccessibleName(
    /Rare Speed module/,
  )
  await expect(page.getByRole("button", { name: /^Advanced circuit beacon module 2/ })).toHaveAccessibleName(
    /Epic Speed module/,
  )
  await machine.click()
  machineDialog = page.getByRole("dialog", { name: "Machine and quality for Advanced circuit" })
  await expect(machineDialog.getByRole("button", { name: "Rare quality", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await expect(page.locator("#module_pipette_ghost")).toHaveCount(0)

  await page.getByRole("button", { name: "Help" }).click()
  await expect(page.getByText(/Hover a module or module choice and press Q/)).toBeVisible()
  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("inline factory controls, resources, and help remain usable at a mobile viewport", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await openReadyCalculator(page)

  const output = page.getByRole("button", { name: "Choose output for target 1: Advanced circuit" })
  await output.click()
  const outputDialog = page.getByRole("dialog", { name: "Choose output for target 1" })
  await expect(outputDialog).toBeVisible()
  const outputDialogBox = await outputDialog.boundingBox()
  expect(outputDialogBox).not.toBeNull()
  expect(outputDialogBox?.x).toBeGreaterThanOrEqual(0)
  expect((outputDialogBox?.x ?? 0) + (outputDialogBox?.width ?? 0)).toBeLessThanOrEqual(390)
  await page.keyboard.press("Escape")
  await expect(output).toBeFocused()

  const factoryScroller = page.locator(".factory-table-scroll")
  await expect(factoryScroller).toBeVisible()
  await expect.poll(() => factoryScroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
  const machine = page.getByRole("button", { name: "Choose a machine for Advanced circuit" })
  await machine.scrollIntoViewIfNeeded()
  await expect(machine).toBeVisible()
  await machine.click()
  await page
    .getByRole("dialog", { name: "Machine and quality for Advanced circuit" })
    .getByRole("button", { name: /^Assembling machine 3 —/ })
    .click()
  await expect(page.getByRole("button", { name: /^Advanced circuit module 1/ })).toBeVisible()

  await page.getByRole("button", { name: "Resources" }).click()
  await expect(page.getByText(/Drag resources between tiers/)).toBeVisible()
  await expect(page.getByRole("button", { name: "Restore defaults" })).toBeVisible()

  await page.getByRole("button", { name: "Help" }).click()
  await expect(page.getByRole("heading", { name: "Using the calculator" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Useful controls" })).toBeVisible()
  await expect(page.getByText(/Share the current calculation/)).toBeVisible()
  expect(browserErrors, "uncaught browser errors").toEqual([])
})
