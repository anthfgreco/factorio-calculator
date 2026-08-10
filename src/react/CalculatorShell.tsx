import { Fragment, type ChangeEvent } from "react"

import { HelpPanel } from "./HelpPanel.js"
import { SettingsPanel } from "./SettingsPanel.js"
import { isProgressionPreset } from "../application/contracts.js"
import type { DisplayRate } from "../math.js"
import type { CalculatorCommands, CalculatorSnapshot } from "./types.js"

const DISPLAY_RATE_UNITS: Readonly<Record<DisplayRate, string>> = {
  s: "s",
  m: "min",
  h: "h",
}

interface CalculatorShellProps {
  commands: CalculatorCommands
  snapshot: CalculatorSnapshot
}

export function CalculatorShell({ commands, snapshot }: CalculatorShellProps) {
  return (
    <>
      <TargetsPanel commands={commands} snapshot={snapshot} />
      <PlannerToolbar commands={commands} snapshot={snapshot} />
      <TabBar commands={commands} snapshot={snapshot} />
      <VisualizationPanel commands={commands} snapshot={snapshot} />
      <FactoryPanel />
      <SettingsPanel commands={commands} snapshot={snapshot} />
      <ResourcesPanel />
      <HelpPanel />
      <DebugPanel commands={commands} snapshot={snapshot} />
      <footer id="footer">
        <a href="https://github.com/anthfgreco/factorio-calculator">Source on GitHub</a>
      </footer>
    </>
  )
}

function TargetsPanel({ commands, snapshot }: CalculatorShellProps) {
  return (
    <section className="targets-panel" aria-labelledby="targets_title">
      <div className="targets-heading">
        <span id="targets_title">Production targets</span>
        <span className="targets-hint">
          Choose an output, then set its quality, machine count, production rate, or belt throughput.
        </span>
      </div>
      <div className="production-target-header" aria-hidden="true">
        <span />
        <span>Output</span>
        <span>Quality</span>
        <span>Machines</span>
        <span>Rate/{DISPLAY_RATE_UNITS[snapshot.settings.displayRate]}</span>
        <span data-tooltip="Uses each item's belt stacking setting.">Belts</span>
      </div>
      <ul id="targets">
        <li id="plusButton">
          <button
            className="add-target-button ui"
            data-tooltip="Add another production target."
            type="button"
            disabled={snapshot.status !== "ready"}
            onClick={() => commands.addTarget()}
          >
            + Add target
          </button>
        </li>
      </ul>
    </section>
  )
}

function PlannerToolbar({ commands, snapshot }: CalculatorShellProps) {
  const showDebug =
    import.meta.env?.DEV === true ||
    (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug"))
  return (
    <div className="planner-toolbar">
      <div id="location_toolbar" className="location-toolbar" hidden>
        <span className="location-toolbar-label">Locations</span>
        <div className="location-toolbar-content">
          <div id="planet_selector" />
          <span className="location-toolbar-help">Shift-click to combine</span>
        </div>
      </div>
      <div className="progression-presets" role="group" aria-label="Progression preset">
        <label htmlFor="progression_preset">Preset</label>
        <select
          id="progression_preset"
          defaultValue=""
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            const value = event.currentTarget.value
            if (isProgressionPreset(value)) commands.applyProgressionPreset(value)
          }}
        >
          <option value="">Custom</option>
          <option value="early">Early game</option>
          <option value="pre-rocket">Pre-rocket</option>
          <option value="first-planets">Early Space Age</option>
          <option value="late-space-age">Late Space Age</option>
          <option value="megabase">Established megabase</option>
        </select>
      </div>
      <div className="planner-actions">
        <span id="share_status" role="status" aria-live="polite" />
        <button
          id="copy_share_link"
          className="ui planner-action"
          type="button"
          onClick={() => void commands.copyShareLink()}
        >
          Copy plan link
        </button>
        {showDebug ? (
          <button
            id="debug_button"
            className={`ui planner-action toolbar-tab-button ${snapshot.activeTab === "debug" ? "active" : ""}`}
            type="button"
            onClick={() => commands.selectTab("debug")}
          >
            Debug
          </button>
        ) : null}
      </div>
    </div>
  )
}

