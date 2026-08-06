import { Fragment } from "react"

import { HelpPanel } from "./HelpPanel.js"
import { SettingsPanel } from "./SettingsPanel.js"
import type { CalculatorActions } from "./types.js"
import { forwardNativeEvent } from "./types.js"

interface CalculatorShellProps {
  actions: CalculatorActions
}

export function CalculatorShell({ actions }: CalculatorShellProps) {
  return (
    <>
      <TargetsPanel actions={actions} />
      <PlannerToolbar actions={actions} />
      <TabBar actions={actions} />
      <VisualizationPanel actions={actions} />
      <FactoryPanel />
      <SettingsPanel actions={actions} />
      <ResourcesPanel />
      <HelpPanel />
      <DebugPanel actions={actions} />
      <footer id="footer">
        <a href="https://github.com/anthfgreco/factorio-calculator">Source on GitHub</a>
      </footer>
    </>
  )
}

function TargetsPanel({ actions }: CalculatorShellProps) {
  return (
    <section className="targets-panel" aria-labelledby="targets_title">
      <div className="targets-heading">
        <span id="targets_title">Production targets</span>
        <span className="targets-hint">Choose an output, then set its quality, machine count, or production rate.</span>
      </div>
      <div className="production-target-header" aria-hidden="true">
        <span />
        <span>Output</span>
        <span>Quality</span>
        <span>Machines</span>
        <span>Rate/min</span>
      </div>
      <ul id="targets">
        <li id="plusButton">
          <button
            className="add-target-button ui"
            data-tooltip="Add another production target."
            type="button"
            onClick={actions.addTarget}
          >
            + Add target
          </button>
        </li>
      </ul>
    </section>
  )
}

function PlannerToolbar({ actions }: CalculatorShellProps) {
  return (
    <div className="planner-toolbar">
      <div id="location_toolbar" className="location-toolbar" hidden>
        <span className="location-toolbar-label">Locations</span>
        <div id="planet_selector" />
        <span className="location-toolbar-help">Shift-click to combine</span>
      </div>
      <div className="progression-presets" role="group" aria-label="Progression preset">
        <label htmlFor="progression_preset">Preset</label>
        <select id="progression_preset" defaultValue="" onChange={forwardNativeEvent(actions.applyProgressionPreset)}>
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
        <button id="copy_share_link" className="ui planner-action" type="button" onClick={actions.copyShareLink}>
          Copy plan link
        </button>
        <button
          id="debug_button"
          className="ui planner-action toolbar-tab-button"
          type="button"
          onClick={() => actions.openTab("debug")}
        >
          Debug
        </button>
      </div>
    </div>
  )
}

function TabBar({ actions }: CalculatorShellProps) {
  return (
    <div className="tabs">
      <button className="tab_button" id="totals_button" type="button" onClick={() => actions.openTab("totals")}>
        Factory
      </button>
      <button className="tab_button" id="graph_button" type="button" onClick={actions.openVisualization}>
        Visualize
      </button>
      <button className="tab_button" id="resources_button" type="button" onClick={() => actions.openTab("resources")}>
        Resources
      </button>
      <button className="tab_button" id="settings_button" type="button" onClick={() => actions.openTab("settings")}>
        Settings
      </button>
      <button className="tab_button" id="help_button" type="button" onClick={() => actions.openTab("help")}>
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
            onChange={forwardNativeEvent(actions.changeFactoryDensity)}
          />
          <label htmlFor="factory_density_comfortable">Relaxed</label>
          <input
            id="factory_density_compact"
            type="radio"
            name="factory_density"
            value="compact"
            onChange={forwardNativeEvent(actions.changeFactoryDensity)}
          />
          <label htmlFor="factory_density_compact">Compact</label>
        </div>
      </div>
    </div>
  )
}

function VisualizationPanel({ actions }: CalculatorShellProps) {
  return (
    <div id="graph_tab" className="tab graph">
      <div className="visualization-toolbar" aria-label="Visualization controls">
        <VisualizationRadioGroup
          id="graph_type"
          label="View"
          name="type"
          options={[
            { id: "sankey_type", value: "sankey", label: "Flow", defaultChecked: true },
            { id: "boxline_type", value: "boxline", label: "Recipe graph" },
          ]}
          onChange={actions.changeVisualizationType}
        />
        <VisualizationRadioGroup
          id="graph_render"
          label="Viewport"
          name="render"
          options={[
            { id: "zoom_render", value: "zoom", label: "Zoom & pan", defaultChecked: true },
            { id: "fix_render", value: "fix", label: "Fit" },
          ]}
          onChange={actions.changeVisualizationRender}
        />
        <VisualizationRadioGroup
          id="graph_direction"
          label="Direction"
          name="direction"
          options={[
            { id: "right_direction", value: "right", label: "Left to right" },
            { id: "down_direction", value: "down", label: "Top to bottom" },
          ]}
          onChange={actions.changeVisualizationDirection}
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
  defaultChecked?: boolean
}

interface VisualizationRadioGroupProps {
  id: string
  label: string
  name: string
  options: VisualizationOption[]
  onChange: (event: Event) => void
}

function VisualizationRadioGroup({ id, label, name, options, onChange }: VisualizationRadioGroupProps) {
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
              defaultChecked={option.defaultChecked}
              autoComplete="off"
              onChange={forwardNativeEvent(onChange)}
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

function DebugPanel({ actions }: CalculatorShellProps) {
  return (
    <div id="debug_tab" className="tab">
      <div id="debug_message" />
      <label htmlFor="render_debug">Render debug tab:</label>{" "}
      <input id="render_debug" type="checkbox" onChange={forwardNativeEvent(actions.toggleDebug)} />
      <br />
      Last tableau:
      <div id="debug_tableau" />
      Last solution:
      <div id="debug_solution" />
    </div>
  )
}
