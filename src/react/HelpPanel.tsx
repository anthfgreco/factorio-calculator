import type { ReactNode } from "react"

export function HelpPanel() {
  return (
    <div id="help_tab" className="tab">
      <div className="help-content">
        <section id="help-about" className="help-section">
          <header className="help-header">
            <h1>Help</h1>
            <div className="help-meta">
              <span>Factorio 2.1.14</span>
              <span className="meta-separator">•</span>
              <span>Space Age</span>
              <span className="meta-separator">•</span>
              <a href="https://github.com/anthfgreco/factorio-calculator" target="_blank" rel="noopener noreferrer">
                Source on GitHub
              </a>
            </div>
          </header>
        </section>

        <section id="help-using" className="help-section">
          <h2 className="help-section-title">Using the calculator</h2>
          <ol className="help-steps">
            <li>Add a production target.</li>
            <li>Enter a machine count, rate, or belt throughput.</li>
            <li>Select the locations available to your factory.</li>
            <li>
              Open <strong>Factory</strong> to choose recipes, machines, modules, and imported ingredients.
            </li>
            <li>
              Check <strong>Resources</strong> and <strong>Visualize</strong> for totals and bottlenecks.
            </li>
          </ol>
        </section>

        <section id="help-controls" className="help-section">
          <h2 className="help-section-title">Useful controls</h2>
          <HelpTable
            firstColumn="Action"
            secondColumn="Control"
            rows={[
              ["Combine production locations", "Shift-click location buttons"],
              ["Treat an ingredient as externally supplied", "Click its icon in the Factory table"],
              ["Restore an imported ingredient to the production chain", "Click the icon again"],
              ["Change a recipe for one item", "Use the recipe selector in its Factory row"],
              ["Change belt stacking for one item", "Use the stacking selector beside its belt count"],
              ["Change recipe defaults", "Open Settings"],
              ["Share the current calculation", "Copy plan link"],
            ]}
          />
        </section>

        <section id="help-troubleshooting" className="help-section">
          <h2 className="help-section-title">Something looks wrong?</h2>
          <HelpTable
            firstColumn="Problem"
            secondColumn="Check"
            rows={[
              ["An item cannot be produced", "Enabled recipes and selected locations"],
              ["An ingredient is missing from the chain", "Whether it is marked as imported"],
              ["The calculator chose an unexpected resource", "Resource priorities and alternate recipes"],
              ["Quality production is incomplete", "Recycling and quality progression limits"],
              ["Machine counts look higher than expected", "Recipe, modules, beacons, and machine quality"],
            ]}
          />
        </section>

        <details id="help-changelog" className="help-section help-changelog" open>
          <summary>Changelog</summary>
          <div className="changelog-timeline">
            <ChangelogEntry date="2026-08-10" title="Belt Targets & Stacking">
              <li>Added belt throughput as a production target.</li>
              <li>Added Auto stacking, direct big-drill detection, and per-item controls in Factory.</li>
              <li>Pressing Enter now makes a displayed Machines, Rate, or Belts value the active target.</li>
            </ChangelogEntry>

            <ChangelogEntry date="2026-08-06" title="Factorio 2.1.14">
              <li>Confirmed compatibility with Factorio 2.1.14; recipes and production values are unchanged.</li>
            </ChangelogEntry>

            <ChangelogEntry date="2026-08-05" title="Factorio 2.1.13">
              <li>
                Updated Space Age recipes for Factorio 2.1.13, including faster recycling for recipes that produce
                multiple items.
              </li>
            </ChangelogEntry>

            <ChangelogEntry date="2026-08-03" title="Advanced Space Age Planning & Correctness">
              <li>Replaced verbose planning narratives with compact KPIs and actionable diagnostics.</li>
              <li>Optimized exact rational arithmetic and added a repeatable solver benchmark.</li>
              <li>
                Added accurate Gleba crop growth, agricultural-tower sizing, seed returns, spoilage and freshness,
                agricultural science freshness, and spores.
              </li>
              <li>
                Added exact quality targets, quality progression limits, and reporting for output at other quality
                tiers.
              </li>
              <li>
                Added per-recipe planet and platform assignments, required material transfers, and per-location totals
                for machines, power, pollution, spores, and heat.
              </li>
              <li>
                Added fluid-resource yields, asteroid collection limits, belt stacking, storage buffers, cargo-wagon
                loads, beacon power, pollution, and Aquilo production heat.
              </li>
              <li>Moved fluid yields and asteroid collection limits into a compact Resource assumptions panel.</li>
              <li>
                Fixed incorrect location warnings for requested and imported items, and prevented Gleba crops from
                growing on Space platforms.
              </li>
              <li>
                Fixed exact-quality totals when a specific recipe is selected and clarified output produced at other
                quality tiers.
              </li>
              <li>
                Removed unreliable rocket-load and power-infrastructure estimates, and reduced factory-summary clutter.
              </li>
            </ChangelogEntry>

            <ChangelogEntry date="2026-08-02" title="Machine Selection, Search & Productivity">
              <li>
                Added exact machine selection directly to each recipe row, with an option to return to automatic
                selection.
              </li>
              <li>
                Made automatic machine preferences multi-selectable and preserved machine choices in shared plan links.
              </li>
              <li>Expanded item search with common chip, circuit, magazine, belt, robot, and factory shorthand.</li>
              <li>
                Added independent recipe-productivity research levels for all eight Space Age technologies, with
                official technology icons and support in shared plan links.
              </li>
              <li>Improved tooltip and recipe-menu visibility near screen edges.</li>
            </ChangelogEntry>

            <ChangelogEntry date="2026-07-31" title="Factory Planning & Calculation Fixes">
              <li>Added clearer factory summaries, calculation errors, location controls, and Help pages.</li>
              <li>
                Added top-level planet/location selector, factory summary cards, progression presets, direct item
                labels, and share-link copying.
              </li>
              <li>
                Corrected machine floor limits for negative speed multipliers, rate display calculations, beacon power
                warnings, and settings that could fall out of sync as plans changed.
              </li>
              <li>
                Corrected catalyst and coolant productivity, machine-specific burner fuel, and combined Factorio 2.1
                product probabilities.
              </li>
              <li>Made shared plans preserve module positions and recipe choices, including very large factories.</li>
            </ChangelogEntry>

            <ChangelogEntry date="2026-07-30" title="Factorio 2.1.12 and Space Age">
              <li>Added experimental Factorio 2.1.12 Space Age support and made it the default.</li>
              <li>
                Improved recipe search, aliases, location restrictions, asteroid resources, and row-level recipe
                selection.
              </li>
              <li>
                Reworked Recipe Settings with search, category groups, unavailable filters, and recycling controls.
              </li>
            </ChangelogEntry>
          </div>
        </details>
      </div>
    </div>
  )
}

interface HelpTableProps {
  firstColumn: string
  secondColumn: string
  rows: ReadonlyArray<readonly [string, string]>
}

function HelpTable({ firstColumn, secondColumn, rows }: HelpTableProps) {
  return (
    <table className="help-table">
      <thead>
        <tr>
          <th scope="col">{firstColumn}</th>
          <th scope="col">{secondColumn}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([first, second]) => (
          <tr key={first}>
            <td>{first}</td>
            <td>{second}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface ChangelogEntryProps {
  date: string
  title: string
  children: ReactNode
}

function ChangelogEntry({ date, title, children }: ChangelogEntryProps) {
  return (
    <article className="changelog-entry">
      <div className="changelog-meta">
        <time dateTime={date}>{date}</time>
      </div>
      <div className="changelog-details">
        <h3>{title}</h3>
        <ul>{children}</ul>
      </div>
    </article>
  )
}