function TabBar({ commands, snapshot }: CalculatorShellProps) {
  return (
    <div className="tabs">
      <button
        className={`tab_button ${snapshot.activeTab === "totals" ? "active" : ""}`}
        id="totals_button"
        type="button"
        onClick={() => commands.selectTab("totals")}
      >
        Factory
      </button>
      <button
        className={`tab_button ${snapshot.activeTab === "graph" ? "active" : ""}`}
        id="graph_button"
        type="button"
        onClick={commands.openVisualization}
      >
        Visualize
      </button>
      <button
        className={`tab_button ${snapshot.activeTab === "resources" ? "active" : ""}`}
        id="resources_button"
        type="button"
        onClick={() => commands.selectTab("resources")}
      >
        Resources
      </button>
      <button
        className={`tab_button ${snapshot.activeTab === "settings" ? "active" : ""}`}
        id="settings_button"
        type="button"
        onClick={() => commands.selectTab("settings")}
      >
        Settings
      </button>
      <button
        className={`tab_button ${snapshot.activeTab === "help" ? "active" : ""}`}
        id="help_button"
        type="button"
        onClick={() => commands.selectTab("help")}
      >
        Help
      </button>
      <div id="factory_tab_tools" className="tab-tools">
        <div className="factory-density-control" role="group" aria-label="Factory row density">
          <span className="factory-density-label">Rows</span>
          <input
            id="factory_density_comfortable"
            type="radio"
            name="factory_density"
            value="comfortable"
            checked={snapshot.factoryDensity === "comfortable"}
            onChange={() => commands.setFactoryDensity("comfortable")}
          />
          <label htmlFor="factory_density_comfortable">Relaxed</label>
          <input
            id="factory_density_compact"
            type="radio"
            name="factory_density"
            value="compact"
            checked={snapshot.factoryDensity === "compact"}
            onChange={() => commands.setFactoryDensity("compact")}
          />
          <label htmlFor="factory_density_compact">Compact</label>
        </div>
      </div>
    </div>
  )
}

function VisualizationPanel({ commands, snapshot }: CalculatorShellProps) {
  return (
    <div id="graph_tab" className="tab graph">
      <div className="visualization-toolbar" aria-label="Visualization controls">
        <VisualizationRadioGroup
          id="graph_type"
          label="View"
          name="type"
          options={[
            { id: "sankey_type", value: "sankey", label: "Flow" },
            { id: "boxline_type", value: "boxline", label: "Recipe graph" },
          ]}
          value={snapshot.settings.visualizationType}
          onChange={commands.setVisualizationType}
        />
        <VisualizationRadioGroup
          id="graph_render"
          label="Viewport"
          name="render"
          options={[
            { id: "zoom_render", value: "zoom", label: "Zoom & pan" },
            { id: "fix_render", value: "fix", label: "Fit" },
          ]}
          value={snapshot.settings.visualizationRender}
          onChange={commands.setVisualizationRender}
        />
        <VisualizationRadioGroup
          id="graph_direction"
          label="Direction"
          name="direction"
          options={[
            { id: "right_direction", value: "right", label: "Left to right" },
            { id: "down_direction", value: "down", label: "Top to bottom" },
          ]}
          value={snapshot.settings.visualizationDirection}
          onChange={commands.setVisualizationDirection}
        />
        <div className="visualization-meta">
          <span id="visualization_summary" className="visualization-summary" />
          <span className="visualization-key">
            Width = rate; fluids use a 10:1 scale. Dashed = fuel. Hover = isolate.
          </span>
        </div>
      </div>
      <div id="graph_container">
        <svg id="graph">
          <g />
        </svg>
      </div>
    </div>
  )
}

interface VisualizationOption {
  id: string
  value: string
  label: string
}

interface VisualizationRadioGroupProps {
  id: string
  label: string
  name: string
  options: VisualizationOption[]
  value: string
  onChange: (value: string) => void
}

function VisualizationRadioGroup({ id, label, name, options, value, onChange }: VisualizationRadioGroupProps) {
  return (
    <div className="visualization-control">
      <span className="visualization-label">{label}</span>
      <form id={id} className="segmented-control">
        {options.map((option) => (
          <Fragment key={option.id}>
            <input
              id={option.id}
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              autoComplete="off"
              onChange={() => onChange(option.value)}
            />
            <label htmlFor={option.id}>{option.label}</label>
          </Fragment>
        ))}
      </form>
    </div>
  )
}

function FactoryPanel() {
  return (
    <div id="totals_tab" className="tab">
      <div id="calculation_error" className="calculation-error" role="alert" hidden>
        <div className="calculation-error-title" />
        <div className="calculation-error-message" />
        <div className="calculation-error-guidance" />
      </div>
      <div id="factory_summary" className="factory-summary" aria-live="polite" hidden />
      <div className="factory-table-scroll">
        <table id="totals">
          <thead>
            <tr />
          </thead>
          <tbody />
        </table>
      </div>
    </div>
  )
}

function ResourcesPanel() {
  return (
    <div id="resources_tab" className="tab">
      <p className="resources-intro">
        Drag resources between tiers to choose what your factory should conserve. Higher tiers are preferred.
      </p>
      <div id="resource_settings" />
    </div>
  )
}

function DebugPanel({ commands, snapshot }: CalculatorShellProps) {
  return (
    <div id="debug_tab" className="tab">
      <div id="debug_message" />
      <label htmlFor="render_debug">Render debug tab:</label>{" "}
      <input
        id="render_debug"
        type="checkbox"
        checked={snapshot.settings.debugEnabled}
        onChange={(event: ChangeEvent<HTMLInputElement>) => commands.setDebugEnabled(event.currentTarget.checked)}
      />
      <br />
      Last tableau:
      <div id="debug_tableau" />
      Last solution:
      <div id="debug_solution" />
    </div>
  )
}
