import type { ReactNode } from "react"

export function HelpPanel() {
  return (
    <div id="help_tab" className="tab">
      <div className="help-content">
        <section id="help-about" className="help-section">
          <header className="help-header">
            <h1>Factorio Calculator</h1>
            <div className="help-meta">
              <span>Factorio 2.1 &amp; Space Age</span>
              <span className="meta-separator">•</span>
              <span>Apache 2.0 Open Source</span>
              <span className="meta-separator">•</span>
              <a href="https://github.com/anthfgreco/factorio-calculator" target="_blank" rel="noopener noreferrer">
                GitHub Repository
              </a>
            </div>
          </header>
          <p className="help-summary">
            Plan Factorio production chains from early game through Space Age. Calculates exact machine counts, item
            rates, electrical power, burner fuel, and belt requirements for any recipe target.
          </p>
        </section>

        <section id="help-faq" className="help-section">
          <h2 className="help-section-title">Quick Reference &amp; Workflows</h2>
          <dl className="help-reference-list">
            <ReferenceRow term="Production Targets">
              Add one or more desired outputs at the top of the page. Choose an item, then enter either a machine count
              or a production rate.
            </ReferenceRow>
            <ReferenceRow term="Imported Ingredients">
              Click any item icon in the Factory table to mark it as imported. The calculator treats it as supplied from
              elsewhere; click again to include its production chain.
            </ReferenceRow>
            <ReferenceRow term="Progression Presets">
              Presets quickly set standard locations, modules, beacons, belts, and mining productivity for key game
              stages without altering your production targets.
            </ReferenceRow>
            <ReferenceRow term="Production Locations">
              Select a single planet/surface, or Shift-click to combine multiple locations into a shared material pool.
              Assign individual recipes in the Factory table; required transfers appear in the factory summary.
            </ReferenceRow>
            <ReferenceRow term="Quality & Recycling">
              Choose a quality tier beside an output to include its production chance. Recycler and upcycling loops must
              still be planned separately.
            </ReferenceRow>
            <ReferenceRow term="Factory Totals">
              Building counts show ceiling-rounded counts for physical placement. The summary separates electrical
              machine power from the required chemical fuel, nutrients, bioflux, or other burner consumables.
            </ReferenceRow>
            <ReferenceRow term="Alternate Recipes & Priorities">
              Override recipes per Factory row or globally in Settings. When multiple solution paths exist, the{" "}
              <strong>Resources</strong> priority hierarchy determines resource preference.
            </ReferenceRow>
            <ReferenceRow term="Calculation Help">
              If a factory cannot be calculated, check its enabled recipes, production locations, imported ingredients,
              and resource priorities.
            </ReferenceRow>
          </dl>
        </section>

        <section id="help-changelog" className="help-section">
          <h2 className="help-section-title">Changelog</h2>
          <div className="changelog-timeline">
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
        </section>
      </div>
    </div>
  )
}

interface ReferenceRowProps {
  term: string
  children: ReactNode
}

function ReferenceRow({ term, children }: ReferenceRowProps) {
  return (
    <div className="help-reference-row">
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
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
