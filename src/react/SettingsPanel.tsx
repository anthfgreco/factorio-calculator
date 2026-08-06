import type { ChangeEvent } from "react"

import type { CalculatorCommands, CalculatorSnapshot } from "./types.js"

interface SettingsPanelProps {
  commands: CalculatorCommands
  snapshot: CalculatorSnapshot
}

export function SettingsPanel({ commands, snapshot }: SettingsPanelProps) {
  const onPlanningChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const input = event.currentTarget
    commands.setPlanningSetting({
      id: input.id,
      value: input.value,
      resourceKey: input.dataset.resourceKey,
      itemKey: input.dataset.itemKey,
    })
  }

  return (
    <div id="settings_tab" className="tab">
      <table id="settings">
        <colgroup>
          <col className="settings-label-column" />
          <col />
        </colgroup>
        <tbody>
          <tr id="settings_data" className="setting-section">
            <td colSpan={2}>
              <span>Data</span>
              <hr />
            </td>
          </tr>

          <tr className="setting-row">
            <td className="setting-label">Use recipe set</td>
            <td>
              <select id="data_set" aria-label="Recipe set" />
            </td>
          </tr>

          <tr id="settings_display" className="setting-section">
            <td colSpan={2}>
              <span>Display</span>
              <hr />
            </td>
          </tr>

          <tr className="setting-row">
            <td className="setting-label">Title</td>
            <td>
              <input
                id="title_setting"
                type="text"
                size={30}
                placeholder="Factorio Calculator"
                value={snapshot.title === "Factorio Calculator" ? "" : snapshot.title}
                onInput={(event: ChangeEvent<HTMLInputElement>) => commands.setTitle(event.currentTarget.value)}
              />
            </td>
          </tr>

          <tr className="setting-row">
            <td className="setting-label top">Display rates as</td>
            <td>
              <form id="display_rate" />
            </td>
          </tr>

          <tr className="setting-row compact-setting-row compact-setting-first">
            <td className="setting-label">Rate precision</td>
            <td>
              <input
                id="rprec"
                className="prec"
                type="number"
                value={snapshot.settings.ratePrecision}
                min="0"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  commands.setRatePrecision(event.currentTarget.valueAsNumber)
                }
              />
            </td>
          </tr>

          <tr className="setting-row compact-setting-row compact-setting-second">
            <td className="setting-label">Count precision</td>
            <td>
              <input
                id="cprec"
                className="prec"
                type="number"
                value={snapshot.settings.countPrecision}
                min="0"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  commands.setCountPrecision(event.currentTarget.valueAsNumber)
                }
              />
            </td>
          </tr>

          <tr className="setting-row">
            <td className="setting-label top">Format values as</td>
            <td>
              <form id="value_format">
                <input
                  id="decimal_format"
                  type="radio"
                  name="format"
                  value="decimal"
                  checked={snapshot.settings.displayFormat === "decimal"}
                  onChange={() => commands.setDisplayFormat("decimal")}
                />
                <label htmlFor="decimal_format">Decimals</label>
                <br />
                <input
                  id="rational_format"
                  type="radio"
                  name="format"
                  value="rational"
                  checked={snapshot.settings.displayFormat === "rational"}
                  onChange={() => commands.setDisplayFormat("rational")}
                />
                <label htmlFor="rational_format">Rationals</label>
                <br />
              </form>
            </td>
          </tr>

          <tr className="setting-row">
            <td className="setting-label">Color scheme</td>
            <td>
              <select id="color_scheme" aria-label="Color scheme" />
            </td>
          </tr>

          <tr id="settings_factory" className="setting-section">
            <td colSpan={2}>
              <span>Factory</span>
              <hr />
            </td>
          </tr>

          <tr className="setting-row">
            <td className="setting-label">Belt</td>
            <td>
              <span id="belt_selector" className="radio-setting" />
            </td>
          </tr>

          <tr className="setting-row">
            <td className="setting-label">Belt stacking</td>
            <td>
              <select id="belt_stack_size" value={snapshot.settings.beltStackSize} onChange={onPlanningChange}>
                <option value="1">1 item high</option>
                <option value="2">2 items high</option>
                <option value="3">3 items high</option>
                <option value="4">4 items high</option>
              </select>
            </td>
          </tr>

          <tr className="setting-row compact-setting-row compact-setting-first">
            <td className="setting-label">Logistics buffer</td>
            <td>
              <input
                id="buffer_minutes"
                type="number"
                min="0"
                step="0.5"
                value={snapshot.settings.bufferMinutes}
                size={5}
                onChange={onPlanningChange}
              />{" "}
              minutes
            </td>
          </tr>

          <tr className="setting-row compact-setting-row compact-setting-second">
            <td className="setting-label">Freshness delay</td>
            <td>
              <input
                id="freshness_delay"
                type="number"
                min="0"
                step="0.5"
                value={snapshot.settings.freshnessDelayMinutes}
                size={5}
                onChange={onPlanningChange}
              />{" "}
              minutes
            </td>
          </tr>

          <tr className="setting-row">
            <td className="setting-label">Quality progression</td>
            <td>
              <select id="max_quality" value={snapshot.settings.maxQualityLevel} onChange={onPlanningChange}>
                <option value="0">Normal only</option>
                <option value="2">Rare unlocked</option>
                <option value="3">Epic unlocked</option>
                <option value="4">Legendary unlocked</option>
              </select>
            </td>
          </tr>

          <tr className="setting-row planning-assumptions-row">
            <td className="setting-label top">Resource assumptions</td>
            <td>
              <details className="planning-details">
                <summary>Fluid yields and asteroid limits</summary>
                <div className="planning-details-body">
                  <section className="planning-group">
                    <h4>Fluid resource yields</h4>
                    <p>Adjust the output of each pumpjack resource relative to its nominal yield.</p>
                    <div className="planning-grid">
                      <ResourceYieldField label="Crude oil" resourceKey="crude-oil" onChange={onPlanningChange} />
                      <ResourceYieldField
                        label="Sulfuric geyser"
                        resourceKey="sulfuric-acid-geyser"
                        onChange={onPlanningChange}
                      />
                      <ResourceYieldField
                        label="Fluorine vent"
                        resourceKey="fluorine-vent"
                        onChange={onPlanningChange}
                      />
                      <ResourceYieldField
                        label="Lithium brine"
                        resourceKey="lithium-brine"
                        onChange={onPlanningChange}
                      />
                    </div>
                  </section>

                  <section className="planning-group">
                    <h4>Asteroid collection limits</h4>
                    <p>Leave a field blank for unlimited collection. Values use the selected display rate.</p>
                    <div className="planning-grid">
                      <AsteroidLimitField
                        id="asteroid_metallic"
                        label="Metallic"
                        itemKey="metallic-asteroid-chunk"
                        onChange={onPlanningChange}
                      />
                      <AsteroidLimitField
                        id="asteroid_carbonic"
                        label="Carbonic"
                        itemKey="carbonic-asteroid-chunk"
                        onChange={onPlanningChange}
                      />
                      <AsteroidLimitField
                        id="asteroid_oxide"
                        label="Oxide"
                        itemKey="oxide-asteroid-chunk"
                        onChange={onPlanningChange}
                      />
                      <AsteroidLimitField
                        id="asteroid_promethium"
                        label="Promethium"
                        itemKey="promethium-asteroid-chunk"
                        onChange={onPlanningChange}
                      />
                    </div>
                  </section>
                </div>
              </details>
            </td>
          </tr>

          <tr className="setting-row">
            <td className="setting-label">Preferred fuel</td>
            <td>
              <span id="fuel_selector" className="radio-setting" />
            </td>
          </tr>

          <tr className="setting-row">
            <td className="setting-label">Default module (all eligible slots)</td>
            <td>
              <span id="default_module" />
            </td>
          </tr>

          <tr className="setting-row">
            <td className="setting-label">Secondary default module</td>
            <td>
              <span id="secondary_module" />
            </td>
          </tr>

          <tr className="setting-row">
            <td className="setting-label">Default beacon</td>
            <td>
              <div id="default_beacon_setting" className="default-beacon-setting">
                <span className="beacon-controls">
                  <span id="default_beacon" className="beacon-container" />
                  <span aria-hidden="true"> &times; </span>
                  <input id="default_beacon_count" type="text" size={3} aria-label="Default beacon count" />
                </span>
              </div>
            </td>
          </tr>

          <tr className="setting-row">
            <td className="setting-label top-icon">
              <div>
                <span>Machines</span>
              </div>
            </td>
            <td>
              <span id="building_selector" />
              <div className="setting-help">
                Select one or more preferred machines. Automatic uses the fastest compatible selection; click a
                Factory-row machine for an exact override.
              </div>
            </td>
          </tr>

          <tr id="settings_research" className="setting-section">
            <td colSpan={2}>
              <span>Research</span>
              <hr />
            </td>
          </tr>

          <tr id="recipe_productivity_row" className="setting-row">
            <td className="setting-label top">Productivity</td>
            <td>
              <div id="recipe_productivity_settings">
                <label className="recipe-productivity-setting mining-productivity-setting">
                  <span className="recipe-productivity-icon mining-productivity-icon" aria-hidden="true" />
                  <span>Mining productivity</span>
                  <span className="recipe-productivity-percentage">
                    <input
                      id="mprod"
                      className="mprod"
                      type="number"
                      step="10"
                      value={snapshot.settings.miningProductivityPercent}
                      min="0"
                      aria-label="Mining productivity bonus percentage"
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        commands.setMiningProductivityPercent(event.currentTarget.value)
                      }
                    />
                    <span aria-hidden="true">%</span>
                  </span>
                </label>
              </div>
              <div className="setting-help">
                Enter the bonus percentages shown in-game. Recipe productivity is capped at +300% total; mining
                productivity is uncapped.
              </div>
            </td>
          </tr>

          <tr id="settings_recipes" className="setting-section recipe-setting-section">
            <td colSpan={2}>
              <span>Recipes</span>
              <hr />
            </td>
          </tr>

          <tr className="setting-row">
            <td className="setting-label top">Recipes</td>
            <td>
              <div id="recipe_toggles" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

interface ResourceYieldFieldProps {
  label: string
  resourceKey: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

function ResourceYieldField({ label, resourceKey, onChange }: ResourceYieldFieldProps) {
  return (
    <label className="planning-field">
      <span>{label}</span>
      <span className="planning-control">
        <input data-resource-key={resourceKey} type="number" min="1" step="10" defaultValue="100" onChange={onChange} />
        <span>%</span>
      </span>
    </label>
  )
}

interface AsteroidLimitFieldProps {
  id: string
  label: string
  itemKey: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

function AsteroidLimitField({ id, label, itemKey, onChange }: AsteroidLimitFieldProps) {
  return (
    <label className="planning-field">
      <span>{label}</span>
      <input id={id} data-item-key={itemKey} type="number" min="0" placeholder="Unlimited" onChange={onChange} />
    </label>
  )
}
