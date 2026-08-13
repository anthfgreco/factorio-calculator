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
            <li>Choose the output quality, target rate, and production planet.</li>
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
              ["Plan a quality factory", "Set the output quality and production planet"],
              ["Choose available quality gear", "Settings → Quality factory"],
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
              [
                "A quality plan cannot solve",
                "Selected planet, target recipe, recycler recipe, and available machines",
              ],
              ["A Vulcanus plan imports basic metal", "Selected planet and whether lava casting recipes are enabled"],
              ["Machine counts look higher than expected", "Recipe, modules, beacons, and machine quality"],
            ]}
          />
        </section>

        <details id="help-changelog" className="help-section help-changelog" open>
          <summary>Changelog</summary>
          <div className="changelog-timeline">
            <ChangelogEntry date="2026-08-13" title="Practical Quality Factories & Presets">
              <li>
                Added recursive exact quality factories for Nauvis intermediates and a curated Vulcanus route from lava
                and calcite through casting, crafting, and real recycling.
              </li>
              <li>
                Added Full Legendary as a separate quality-only preset; progression presets preserve locations and Late
                Space Age uses express belts.
              </li>
              <li>
                Results now lead with feed, machines, module loadouts, recycling, imports, and power; detailed quality
                math is collapsed, and quality-only plans omit the ordinary Factory table and header.
              </li>
              <li>
                Progression presets now set every productivity research value, with Late Space Age using +100% across
                mining and all eight recipe technologies; Recipe Settings no longer includes the broken jump links or
                Debug page.
              </li>
            </ChangelogEntry>

            <ChangelogEntry date="2026-08-12" title="Machine, Module & Beacon Quality Support">
              <li>Added quality controls for machines, modules, and beacons.</li>
              <li>
                Quality now changes machine speed, module effects, beacon transmission, mining drill drain, and rocket
                launch speed.
              </li>
              <li>Shared plan links now include quality defaults and recipe-specific choices.</li>
            </ChangelogEntry>

            <ChangelogEntry date="2026-08-10" title="Belt Production Targets & Stacking">
              <li>Plan production by belt throughput as well as machine count or item rate.</li>
              <li>Choose automatic or per-item belt stacking, including Big mining drill output.</li>
              <li>Press Enter on a displayed Machines, Rate, or Belts value to make it the active target.</li>
            </ChangelogEntry>

            <ChangelogEntry date="2026-08-06" title="Factorio 2.1.14">
              <li>Updated to Factorio 2.1.14, production values unchanged.</li>
            </ChangelogEntry>

            <ChangelogEntry date="2026-08-05" title="Factorio 2.1.13">
              <li>
                Updated Space Age recipes for Factorio 2.1.13, including faster recycling for recipes that produce
                multiple items.
              </li>
            </ChangelogEntry>

            <ChangelogEntry date="2026-08-03" title="Space Age Planning">
              <li>
                Added planning for Gleba agriculture and freshness, quality targets, production locations, and
                interplanetary transfers.
              </li>
              <li>
                Added planning for rocket launches, fluid and asteroid resources, stacked belts, storage, cargo wagons,
                beacon power, pollution, and Aquilo heat.
              </li>
              <li>
                Corrected rocket launch timing, Gleba spores, location warnings, and exact-quality totals, and removed
                unreliable estimates.
              </li>
            </ChangelogEntry>

            <ChangelogEntry date="2026-08-02" title="Machine Selection, Search & Productivity">
              <li>
                Choose a machine for each recipe or let the calculator select one automatically, with preferences
                preserved in shared plan links.
              </li>
              <li>Search with common Factorio shorthand for circuits, belts, robots, magazines, and more.</li>
              <li>Set each Space Age recipe productivity technology independently.</li>
              <li>Tooltips and recipe menus now stay visible near screen edges.</li>
            </ChangelogEntry>

            <ChangelogEntry date="2026-07-31" title="Factory Planning & Calculation Fixes">
              <li>
                Added factory summaries, progression presets, location controls, clearer errors, and share-link copying.
              </li>
              <li>
                Corrected production rates, machine speed limits, catalyst and coolant productivity, burner fuels, and
                recipes with multiple probabilities.
              </li>
              <li>Improved location and beacon-power warnings and kept settings in sync as plans change.</li>
              <li>Shared links now preserve recipe and module choices, including very large factories.</li>
            </ChangelogEntry>

            <ChangelogEntry date="2026-07-30" title="Factorio 2.1.12 & Space Age">
              <li>Added Factorio 2.1.12 and Space Age support and made it the default.</li>
              <li>
                Improved recipe search, aliases, location restrictions, asteroid resources, and per-row recipe
                selection.
              </li>
              <li>
                Improved Recipe Settings with search, crafting-category groups, unavailable-recipe filters, and
                recycling controls.
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
