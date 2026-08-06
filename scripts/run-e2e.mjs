import { spawn } from "node:child_process"
import { access, mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

class DevToolsClient {
  static async connect(url) {
    const socket = new WebSocket(url)
    await new Promise((resolvePromise, reject) => {
      socket.addEventListener("open", resolvePromise, { once: true })
      socket.addEventListener("error", reject, { once: true })
    })
    return new DevToolsClient(socket)
  }

  constructor(socket) {
    this.socket = socket
    this.nextId = 1
    this.pending = new Map()
    this.listeners = new Map()
    socket.addEventListener("message", (event) => this.handleMessage(event.data))
    socket.addEventListener("close", () => {
      for (const { reject } of this.pending.values()) reject(new Error("Chromium DevTools connection closed."))
      this.pending.clear()
    })
  }

  send(method, params = {}) {
    const id = this.nextId++
    const request = JSON.stringify({ id, method, params })
    return new Promise((resolvePromise, reject) => {
      this.pending.set(id, { resolve: resolvePromise, reject })
      this.socket.send(request)
    })
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? new Set()
    listeners.add(listener)
    this.listeners.set(method, listeners)
  }

  close() {
    this.socket.close()
  }

  handleMessage(data) {
    const message = JSON.parse(String(data))
    if (typeof message.id === "number") {
      const pending = this.pending.get(message.id)
      if (pending === undefined) return
      this.pending.delete(message.id)
      if (message.error !== undefined) pending.reject(new Error(`${message.error.message} (${message.error.code})`))
      else pending.resolve(message.result ?? {})
      return
    }
    if (typeof message.method !== "string") return
    for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {})
  }
}

const root = resolve(import.meta.dirname, "..")
const chromiumCandidates = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean)
let chromium = null
for (const candidate of chromiumCandidates) {
  try {
    await access(candidate)
    chromium = candidate
    break
  } catch {}
}
if (chromium === null) {
  throw new Error("Chromium is required for test:e2e. Set CHROME_PATH to a Chrome or Chromium executable.")
}

const [vitePort, debugPort] = await Promise.all([getAvailablePort(), getAvailablePort()])
const viteBin = resolve(root, "node_modules/vite/bin/vite.js")
const server = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(vitePort), "--strictPort"], {
  cwd: root,
  stdio: ["ignore", "pipe", "pipe"],
})
let serverOutput = ""
server.stdout.on("data", (chunk) => {
  serverOutput += chunk
})
server.stderr.on("data", (chunk) => {
  serverOutput += chunk
})

const browserProfile = await mkdtemp(join(tmpdir(), "factorio-e2e-"))
const browser = spawn(
  chromium,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-extensions",
    "--no-first-run",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${browserProfile}`,
    "about:blank",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
)
let browserOutput = ""
browser.stdout.on("data", (chunk) => {
  browserOutput += chunk
})
browser.stderr.on("data", (chunk) => {
  browserOutput += chunk
})

let client = null
try {
  const applicationUrl = `http://127.0.0.1:${vitePort}/calc.html`
  await waitForUrl(applicationUrl, 15_000, () => `Vite did not become ready. Output:\n${serverOutput}`)
  await waitForUrl(
    `http://127.0.0.1:${debugPort}/json/version`,
    15_000,
    () => `Chromium DevTools did not become ready. Output:\n${browserOutput}`,
  )

  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(applicationUrl)}`, {
    method: "PUT",
  })
  if (!targetResponse.ok) throw new Error(`Unable to create Chromium test page: ${targetResponse.status}`)
  const target = await targetResponse.json()
  if (typeof target.webSocketDebuggerUrl !== "string") {
    throw new Error("Chromium did not provide a DevTools WebSocket URL.")
  }

  client = await DevToolsClient.connect(target.webSocketDebuggerUrl)
  await Promise.all([
    client.send("Page.enable"),
    client.send("Runtime.enable"),
    client.send("Network.enable"),
    client.send("Log.enable"),
  ])

  const browserErrors = []
  client.on("Runtime.exceptionThrown", (params) => {
    browserErrors.push(params.exceptionDetails?.text ?? "Uncaught browser exception")
  })
  client.on("Log.entryAdded", (params) => {
    if (params.entry?.level === "error") browserErrors.push(params.entry.text)
  })

  await waitForExpression(
    client,
    `document.querySelectorAll("#targets > li.target").length === 1 &&
      document.querySelector("#factory_summary")?.hidden === false &&
      document.querySelector("#calculation_error")?.hidden === true`,
    "default calculator workflow",
  )

  const initialDataset = await evaluateValue(client, `document.querySelector("#data_set")?.value`)
  assert(typeof initialDataset === "string" && initialDataset.length > 0, "The default dataset was not selected.")

  await evaluateValue(client, `document.querySelector(".add-target-button")?.click()`)
  await waitForExpression(
    client,
    `document.querySelectorAll("#targets > li.target").length === 2`,
    "adding a second production target",
  )

  await evaluateValue(client, `document.querySelector("#settings_button")?.click()`)
  await waitForExpression(
    client,
    `document.querySelector("#settings_button")?.classList.contains("active") === true`,
    "settings tab",
  )

  const titleInputFocused = await evaluateValue(
    client,
    `(() => {
      const input = document.querySelector("#title_setting")
      if (!(input instanceof HTMLInputElement)) return false
      input.focus()
      return document.activeElement === input
    })()`,
  )
  assert(titleInputFocused === true, "The title input could not be focused.")
  await client.send("Input.insertText", { text: "Codex regression plan" })
  await waitForExpression(
    client,
    `document.title === "Codex regression plan" &&
      document.querySelector("#title_setting")?.value === "Codex regression plan" &&
      location.hash.length > 1`,
    "title persistence",
  )
  const persistedHash = await evaluateValue(client, "location.hash")

  await client.send("Page.reload", { ignoreCache: true })
  await waitForExpression(
    client,
    `document.title === "Codex regression plan" &&
      document.querySelectorAll("#targets > li.target").length === 2 &&
      location.hash === ${JSON.stringify(persistedHash)}`,
    "URL state reload",
  )

  await evaluateValue(client, `document.querySelector("#settings_button")?.click()`)
  await waitForExpression(
    client,
    `document.querySelector("#settings_button")?.classList.contains("active") === true`,
    "settings tab after reload",
  )

  await evaluateValue(
    client,
    `(() => {
      const select = document.querySelector("#progression_preset")
      if (!(select instanceof HTMLSelectElement)) return false
      select.value = "first-planets"
      select.dispatchEvent(new Event("change", { bubbles: true }))
      return true
    })()`,
  )
  await waitForExpression(
    client,
    `document.querySelector("#mprod")?.value === "30" &&
      document.querySelector("#max_quality")?.value === "2"`,
    "Early Space Age progression preset",
  )

  await evaluateValue(client, `document.querySelector("#graph_button")?.click()`)
  await waitForExpression(
    client,
    `document.querySelector("#graph_button")?.classList.contains("active") === true &&
      (document.querySelector("#visualization_summary")?.textContent?.trim().length ?? 0) > 0`,
    "visualization rendering",
  )

  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  })
  const mobileControlsVisible = await evaluateValue(
    client,
    `(() => {
      const add = document.querySelector(".add-target-button")
      const tabs = document.querySelector(".tabs")
      if (!(add instanceof HTMLElement) || !(tabs instanceof HTMLElement)) return false
      const addRect = add.getBoundingClientRect()
      const tabRect = tabs.getBoundingClientRect()
      return addRect.width > 0 && addRect.height > 0 && tabRect.width > 0 && tabRect.height > 0
    })()`,
  )
  assert(mobileControlsVisible === true, "Primary calculator controls were not rendered at the mobile viewport.")

  if (browserErrors.length > 0) {
    throw new Error(`Browser reported errors:\n- ${browserErrors.join("\n- ")}`)
  }

  console.log(
    "Browser workflows passed: default calculation, target addition, URL reload, progression preset, graph rendering, and mobile controls.",
  )
} finally {
  client?.close()
  await Promise.all([stopProcess(browser), stopProcess(server)])
  await rm(browserProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  const exited = waitForProcessExit(child, 5_000)
  child.kill("SIGTERM")
  if (await exited) return

  child.kill("SIGKILL")
  await waitForProcessExit(child, 5_000)
}

function waitForProcessExit(child, timeout) {
  return new Promise((resolveExit) => {
    const timer = setTimeout(() => resolveExit(false), timeout)
    child.once("exit", () => {
      clearTimeout(timer)
      resolveExit(true)
    })
  })
}

async function getAvailablePort() {
  const server = createServer()
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolvePromise)
  })
  const address = server.address()
  if (address === null || typeof address === "string") {
    server.close()
    throw new Error("Unable to allocate a local test port.")
  }
  const { port } = address
  await new Promise((resolvePromise, reject) => server.close((error) => (error ? reject(error) : resolvePromise())))
  return port
}

async function waitForUrl(url, timeout, errorMessage) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {}
    await delay(100)
  }
  throw new Error(errorMessage())
}

async function waitForExpression(client, expression, label, timeout = 15_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if ((await evaluateValue(client, expression)) === true) return
    await delay(50)
  }
  const body = await evaluateValue(client, "document.body?.innerText.slice(0, 2000) ?? ''")
  throw new Error(`Timed out waiting for ${label}. Current page text:\n${body}`)
}

async function evaluateValue(client, expression) {
  const response = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  })
  if (response.exceptionDetails !== undefined) {
    throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text)
  }
  return response.result?.value
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))
}
