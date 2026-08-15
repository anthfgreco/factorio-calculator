import * as d3sankey from "./vendor-sankey.js"
import {
  color,
  create,
  curveBasis,
  line,
  local,
  select,
  selectAll,
  style,
  type BaseType,
  type Selection,
  type ValueFn,
} from "d3"
import { deflateRaw, inflateRaw } from "pako"
import {
  Fragment,
  useLayoutEffect,
  useSyncExternalStore,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react"
import { createRoot } from "react-dom/client"
import tippy, { delegate, hideAll, type DelegateInstance, type Instance, type Props } from "tippy.js"

declare global {
  const spec: FactorySpecification

  interface Window {
    spec: FactorySpecification
  }
}

const CALCULATOR_CSS = String.raw`.dropdownWrapper{display:inline-block;}
.tippy-dropdown-menu{border:2px solid var(--light);border-radius:5px;background-color:var(--dark);overflow:hidden;display:inline-block;vertical-align:middle;cursor:pointer;}
.tippy-dropdown-menu.open{border-color:var(--accent);padding:0.4em;height:auto;width:auto;max-width:calc(100vw - 1rem);max-height:calc(100vh - 1rem);overflow:auto;cursor:default;}
.tippy-dropdown-menu:hover{border-color:var(--accent);}
.dropdownWrapper .spacer{display:none;}
.dropdownWrapper.open .spacer{border:2px solid transparent;margin:2px;display:inline-block;vertical-align:middle;}
.tippy-dropdown-menu br,.tippy-dropdown-menu hr{display:none;}
.tippy-dropdown-menu.open br{display:inline;}
.tippy-dropdown-menu.open hr{display:block;border-color:var(--accent);border-style:solid;}
.tippy-dropdown-menu input[type="radio"]{display:none;}
.tippy-dropdown-menu input[type="radio"] + label{border-radius:5px;display:none;margin:2px;}
.tippy-dropdown-menu.open input[type="radio"] + label{display:inline-block;}
.tippy-dropdown-menu input[type="radio"] + label:hover{background-color:var(--light);}
.tippy-dropdown-menu input[type="radio"]:checked + label{display:inline-block;pointer-events:none;}
.tippy-dropdown-menu.open input[type="radio"]:checked + label{background-color:var(--light);pointer-events:auto;}
.tippy-box[data-theme~="factorio-dropdown"]{color:inherit;background:transparent;}
.tippy-box[data-theme~="factorio-dropdown"]>.tippy-content{padding:0;}:root{--dark:#171717;--medium:#212427;--main:#272b30;--light:#3a3f44;--foreground:#c8c8c8;--accent:#ff7200;--bright:#f1fff2;}
body{font-family:sans-serif;color:var(--foreground);background-color:var(--dark);}
a{text-decoration:none;color:var(--accent);}
a:active,a:hover{color:var(--bright);}
input,select{color:var(--foreground);background-color:var(--light);padding:0.25em;border:1px solid var(--light);border-radius:0.4em;}
input:focus,select:focus{border-color:var(--accent);outline:none;}
.right-align{text-align:right;}
button.ui{color:var(--accent);background:linear-gradient(to bottom,var(--light),var(--medium));border:2px outset var(--light);border-radius:0.4em;}
button.ui:active{border-style:inset;}
button.ui:focus{border-color:var(--accent);outline:none;}
img.icon{display:inline-block;vertical-align:middle;}
.ignore{opacity:0.3;}
.tippy-box[data-theme~="factorio"]{color:var(--foreground);border:1px solid var(--bright);border-radius:4px;background-color:var(--dark);box-shadow:0 0.65rem 1.5rem rgba(0,0,0,0.55);font-size:0.9rem;}
.tippy-box[data-theme~="factorio"]>.tippy-content{padding:0.45em 0.6em;text-align:left;white-space:pre-line;}
.tippy-box[data-theme~="factorio"] .frame{text-align:left;}
.tippy-box[data-theme~="factorio"] h3{margin:0;}
.tippy-box[data-theme~="factorio"] h3:not(:last-child){margin-bottom:0.5em;}
.tippy-box[data-theme~="factorio"] div.product{position:relative;display:inline-block;background-color:var(--light);margin-top:5px;}
.tippy-box[data-theme~="factorio"] div.product span.count{position:absolute;right:1px;bottom:1px;font-size:12px;font-family:monospace;color:var(--bright);text-shadow:-1px -1px 0px var(--dark),-1px 1px 0px var(--dark),1px -1px 0px var(--dark),1px 1px 0px var(--dark);}
.tippy-box[data-theme~="factorio"] img.ingredient{background-color:var(--light);}
.tippy-box[data-theme~="factorio-menu"]{color:var(--foreground);border:0;background:transparent;box-shadow:none;}
.tippy-box[data-theme~="factorio-menu"]>.tippy-content{padding:0;}
.targetButton{height:2em;width:2em;padding:0;text-align:center;font-weight:bold;font-family:sans-serif;margin-right:0.5em;}
ul#targets{list-style-type:none;margin-top:0;}
ul#targets li{margin:0.25em;border-radius:0.5em;}
label.selected{font-weight:bold;color:var(--bright);}
.location-warning{max-width:46em;margin:0.5em 0 0.25em 2.5em;padding:0.5em 0.75em;border-left:3px solid var(--accent);background-color:var(--medium);}
.location-warning-title{color:var(--bright);font-weight:bold;}
.location-warning-message{margin-top:0.2em;}
.location-warning button{margin-top:0.5em;}
table#settings{border-collapse:collapse;}
tr.setting-section td{padding-top:1em;padding-bottom:0.5em;}
tr.setting-section td span{color:var(--accent);font-style:italic;}
tr.setting-section td hr{display:block;border:1px solid var(--accent);}
tr.setting-row td:first-child{padding-left:3em;}
td.setting-label{text-align:right;}
div#miner_settings,div#alt_recipe_settings{padding-left:3em;}
.top,.top-icon{vertical-align:top;}
.top-icon>div{height:40px;line-height:40px;}
input.prec,input.mprod{width:4em;}
#recipe_productivity_settings{display:grid;gap:0.25em;max-width:34em;}
.recipe-productivity-setting{display:grid;grid-template-columns:24px minmax(15em,1fr) auto;align-items:center;gap:0.5em;}
.recipe-productivity-icon{display:flex;}
.recipe-productivity-percentage{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;width:4.5em;color:var(--foreground);background:var(--medium);border:1px solid var(--rule);border-radius:3px;}
.recipe-productivity-percentage:focus-within{outline:2px solid var(--accent);outline-offset:2px;}
.recipe-productivity-percentage input{min-width:0;width:100%;padding-right:0;background:transparent;border:0;appearance:textfield;}
.recipe-productivity-percentage input:focus-visible{outline:none;}
.recipe-productivity-percentage input::-webkit-inner-spin-button,.recipe-productivity-percentage input::-webkit-outer-spin-button{margin:0;appearance:none;}
.recipe-productivity-percentage>span{padding:0 0.3em 0 0.1em;pointer-events:none;}
.radio-setting input[type="radio"],.machine-setting input[type="checkbox"]{display:none;}
.radio-setting input[type="radio"] + label,.machine-setting input[type="checkbox"] + label{cursor:pointer;background:var(--light);border-radius:4px;display:inline-block;margin:2px;padding:2px;}
.radio-setting input[type="radio"] + label:hover,.machine-setting input[type="checkbox"] + label:hover{background:var(--bright);}
.radio-setting input[type="radio"]:checked + label,.machine-setting input[type="checkbox"]:checked + label{background:var(--accent);}
.toggle-list .toggle{cursor:pointer;display:inline-block;border-radius:4px;border:2px solid var(--light);margin:2px;padding:2px;background-color:var(--dark);}
.toggle-list .toggle:hover{border-color:var(--bright);}
.toggle-list .selected{border-color:var(--accent);}
.toggle-list .selected:hover{}
#resource_settings{border:2px solid var(--light);border-radius:5px;background-color:var(--dark);}
#resource_settings .resource-tier{border:1px solid transparent;}
#resource_settings .resource-tier.highlight{border-color:var(--accent);}
#resource_settings .bookend{background-color:var(--light);}
#resource_settings .bookend.highlight{background-color:var(--accent);}
#resource_settings .bookend *{pointer-events:none;}
#resource_settings .middle{height:10px;background-color:var(--light);}
#resource_settings .middle.highlight{background-color:var(--accent);}
#resource_settings .resource{display:inline-block;margin:3px;}
#resource_settings img.icon{display:block;}
#resource_settings.dragging .resource-tier>*{pointer-events:none;}
table.resource{border-collapse:collapse;}
table.resource td{text-align:right;}
table.resource input[type="radio"]{display:none;}
table.resource input[type="radio"] + label{cursor:pointer;fill:var(--light);}
table.resource input[type="radio"] + label:hover{fill:var(--bright);}
table.resource input[type="radio"]:checked + label{fill:var(--accent);}
.planner-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:0.55em;margin:0.35em 0;}
.location-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:0.4em;padding:0.25em 0.45em;border:1px solid var(--light);border-radius:0.3em;background:var(--main);}
.location-toolbar[hidden]{display:none;}
.location-toolbar-label{color:var(--bright);font-size:0.9em;font-weight:bold;}
.location-toolbar-help{color:var(--foreground);font-size:0.75em;white-space:nowrap;}
#planet_selector{display:flex;flex-wrap:wrap;}
#planet_selector .location-toggle{display:inline-flex;align-items:center;gap:0.2em;margin:1px;padding:1px 3px;border-width:1px;color:var(--foreground);font:inherit;font-size:0.9em;}
#planet_selector .location-toggle.selected{color:var(--bright);}
#planet_selector .location-name{padding-right:0.2em;}
.planner-actions{display:flex;flex-wrap:wrap;align-items:center;gap:0.45em;margin-left:auto;}
.planner-action{cursor:pointer;padding:0.35em 0.7em;}
.planner-action.active{color:var(--bright);border-color:var(--accent);}
div.tabs{overflow:hidden;}
div.tabs button.tab_button{color:var(--accent);background-color:inherit;border-top-left-radius:0.25em;border-top-right-radius:0.25em;float:left;border:none;outline:none;cursor:pointer;padding:0.5em;}
div.tabs button.tab_button:hover{background-color:var(--medium);}
div.tabs button.active,div.tabs button.active:hover{color:var(--bright);background-color:var(--main);}
div.tab{display:none;padding:0.5em;background-color:var(--main);}
#share_status{color:var(--bright);font-size:0.9em;}
.factory-summary{display:flex;flex-wrap:wrap;gap:0.6em;margin-bottom:0.75em;}
.factory-summary[hidden]{display:none;}
.factory-summary-card{min-width:9em;padding:0.55em 0.7em;border:1px solid var(--light);border-radius:0.35em;background:var(--medium);}
.factory-summary-value{color:var(--bright);font-family:monospace;font-size:1.05em;}
.factory-summary-label{margin-top:0.15em;font-size:0.8em;}
.factory-summary-warning{flex-basis:100%;padding:0.55em 0.7em;border-left:3px solid var(--accent);background:var(--medium);line-height:1.35;}
.calculation-error{max-width:52em;margin-bottom:0.75em;padding:0.8em 1em;border:1px solid var(--accent);border-left-width:4px;border-radius:0.35em;background:var(--medium);}
.calculation-error-title{color:var(--bright);font-weight:bold;}
.calculation-error-message{margin-top:0.35em;font-family:monospace;}
.calculation-error-guidance{margin-top:0.55em;line-height:1.35;}
.factory-table-scroll{overflow-x:auto;}
td.location-cell{max-width:11em;padding-right:0.75em;padding-left:0.75em;color:var(--bright);font-size:0.85em;white-space:nowrap;}
td.location-cell.hide{display:none;}
.factory-density-control{display:inline-flex;align-items:center;margin:0;padding:0;border:0;}
.factory-density-label{margin-right:0.5em;color:var(--foreground);font-size:0.8em;}
.factory-density-control input{position:absolute;opacity:0;pointer-events:none;}
.factory-density-control label{cursor:pointer;padding:0.3em 0.55em;border:1px solid var(--light);background:var(--medium);font-size:0.8em;}
.factory-density-control label:first-of-type{border-radius:0.35em 0 0 0.35em;}
.factory-density-control label:last-of-type{border-left:0;border-radius:0 0.35em 0.35em 0;}
.factory-density-control input:focus + label{outline:1px solid var(--accent);outline-offset:1px;}
.factory-density-control input:checked + label{color:var(--bright);border-color:var(--accent);background:var(--light);}
html[data-factory-density="compact"] #totals tr.display-row td,html[data-factory-density="compact"] #totals tr.factory-header th,html[data-factory-density="compact"] #totals tr.breakdown-row td{padding-top:2px;padding-bottom:2px;}
html[data-factory-density="compact"] #totals tr.display-row td.pad,html[data-factory-density="compact"] #totals th.pad{padding-left:0.4em;}
html[data-factory-density="compact"] #totals .pad-right{padding-right:0.4em;}
html[data-factory-density="compact"] #totals td.location-cell{padding-right:0.4em;padding-left:0.4em;}
html[data-factory-density="compact"] #totals span.beacon-container{padding:0.2em;}
html[data-factory-density="compact"] #totals details.recipe-selector{margin-right:0.1em;}
div.graph{}
div.graph_setting{display:inline-block;vertical-align:middle;margin-left:1em;margin-right:1em;}
#graph_type input[type="radio"]{display:none;}
#graph_type input[type="radio"] + label:hover{color:var(--bright);}
#graph_type input[type="radio"]:checked + label{color:var(--accent);}
#graph_type input[type="radio"]:checked + label:hover{color:var(--accent);}
g.node rect{stroke-width:1px;}
g.overlay{cursor:pointer;}
g.node .colon{stroke:none;fill:var(--foreground);}
rect.nodeHighlight{stroke:var(--accent);}
g.edgePathHighlight .highlighter{stroke:var(--accent);}
svg.sankey g.edgePathHighlight .highlighter{stroke-opacity:0.7;}
g.edgePathHighlight rect.highlighter{fill-opacity:1;}
g.fuel path,path.fuel{stroke-dasharray:10,5;}
svg#graph{display:block;}
svg#graph text,svg.test text{stroke:none;fill:var(--foreground);}
#totals{border-collapse:collapse;}
#totals.nosurplus .surplus{display:none;}
.pad-right{padding-right:1em;}
tr.display-row td.pad,th.pad{padding-left:1em;}
tr.display-row .item-icon img{cursor:pointer;}
tr.display-row td,tr.factory-header th,tr.breakdown-row td{padding-top:8px;padding-bottom:8px;}
tbody.display-group>tr:first-child td{border-top:1px solid var(--light);}
tbody.display-group.multi td.leftmost{border-left:1px solid var(--light);}
tr.nobuilding td.building>*:not(.recipe-selector){display:none;}
tr.nomodule td.module>*{display:none;}
tr.noitem td.item>*{display:none;}
td.belt-count-cell.hide{display:none;}
span.beacon-container{background-color:var(--light);padding:0.5em;}
svg.popout{color:var(--accent);width:16;height:16;}
details.recipe-selector{display:inline-block;position:relative;margin-right:0.25em;vertical-align:middle;text-align:left;}
details.recipe-selector>summary{display:inline-block;cursor:pointer;list-style:none;border:2px solid transparent;border-radius:4px;}
details.recipe-selector>summary::-webkit-details-marker{display:none;}
details.recipe-selector>summary:hover,details.recipe-selector[open]>summary{border-color:var(--accent);}
.recipe-selector-menu{min-width:18em;max-width:28em;max-height:22em;overflow-y:auto;padding:0.5em;border:2px solid var(--accent);border-radius:5px;background:var(--dark);box-shadow:0 0.25em 0.75em rgba(0,0,0,0.45);}
.recipe-selector-title{margin-bottom:0.35em;color:var(--bright);font-weight:bold;}
.recipe-selector-group + .recipe-selector-group{margin-top:0.5em;padding-top:0.5em;border-top:1px solid var(--light);}
.recipe-selector-group-title{margin:0.1em 0 0.25em 0.3em;color:var(--accent);font-size:0.85em;font-weight:bold;}
.recipe-selector-option{display:flex;align-items:center;gap:0.4em;padding:0.2em 0.3em;border-radius:4px;cursor:pointer;white-space:nowrap;}
.recipe-selector-option:hover{background:var(--light);}
.recipe-selector-option.active{color:var(--bright);}
.recipe-selector-option input{flex:0 0 auto;accent-color:var(--accent);}
.recipe-selector-option span{overflow:hidden;text-overflow:ellipsis;}
.breakdown-open .breakdown-arrow{transform:rotate(90deg);}
.breakdown-arrow{color:var(--foreground);cursor:pointer;transition:transform 0.25s;}
.breakdown-arrow:hover{color:var(--accent);}
.breakdown{display:none;height:0;}
.breakdown.breakdown-open{display:table-row;height:auto;transition:height 0.25s;}
.breakdown table{border-collapse:collapse;border-left:solid 0.5em var(--medium);border-right:solid 0.5em var(--medium);background:var(--medium);border-radius:0.25em;}
.usage-arrow{vertical-align:middle;rotate:180deg;}
.breakdown-first-output td{border-top:1px solid var(--light);}
.tippy-dropdown-menu .search{display:none;width:100%;padding-left:0.4em;margin-bottom:0.4em;}
.tippy-dropdown-menu.open .search{display:block;}
.tippy-dropdown-menu.open.itemDropdown{height:400px;width:380px;overflow-y:scroll;transition:height 0.3s;}
.help-content{max-width:72em;margin:0 auto;padding:1em 1em 3em;}
.help-section + .help-section{margin-top:2.2em;}
.help-section h2{margin:0 0 0.65em;color:var(--bright);}
.help-header h1{margin:0 0 0.2em;font-size:1.35em;}
.help-meta{display:flex;flex-wrap:wrap;align-items:center;gap:0.5em;font-size:0.85em;color:var(--muted);margin-bottom:0.85em;}
.meta-separator{opacity:0.5;}
.help-section-title{font-size:0.88em;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--bright);padding-bottom:0.4em;border-bottom:1px solid var(--rule);margin-bottom:1em;}
.help-steps{margin:0;padding-left:1.5em;line-height:1.65;}
.help-table{width:100%;border-collapse:collapse;font-size:0.9em;}
.help-table th,.help-table td{padding:0.5em 0.75em;text-align:left;vertical-align:top;border-bottom:1px solid rgba(255,255,255,0.05);}
.help-table th{color:var(--bright);font-weight:600;}
.help-table th:first-child,.help-table td:first-child{width:48%;}
.help-changelog>summary{color:var(--bright);font-weight:600;cursor:pointer;}
.help-changelog[open]>summary{margin-bottom:1em;}
.changelog-timeline{display:flex;flex-direction:column;gap:1.25em;}
.changelog-entry{display:grid;grid-template-columns:8em 1fr;column-gap:1.5em;padding-bottom:1.25em;border-bottom:1px solid rgba(255,255,255,0.05);}
.changelog-entry:last-child{border-bottom:none;padding-bottom:0;}
.changelog-meta time{color:var(--muted);font-family:monospace;font-size:0.85em;font-variant-numeric:tabular-nums;}
.changelog-details h3{margin:0 0 0.4em;color:var(--bright);font-size:0.98em;}
.changelog-details ul{margin:0;padding-left:1.2em;color:var(--foreground);font-size:0.88em;line-height:1.5;}
.setting-help{margin-top:0.25em;font-size:0.9em;opacity:0.8;}
.recipe-settings-browser{min-width:min(72em,80vw);}
.recipe-settings-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:0.5em;margin-bottom:0.35em;}
.recipe-settings-toolbar input[type="search"]{box-sizing:border-box;width:min(32em,100%);}
.recipe-settings-unavailable{display:inline-flex;align-items:center;gap:0.3em;cursor:pointer;white-space:nowrap;}
.recipe-settings-help{margin-top:0.35em;font-size:0.9em;opacity:0.8;}
.recipe-settings-summary{min-height:1.2em;margin-top:0.15em;margin-bottom:0.5em;font-size:0.9em;opacity:0.8;}
.recipe-settings-section{margin:0.5em 0;}
.recipe-settings-section>h4,.recipe-settings-section>summary{margin:0.35em 0;color:var(--bright);font-weight:bold;}
.recipe-settings-section>summary{cursor:pointer;user-select:none;}
.recipe-settings-category{margin:0.45em 0 0.7em;}
.recipe-settings-category h5{margin:0 0 0.2em;color:var(--foreground);font-size:0.9em;font-weight:normal;opacity:0.85;}
.recipe-settings-toggle-row{display:flex;flex-wrap:wrap;align-items:center;}
button.recipe-setting-toggle{line-height:0;}
button.recipe-setting-toggle.disabled-recipe{opacity:0.45;}
button.recipe-setting-toggle.unavailable{cursor:not-allowed;border-color:var(--light);background-color:var(--dark);filter:grayscale(1);opacity:0.3;}
button.recipe-setting-toggle.unavailable:hover{border-color:var(--light);}
.recycling-recipes-body{margin:0.35em 0 0.75em 1em;}
.disable-recycling-recipes{margin-bottom:0.35em;}
.recipe-settings-empty{margin:0.5em 0;font-style:italic;opacity:0.8;}
.disable-recycling-recipes:disabled{cursor:not-allowed;opacity:0.45;}
tr.recipe-setting-section td{padding-top:2.25em;}:root{--dark:#111315;--dark-overlay:rgba(17,19,21,0.94);--medium:#1a1d20;--main:#202428;--light:#343a40;--rule:#454b51;--muted:#a7adb3;--foreground:#d1d5d8;--accent:#e97924;--bright:#f6f5f2;--danger:#f1a36c;}
*{box-sizing:border-box;}
html{color-scheme:dark;scrollbar-gutter:stable;}
body{max-width:1680px;margin:0 auto;padding:0.75rem 1rem 2rem;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;line-height:1.42;background:var(--dark);font-variant-numeric:tabular-nums;}
a{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:0.18em;}
button,input,select{font:inherit;}
input,select{border:1px solid var(--rule);border-radius:3px;background:var(--medium);}
input:focus-visible,select:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
button.ui{min-height:2rem;padding:0.3rem 0.65rem;color:var(--foreground);border:1px solid var(--rule);border-radius:3px;background:var(--medium);box-shadow:none;}
button.ui:hover{color:var(--bright);border-color:var(--muted);background:var(--main);}
button.ui:active{transform:translateY(1px);}
ul#targets{margin:0 0 0.7rem;padding:0;}
ul#targets li{margin:0.15rem 0;border-radius:2px;}
.targetButton{margin-right:0.35rem;}
.planner-toolbar{min-height:2.5rem;margin:0;padding:0.35rem 0;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);}
.location-toolbar{padding:0;border:0;background:transparent;}
.location-toolbar-content{display:grid;gap:0.1rem;}
.location-toolbar-label,.progression-presets>label{color:var(--muted);font-size:0.78rem;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;}
.location-toolbar-help{color:var(--muted);font-size:0.72rem;}
#planet_selector .location-toggle{min-height:1.8rem;padding:1px 5px;border:1px solid transparent;border-radius:3px;background:transparent;}
#planet_selector .location-toggle:hover{border-color:var(--rule);}
#planet_selector .location-toggle.selected{border-color:var(--accent);background:rgba(233,121,36,0.09);}
.progression-presets{display:inline-flex;align-items:center;gap:0.4rem;}
.progression-presets select{min-height:1.9rem;padding:0.2rem 1.8rem 0.2rem 0.5rem;}
.planner-actions{gap:0.3rem;}
.planner-action{min-height:1.9rem;}
.planner-action.active{color:var(--bright);border-color:var(--accent);background:rgba(233,121,36,0.08);}
#share_status{color:var(--muted);font-size:0.78rem;}
div.tabs{display:flex;gap:1.25rem;margin-top:0.65rem;border-bottom:1px solid var(--rule);position:sticky;top:0;z-index:8;background:var(--dark-overlay);backdrop-filter:blur(6px);}
div.tabs button.tab_button{float:none;padding:0.55rem 0 0.45rem;color:var(--muted);border-bottom:2px solid transparent;border-radius:0;font-weight:600;}
div.tabs button.tab_button:hover{color:var(--bright);background:transparent;}
div.tabs button.active,div.tabs button.active:hover{color:var(--bright);border-bottom-color:var(--accent);background:transparent;}
div.tab{padding:0.85rem 0;background:transparent;}
.factory-density-label{color:var(--muted);}
.factory-density-control label,.segmented-control label{color:var(--muted);border-color:var(--rule);background:transparent;}
.factory-density-control input:checked + label,.segmented-control input:checked + label{color:var(--bright);border-color:var(--accent);background:rgba(233,121,36,0.08);}
.factory-summary{display:grid;grid-template-columns:repeat(3,minmax(9rem,13rem));gap:0;margin:0.2rem 0 0.8rem;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);}
.factory-summary-card{min-width:0;padding:0.55rem 0.8rem 0.55rem 0;border:0;border-radius:0;background:transparent;}
.factory-summary-card + .factory-summary-card{padding-left:0.8rem;border-left:1px solid var(--rule);}
.factory-summary-value{font-size:1.15rem;color:var(--bright);}
.factory-summary-label{color:var(--muted);font-size:0.76rem;}
.factory-summary-warning{grid-column:1 / -1;padding:0.45rem 0;color:var(--muted);border:0;border-top:1px solid var(--rule);background:transparent;}
.quality-plan-list{display:grid;grid-column:1 / -1;flex:0 0 100%;gap:0.8rem;width:100%;margin:0.35rem 0 1rem;}
.quality-plan{min-width:0;padding:0 0.8rem 0.8rem;border:1px solid var(--rule);border-radius:3px;background:color-mix(in srgb,var(--dark) 94%,var(--foreground));}
.quality-plan-title{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:0.12rem 0.5rem;padding:0.75rem 0;color:var(--bright);cursor:pointer;list-style:none;}
.quality-plan-title::-webkit-details-marker,.quality-plan-build-stage>summary::-webkit-details-marker,.quality-plan-advanced>summary::-webkit-details-marker{display:none;}
.quality-plan-title::before,.quality-plan-build-stage>summary::before,.quality-plan-advanced>summary::before{content:"▸";display:inline-block;color:var(--muted);}
.quality-plan[open]>.quality-plan-title::before,.quality-plan-build-stage[open]>summary::before,.quality-plan-advanced[open]>summary::before{content:"▾";}
.quality-plan-title::before{grid-row:1 / span 2;grid-column:1;align-self:center;}
.quality-plan-title-main{grid-column:2;min-width:0;font-size:1rem;font-weight:700;}
.quality-plan-title-rate{grid-row:1 / span 2;grid-column:3;align-self:center;margin-left:0.5rem;font-family:var(--font-mono);font-size:0.95rem;font-weight:650;}
.quality-plan-title-profile{grid-column:2;color:var(--muted);font-size:0.74rem;font-weight:500;}
.quality-plan-meta{display:flex;flex-wrap:wrap;gap:0.3rem 1rem;padding:0.55rem 0;color:var(--muted);font-size:0.74rem;}
.quality-plan-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr));border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);}
.quality-plan-metric{min-width:0;padding:0.55rem 0.75rem 0.55rem 0;}
.quality-plan-metric + .quality-plan-metric{padding-left:0.75rem;border-left:1px solid var(--rule);}
.quality-plan-metric-value{color:var(--bright);font-family:var(--font-mono);font-size:0.98rem;}
.quality-plan-metric-label{color:var(--muted);font-size:0.7rem;}
.quality-plan-primary-section{padding:0.75rem 0 0;}
.quality-plan-primary-section>h4,.quality-plan-surplus h4{margin:0 0 0.35rem;color:var(--muted);font-size:0.7rem;letter-spacing:0.05em;text-transform:uppercase;}
.quality-plan-lines{display:grid;gap:0.18rem;font-family:var(--font-mono);font-size:0.79rem;}
.quality-plan-material-line{display:grid;grid-template-columns:32px minmax(0,1fr);align-items:center;gap:0.5rem;}
.quality-plan-material-rate{white-space:nowrap;}
.quality-plan-imports{color:var(--foreground);}
.quality-plan-build-stage{border-bottom:1px solid color-mix(in srgb,var(--rule) 65%,transparent);}
.quality-plan-build-stage>summary{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:0.4rem;padding:0.45rem 0;color:var(--foreground);font-size:0.78rem;font-weight:650;cursor:pointer;list-style:none;}
.quality-plan-build-stage-meta{color:var(--muted);font-family:var(--font-mono);font-size:0.7rem;font-weight:400;white-space:nowrap;}
.quality-plan-build-line{display:grid;grid-template-columns:minmax(14rem,1fr) auto;gap:0.25rem 0.9rem;align-items:center;padding:0.35rem 0;}
.quality-plan-build-machine{min-width:0;}
.quality-plan-build-equipment{display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:0.28rem;color:var(--muted);font-size:0.75rem;}
.quality-plan-equipment-slots{display:inline-flex;gap:0.18rem;}
.quality-plan-equipment-icon{display:inline-flex;}
.quality-plan-equipment-empty,.quality-plan-beacon-label{white-space:nowrap;}
.quality-plan-operation-equipment{min-width:12rem;justify-content:flex-start;}
.quality-plan-operation-machine{white-space:nowrap;}
.quality-plan-advanced{margin-top:0.85rem;border-top:1px solid var(--rule);}
.quality-plan-advanced>summary{display:flex;align-items:center;gap:0.4rem;padding:0.65rem 0 0;color:var(--muted);cursor:pointer;font-size:0.78rem;font-weight:600;list-style:none;}
.quality-plan-title:focus-visible,.quality-plan-build-stage>summary:focus-visible,.quality-plan-advanced>summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
.quality-plan-advanced-body{padding-top:0.45rem;}
.quality-plan-surplus{padding:0.7rem 0 0;}
.quality-plan-operations{display:block;width:100%;margin-top:0.7rem;overflow-x:auto;border-collapse:collapse;}
.quality-plan-operations thead,.quality-plan-operations tbody,.quality-plan-operations tr{width:100%;}
.quality-plan-operations th,.quality-plan-operations td{padding:0.35rem 0.65rem 0.35rem 0;border-bottom:1px solid #30353a;text-align:left;white-space:nowrap;}
.quality-plan-operations th{color:var(--muted);font-size:0.7rem;font-weight:600;}
.quality-plan-operations .numeric{text-align:right;}
.quality-plan-notes{display:grid;gap:0.2rem;padding:0.7rem 0 0;color:var(--muted);font-size:0.75rem;}
@media (max-width:900px){.quality-plan-build-line{grid-template-columns:minmax(0,1fr);gap:0.1rem;}
.quality-plan-build-equipment{justify-content:flex-start;}}
.calculation-error{padding:0.65rem 0.8rem;border:1px solid var(--rule);border-left:3px solid var(--danger);border-radius:2px;background:transparent;}
.factory-table-scroll{border-top:1px solid var(--rule);}
#totals{width:100%;}
#totals thead{position:sticky;top:0;z-index:4;background:var(--dark);}
#totals tr.factory-header th{color:var(--muted);border-bottom:1px solid var(--rule);font-size:0.8rem;font-weight:600;letter-spacing:0.025em;text-align:right;white-space:nowrap;}
#totals tr.factory-header th.align-left{text-align:left;}
#totals tr.factory-header th.align-center{text-align:center;}
#totals tr.factory-header th.align-right{text-align:right;}
#totals tr.factory-header th:first-child{text-align:left;}
#totals tbody.display-group>tr:first-child td{border-top:1px solid #30353a;}
#totals tr.display-row:hover td{background:rgba(255,255,255,0.025);}
#totals tr.launch-limited td:first-child{box-shadow:inset 2px 0 var(--danger);}
#totals tr.launch-limited .item-state{color:var(--danger);}
#totals td{white-space:nowrap;vertical-align:middle;}
span.beacon-container{padding:0;border:0;border-radius:0;background:transparent;}
.beacon-controls{display:inline-flex;align-items:center;}
.module-wrapper,.machine-selector{position:relative;display:inline-block;}
.quality-icon{position:relative;display:inline-flex;width:32px;height:32px;vertical-align:middle;}
.equipment-quality-badge{position:absolute;right:-0.18rem;bottom:-0.18rem;z-index:2;filter:drop-shadow(0 1px 1px var(--dark));pointer-events:none;}
.module-pipette-active .module-wrapper>.dropdownWrapper[data-module-pipette-target="true"]{cursor:copy;}
.module-pipette-status{position:absolute;width:1px;height:1px;padding:0;border:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;}
.module-pipette-ghost{position:fixed;top:1rem;left:1rem;z-index:10000;width:32px;height:32px;opacity:0.78;filter:drop-shadow(0 1px 2px #000);pointer-events:none;}
.module-pipette-ghost[hidden]{display:none;}
.module-pipette-ghost.incompatible{opacity:0.5;filter:grayscale(0.85) drop-shadow(0 0 2px var(--danger));}
.equipment-quality-strip{display:none;}
.tippy-dropdown-menu.open>.equipment-quality-strip{display:flex;gap:0.25rem;margin:0 0 0.35rem;padding:0 0 0.35rem;border-bottom:1px solid var(--rule);}
.equipment-quality-strip button{display:inline-flex;width:2rem;height:2rem;align-items:center;justify-content:center;padding:0.25rem;border:1px solid var(--light);border-radius:0.25rem;background:var(--medium);cursor:pointer;}
.equipment-quality-strip button:hover,.equipment-quality-strip button.selected{color:var(--bright);border-right-color:var(--accent);border-bottom-color:var(--accent);border-left-color:var(--accent);background:var(--light);}
.beacon-quality-selector{display:inline-flex;margin-left:0.2rem;}
.beacon-quality-selector[hidden]{display:none;}
.beacon-quality-selector .dropdownWrapper{display:inline-flex;width:1.5rem;height:1.5rem;align-items:center;justify-content:center;border:1px solid var(--light);border-radius:0.2rem;background:var(--medium);cursor:pointer;}
.beacon-quality-trigger{display:inline-flex;}
.equipment-quality-defaults{display:flex;flex-wrap:wrap;gap:0.45rem 0.8rem;}
.setting-row[hidden]{display:none;}
.equipment-quality-defaults label{display:inline-flex;align-items:center;gap:0.3rem;color:var(--muted);font-size:0.78rem;}
.quality-planner-settings{display:flex;flex-wrap:wrap;gap:0.45rem 0.8rem;align-items:end;}
.quality-planner-settings label{display:grid;gap:0.2rem;color:var(--muted);font-size:0.78rem;}
.quality-planner-settings select{min-width:9rem;}
.quality-planner-advanced{margin-top:0.45rem;color:var(--muted);font-size:0.78rem;}
.quality-planner-advanced>summary{width:fit-content;cursor:pointer;}
.quality-planner-advanced>label{display:flex;gap:0.5rem;align-items:center;margin-top:0.4rem;}
.quality-planner-advanced select{min-width:13rem;}
.equipment-quality-select{min-width:6.5rem;}
.breakdown table{border:0;border-left:2px solid var(--rule);border-radius:0;background:transparent;}
.breakdown-first-output td{border-top-color:var(--rule);}
.recipe-selector-menu{border:1px solid var(--rule);border-top:2px solid var(--accent);border-radius:2px;box-shadow:0 0.65rem 1.5rem rgba(0,0,0,0.55);}
.recipe-selector-group-title{color:var(--muted);text-transform:uppercase;letter-spacing:0.035em;}
.visualization-toolbar{display:flex;flex-wrap:wrap;align-items:end;gap:0.7rem 1.1rem;padding:0.15rem 0 0.65rem;border-bottom:1px solid var(--rule);}
.visualization-control{display:grid;gap:0.25rem;}
.visualization-label{color:var(--muted);font-size:0.72rem;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;}
.segmented-control{display:inline-flex;}
.segmented-control input{position:absolute;opacity:0;pointer-events:none;}
.segmented-control label{cursor:pointer;padding:0.28rem 0.55rem;border:1px solid var(--rule);font-size:0.8rem;}
.segmented-control label + input + label{border-left:0;}
.segmented-control label:first-of-type{border-radius:3px 0 0 3px;}
.segmented-control label:last-of-type{border-radius:0 3px 3px 0;}
.visualization-key{flex:1 1 26rem;margin:0 0 0.25rem auto;color:var(--muted);font-size:0.78rem;text-align:right;}
#graph_container{margin-top:0.6rem;min-height:65vh;border:1px solid var(--rule);background:#15181a;}
svg#graph{width:100%;min-height:65vh;}
svg#graph text,svg.test text{fill:var(--foreground);}
g.node rect{stroke:var(--rule);stroke-width:1px;}
svg.sankey path.highlighter{stroke-opacity:0.48;}
svg.sankey g.edge:hover path.highlighter,svg.sankey g.edgePathHighlight path.highlighter{stroke-opacity:0.9;}
g.fuel path,path.fuel{stroke-dasharray:5 4;}
rect.nodeHighlight{stroke:var(--accent);stroke-width:2px;}
table#settings{width:min(65rem,100%);table-layout:fixed;}
.settings-label-column{width:190px;}
#settings_data,#settings_display,#settings_factory,#settings_research,#settings_recipes,.recipe-settings-category{scroll-margin-top:6rem;}
tr.setting-section td{padding-top:1.5rem;}
tr.setting-section td span{color:var(--bright);font-style:normal;font-weight:650;}
tr.setting-section td hr{border:0;border-top:1px solid var(--rule);}
tr.setting-row td{padding-top:0.28rem;padding-bottom:0.28rem;}
tr.setting-row td:first-child{padding-left:0;}
td.setting-label{padding-right:12px;color:var(--foreground);font-size:0.86rem;text-align:left;}
tr.setting-row td:last-child{min-width:0;padding-left:12px;}
#settings_recipes + tr td:last-child{width:calc(min(90vw,90rem) - 190px);}
#resource_settings{border:1px solid var(--rule);border-radius:2px;background:transparent;}
.help-content{max-width:68rem;padding:1rem 0 3rem;}
.help-section + .help-section{margin-top:2rem;}
.help-section h2{margin:0 0 0.4rem;font-size:1.15rem;color:var(--bright);}
.help-header h1{font-size:1.3rem;letter-spacing:-0.01em;}
.help-meta{font-size:0.8rem;color:var(--muted);margin-bottom:0.75rem;}
.help-meta a{color:var(--accent);text-decoration:none;}
.help-meta a:hover{text-decoration:underline;}
.help-section-title{font-size:0.8rem;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--bright);padding-bottom:0.35rem;border-bottom:1px solid var(--rule);margin-bottom:0.75rem;}
.help-steps{font-size:0.86rem;color:var(--foreground);line-height:1.48;}
.help-table{font-size:0.86rem;color:var(--foreground);}
.help-table th,.help-table td{padding:0.45rem 0.65rem;border-bottom-color:var(--rule);}
.help-table tbody tr:last-child td{border-bottom:none;}
.help-changelog>summary{font-size:0.8rem;text-transform:uppercase;letter-spacing:0.08em;}
.changelog-timeline{display:flex;flex-direction:column;}
.changelog-entry{display:grid;grid-template-columns:7.5rem 1fr;column-gap:1.5rem;padding:0.75rem 0;border-bottom:1px solid var(--rule);}
.changelog-entry:last-child{border-bottom:none;}
.changelog-meta time{color:var(--muted);font-family:monospace;font-size:0.82rem;font-variant-numeric:tabular-nums;}
.changelog-details h3{margin:0 0 0.3rem;font-size:0.92rem;color:var(--bright);}
.changelog-details ul{margin:0;padding-left:1.1rem;color:var(--foreground);font-size:0.85rem;line-height:1.45;}
#footer{margin-top:2rem;padding-top:0.8rem;border-top:1px solid var(--rule);color:var(--muted);font-size:0.78rem;}
@media (max-width:760px){body{padding-inline:0.6rem;}
.planner-actions{margin-left:0;}
.progression-presets{order:3;width:100%;}
.visualization-key{text-align:left;}
.factory-summary{grid-template-columns:1fr;}
.factory-summary-card + .factory-summary-card{padding-left:0;border-left:0;border-top:1px solid var(--rule);}
.help-table th,.help-table td{padding-inline:0.4rem;}
.changelog-entry{grid-template-columns:1fr;gap:0.3rem;}}
table#settings{display:block;width:min(90rem,100%);table-layout:auto;}
table#settings colgroup{display:none;}
table#settings tbody{display:grid;grid-template-columns:repeat(2,minmax(0,15rem)) minmax(0,1fr);gap:0 1.5rem;width:100%;}
tr.setting-section{display:table;grid-column:1 / -1;width:100%;max-width:65rem;}
tr.setting-section.recipe-setting-section{max-width:90rem;}
tr.setting-row{display:grid;grid-column:1 / 3;gap:0.35rem;width:100%;max-width:31.5rem;margin-bottom:1rem;}
tr.setting-row.compact-setting-first{grid-column:1;}
tr.setting-row.compact-setting-second{grid-column:2;}
#settings_recipes + tr.setting-row{grid-column:1 / -1;max-width:none;}
tr.setting-row td,tr.setting-row td:first-child,tr.setting-row td:last-child{display:block;width:100%;padding:0;}
td.setting-label{color:var(--foreground);font-size:0.86rem;font-weight:500;line-height:1.3;text-align:left;}
.top-icon>div{height:auto;line-height:inherit;}
.recipe-settings-browser{width:min(90vw,90rem);}
@media (max-width:760px){table#settings tbody{grid-template-columns:minmax(0,1fr);}
tr.setting-row,tr.setting-row.compact-setting-first,tr.setting-row.compact-setting-second,#settings_recipes + tr.setting-row{grid-column:1;max-width:30rem;}
.recipe-settings-browser{width:100%;}}
.targets-panel{margin-bottom:0.4rem;}
.targets-heading{margin-bottom:0.25rem;}
#targets_title{color:var(--bright);font-size:0.78rem;font-weight:650;letter-spacing:0.04em;text-transform:uppercase;}
ul#targets{margin-bottom:0.35rem;}
.production-target-header,ul#targets li.production-target-row{display:grid;grid-template-columns:2rem 220px 110px 72px 88px 88px;align-items:center;gap:8px;width:max-content;max-width:100%;}
.production-target-header{color:var(--muted);font-size:0.72rem;font-weight:600;text-align:left;}
.production-target-header>:first-child{width:2rem;}
ul#targets li.production-target-row{min-height:2rem;}
.production-target-row .targetButton{margin-right:0;}
.production-target-item{display:flex;min-width:0;align-items:center;gap:0.2rem;overflow:hidden;}
.production-target-item>.dropdownWrapper{flex:1 1 auto;min-width:0;width:100%;}
.production-target-item .itemDropdown{width:100%;}
.production-target-item .target-item-name{max-width:none;}
.production-target-settings{display:contents;}
.target-setting-field{display:contents;}
.target-quality-planning,.target-quality-planning .target-setting-field{display:contents;}
.target-quality-planning select{width:100%;min-width:0;margin:0;}
.target-belts-field{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:0.25rem;}
.target-belts-field .target-field-label{grid-column:1 / -1;}
.target-belt-stack-height,.belt-stack-height{color:var(--muted);font-family:var(--font-mono);font-size:0.68rem;white-space:nowrap;}
.target-field-label{display:none;}
.production-target-row .target-quality,.production-target-row .target-machine-count,.production-target-row .target-rate,.production-target-row .target-belts{width:100%;min-width:0;margin:0;}
.production-target-row .target-machine-count,.production-target-row .target-rate,.production-target-row .target-belts{text-align:right;}
.production-target-row.planned-quality-target .target-machines-field,.production-target-row.planned-quality-target .target-belts-field{display:none;}
.production-target-row.planned-quality-target .target-rate-field{display:grid;grid-column:5;grid-template-columns:minmax(0,1fr);align-items:center;}
.production-target-row input.selected{color:var(--bright);font-weight:650;}
.production-target-row .location-warning{grid-column:2 / -1;margin-left:0;}
#plusButton{margin-top:0.2rem;}
.add-target-button{min-height:1.8rem;margin-left:calc(2rem + 8px);padding-inline:0.6rem;color:var(--muted);}
.planner-toolbar{border-top:0;padding-block:0.3rem;}
.location-toolbar-label,.progression-presets>label{font-size:0.72rem;}
#planet_selector .location-toggle{min-height:1.7rem;}
div.tabs{align-items:flex-end;overflow:visible;}
.tab-tools{display:flex;align-items:center;margin-left:auto;padding-bottom:0.28rem;}
.tab-tools[hidden]{display:none;}
.factory-density-label{margin-right:0.3rem;font-size:0.72rem;}
.factory-density-control label{padding:0.2rem 0.38rem;border:0;border-bottom:1px solid transparent;border-radius:0;background:transparent;}
.factory-density-control label:first-of-type,.factory-density-control label:last-of-type{border-radius:0;}
.factory-density-control label:last-of-type{border-left:0;}
.factory-density-control input:checked + label{color:var(--bright);border-color:var(--accent);background:transparent;}
.factory-summary{display:flex;flex-wrap:wrap;align-items:baseline;gap:1.8rem;margin:0.2rem 0 0.65rem;border:0;}
.factory-summary-card{display:inline-flex;align-items:baseline;gap:0.42rem;min-width:0;padding:0;border:0;background:transparent;}
.factory-summary-card + .factory-summary-card{padding-left:0;border-left:0;}
.factory-summary-value{font-size:1.08rem;font-weight:650;}
.factory-summary-label{margin:0;color:var(--muted);font-size:0.76rem;}
.factory-summary-warning{flex-basis:100%;margin-top:-0.35rem;padding:0;color:var(--muted);border:0;background:transparent;font-size:0.78rem;}
.factory-table-scroll{border-top:0;}
#totals tr.factory-header th{padding-bottom:0.35rem;text-transform:none;}
#totals tr.factory-header th:first-child{padding-left:1.35rem;}
#totals tbody.display-group>tr:first-child td{border-top-color:#2b3034;}
#totals tr.target-output>td:first-child{border-left:2px solid var(--accent);}
#totals tr.imported-output .item-name{color:var(--muted);}
td.item-identity{min-width:12rem;padding-right:1rem;}
.item-import-toggle{display:grid;grid-template-columns:32px minmax(6rem,auto);grid-template-rows:auto auto;align-items:center;column-gap:0.45rem;width:100%;padding:0;color:var(--foreground);border:0;background:transparent;text-align:left;cursor:pointer;}
.item-import-toggle:hover .item-name,.item-import-toggle:focus-visible .item-name{color:var(--bright);text-decoration:underline;text-decoration-color:var(--accent);text-underline-offset:0.18em;}
.item-import-toggle:focus-visible{outline:1px solid var(--accent);outline-offset:2px;}
.item-import-toggle .item-icon{grid-row:1 / span 2;}
.item-name{overflow:hidden;font-size:0.84rem;font-weight:550;line-height:1.15;text-overflow:ellipsis;white-space:nowrap;}
.item-state{min-height:0.85rem;color:var(--accent);font-size:0.66rem;letter-spacing:0.035em;line-height:1;text-transform:uppercase;}
.item-state:empty{display:none;}
.imported-output .item-state{color:var(--muted);}
.logistics-cell{min-width:9rem;white-space:nowrap;}
.logistics-cell .belt-stack-policy{width:5.35rem;margin-left:0.35rem;padding:0.12rem 0.2rem;font-size:0.68rem;}
.logistics-cell .belt-stack-height{margin-left:0.3rem;}
.power-cell{min-width:6.4rem;vertical-align:middle;}
.power-cell .fuel-icon{display:inline-flex;align-items:center;vertical-align:middle;margin-right:0.25rem;color:var(--muted);}
.power-cell tt.power{vertical-align:middle;}
#totals td.popout{vertical-align:middle;opacity:0.22;transition:opacity 100ms ease;}
#totals tr:hover td.popout,#totals td.popout:focus-within{opacity:1;}
.visualization-toolbar{align-items:end;padding-bottom:0.5rem;border-bottom:0;}
.visualization-control{gap:0.15rem;}
.segmented-control label{padding:0.22rem 0.42rem;border:0;border-bottom:1px solid transparent;border-radius:0;}
.segmented-control label:first-of-type,.segmented-control label:last-of-type{border-radius:0;}
.segmented-control label + input + label{border-left:0;}
.segmented-control input:checked + label{border-color:var(--accent);background:transparent;}
.visualization-meta{display:flex;flex:1 1 28rem;justify-content:flex-end;align-items:baseline;gap:0.8rem;margin-left:auto;text-align:right;}
.visualization-summary{color:var(--foreground);font-size:0.78rem;white-space:nowrap;}
.visualization-key{flex:0 1 auto;margin:0;color:var(--muted);font-size:0.74rem;text-align:right;}
#graph_container{margin-top:0.35rem;border-color:#30353a;background:var(--dark);}
svg.sankey path.highlighter{stroke-opacity:0.38;}
svg.sankey g.edge:hover path.highlighter,svg.sankey g.edgePathHighlight path.highlighter{stroke-opacity:0.88;}
.resources-intro{max-width:48rem;color:var(--muted);}
@media (max-width:900px){div.tabs{gap:0.85rem;}
.tab-tools{width:100%;margin-left:0;padding:0.25rem 0 0.35rem;}
.factory-summary{align-items:flex-start;flex-direction:column;gap:0.25rem;}
.factory-summary-card{width:auto;}
.visualization-meta{justify-content:flex-start;text-align:left;}
.visualization-key{text-align:left;}}
.itemDropdown input[type="radio"] + label{align-items:center;gap:0.4rem;padding-right:0.45rem;}
.itemDropdown input[type="radio"]:checked + label{display:inline-flex;}
.target-item-name{max-width:13rem;overflow:hidden;color:var(--foreground);font-size:0.84rem;text-overflow:ellipsis;white-space:nowrap;}
.itemDropdown.open input[type="radio"] + label{padding-right:2px;}
.itemDropdown.open input[type="radio"] + label .target-item-name{display:none;}
.itemDropdown.open input[type="radio"]:checked + label .target-item-name{display:inline;}
#totals tr.factory-header th .header-icon{margin-right:0.3rem;opacity:0.82;}
.tippy-dropdown-menu{border:1px solid var(--rule);border-radius:2px;background:transparent;}
.tippy-dropdown-menu:hover{border-color:var(--muted);}
.tippy-dropdown-menu.open{padding:0.35rem;border:1px solid var(--rule);border-top:2px solid var(--accent);border-radius:2px;background:var(--dark);box-shadow:0 0.65rem 1.5rem rgba(0,0,0,0.5);}
.dropdownWrapper.open .spacer{border-width:1px;}
.tippy-dropdown-menu.open hr{border:0;border-top:1px solid var(--rule);}
.tippy-dropdown-menu input[type="radio"] + label{margin:1px;border-radius:2px;}
.tippy-dropdown-menu input[type="radio"] + label:hover,.tippy-dropdown-menu.open input[type="radio"]:checked + label{background:var(--main);}
#totals tr.factory-header th:first-child{text-align:left;}
#totals td.building-icon{padding-right:0.15rem;text-align:right;}
#totals td.building-icon + td.building{padding-left:0;text-align:left;}
#totals td.building-icon span{margin-left:0.15rem;}
#totals td.building-icon .machine-selector,#totals td.building-icon .machine-selector span{margin-left:0;}
.machine-selector .machine-option-name{display:none;}
.machine-selector .machine-dropdown.open{min-width:13rem;text-align:left;}
.machine-selector .machine-dropdown.open .machine-option label{display:flex;align-items:center;gap:0.4rem;padding-right:0.5rem;}
.machine-selector .machine-dropdown.open .machine-option-name{display:inline;color:var(--foreground);font-size:0.8rem;}
.target-quality,.recipe-location-selector{margin:0 0.35rem;max-width:12rem;}
.planning-details{width:min(38rem,100%);border:1px solid var(--rule);border-radius:2px;}
.planning-details>summary{padding:0.42rem 0.55rem;color:var(--foreground);cursor:pointer;user-select:none;}
.planning-details>summary:hover,.planning-details>summary:focus-visible{color:var(--bright);}
.planning-details[open]>summary{border-bottom:1px solid var(--rule);}
.planning-details-body{display:grid;gap:0.85rem;padding:0.65rem;}
.planning-group + .planning-group{padding-top:0.7rem;border-top:1px solid var(--rule);}
.planning-group h4{margin:0;color:var(--bright);font-size:0.84rem;}
.planning-group p{margin:0.15rem 0 0.5rem;color:var(--muted);font-size:0.75rem;}
.planning-grid{display:grid;grid-template-columns:repeat(2,minmax(9rem,1fr));gap:0.5rem 0.75rem;max-width:30rem;}
.planning-field{display:grid;gap:0.18rem;min-width:0;}
.planning-field>span:first-child{color:var(--muted);font-size:0.75rem;}
.planning-field input{width:100%;min-width:0;}
.planning-control{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:0.3rem;}
.planning-control>span:last-child{color:var(--muted);font-size:0.78rem;}
@media (max-width:760px){.planning-details{width:100%;}
.planning-grid{grid-template-columns:1fr;}}
.machine-option label span:last-child,.recipe-selector-option span:last-child{line-height:1.25;}
.setting-help,.recipe-settings-help,.recipe-settings-summary{color:var(--muted);font-size:0.82rem;opacity:1;}
.recipe-settings-browser{width:calc(min(90vw,90rem) - 202px);min-width:0;}
.recipe-settings-toolbar{gap:0.45rem 0.75rem;}
.recipe-settings-unavailable,.recipe-settings-changed{display:inline-flex;align-items:center;gap:0.3rem;color:var(--foreground);cursor:pointer;white-space:nowrap;}
.reset-recipe-changes{margin-left:auto;}
.reset-recipe-changes:disabled{cursor:not-allowed;opacity:0.45;}
.recipe-settings-category{margin:0.35rem 0 0.55rem;}
.recipe-settings-category>summary{width:max-content;margin-bottom:0.2rem;color:var(--foreground);cursor:pointer;font-size:0.82rem;user-select:none;}
.recipe-settings-category>summary:hover,.recipe-settings-category>summary:focus-visible{color:var(--bright);}
#totals_tab,#graph_tab{width:min(90rem,100%);}
#help_tab,.help-content{width:min(65rem,100%);}
@media (min-width:901px){.progression-presets{margin-left:0.35rem;padding-left:0.9rem;border-left:1px solid var(--rule);}}
@media (max-width:760px){.production-target-header{display:none;}
ul#targets li.production-target-row{grid-template-columns:2rem minmax(0,1fr);align-items:start;width:100%;}
.production-target-item{grid-column:2;width:calc(100vw - 4rem);}
.production-target-settings{display:grid;grid-column:2;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:calc(100vw - 4rem);min-width:0;max-width:100%;overflow:hidden;}
.target-setting-field{display:grid;min-width:0;gap:0.2rem;}
.target-quality-planning{display:grid;grid-column:1 / -1;grid-template-columns:minmax(0,1fr);gap:0.2rem;min-width:0;}
.target-quality-planning .target-setting-field{display:grid;min-width:0;gap:0.2rem;}
.production-target-row.planned-quality-target .target-rate-field{grid-column:auto;grid-template-columns:minmax(0,1fr);gap:0.2rem;}
.target-field-label{display:block;color:var(--muted);font-size:0.68rem;font-weight:600;}
.progression-presets{order:initial;}
.settings-label-column{width:9rem;}
.recipe-settings-browser{width:calc(100vw - 10.5rem);}
.reset-recipe-changes{margin-left:0;}
#totals tr.factory-header th:first-child,#totals tr.display-row>td:first-child,#totals td.item-identity{position:sticky;z-index:3;background:var(--dark);}
#totals tr.factory-header th:first-child,#totals tr.display-row>td:first-child{left:0;}
#totals td.item-identity{left:1.35rem;}
#totals tr.display-row:hover>td:first-child,#totals tr.display-row:hover>td.item-identity{background:#171a1d;}}
#settings_recipes + tr.setting-row .recipe-settings-browser{width:min(90vw,90rem);}
@media (max-width:760px){#settings_recipes + tr.setting-row .recipe-settings-browser{width:100%;}}`

function installCalculatorStyles(): void {
  if (document.getElementById("calculator-styles") !== null) return
  const styleElement = document.createElement("style")
  styleElement.id = "calculator-styles"
  styleElement.textContent = CALCULATOR_CSS
  document.head.append(styleElement)
}

interface SankeyGraph<Node, Link> {
  nodes: Node[]
  links: Link[]
}

interface SankeyGenerator<Node, Link> {
  (graph: SankeyGraph<Node, Link>): SankeyGraph<Node, Link>
  update(graph: SankeyGraph<Node, Link>): SankeyGraph<Node, Link>
  nodeWidth(value: number): SankeyGenerator<Node, Link>
  nodePadding(value: number): SankeyGenerator<Node, Link>
  nodeAlign(value: (node: Node, columns: number) => number): SankeyGenerator<Node, Link>
  maxNodeHeight(value: number): SankeyGenerator<Node, Link>
  linkLength(value: number): SankeyGenerator<Node, Link>
}

// region data.ts
// Dataset contracts

export interface LocalizedName {
  en: string
  [locale: string]: string
}

export interface SpriteReference {
  icon_col: number
  icon_row: number
}

export interface SurfaceConditionData {
  property: string
  min?: number
  max?: number
}

export interface EnergySourceData {
  type?: string
  fuel_category?: string
  emissions_per_minute?: Record<string, number>
}

export interface ItemData extends SpriteReference {
  key: string
  localized_name: LocalizedName
  order: string
  subgroup: string
  group: string
  type: string
  stack_size?: number
}

export interface RecipeAmountData {
  name: string
  amount?: number
  amount_min?: number
  amount_max?: number
  probability?: number
  independent_probability?: number
  shared_probability?: {
    min?: number
    max?: number
  }
  extra_count_fraction?: number
  ignored_by_productivity?: number
}

export interface RecipeData extends SpriteReference {
  key: string
  localized_name: LocalizedName
  categories?: string[]
  category?: string
  energy_required: number
  ingredients: RecipeAmountData[]
  results: RecipeAmountData[]
  allow_productivity: boolean
  allow_quality?: boolean
  maximum_productivity?: number
  order: string
  subgroup: string
  surface_conditions?: SurfaceConditionData[]
}

export interface RecipeProductivityEffectData {
  recipe: string
  change: number
}

export interface RecipeProductivityResearchData extends SpriteReference {
  key: string
  localized_name: LocalizedName
  effects: RecipeProductivityEffectData[]
}

export interface MachineData extends SpriteReference {
  key: string
  localized_name: LocalizedName
  allowed_effects?: string[]
  crafting_categories?: string[]
  crafting_speed?: number
  drops_full_belt_stacks?: boolean
  energy_source?: EnergySourceData
  energy_usage?: number
  module_slots?: number
  prod_bonus?: number
  surface_conditions?: SurfaceConditionData[]
}

export interface MiningDrillData extends MachineData {
  mining_speed: number
  resource_drain_rate_percent?: number
  resource_categories: string[]
  takes_fluid: boolean
}

export interface BeltData extends SpriteReference {
  key: string
  localized_name: LocalizedName
  speed: number
}

export interface FuelData {
  category: string
  item_key: string
  value: number
}

export interface ModuleEffectData {
  consumption?: number
  pollution?: number
  productivity?: number
  quality?: number
  speed?: number
}

export interface ModuleData {
  category?: string
  effect: ModuleEffectData
  quality_effects?: Record<string, ModuleEffectData>
  item_key: string
}

export interface QualityData extends SpriteReference {
  key: string
  localized_name: LocalizedName
  level: number
  order: string
  color: string
  crafting_speed_multiplier: number
  module_effect_multiplier: number
  beacon_power_usage_multiplier: number
  mining_drill_resource_drain_multiplier: number
}

export interface PlantData extends SpriteReference {
  key: string
  localized_name: LocalizedName
  order?: string
  seed: string
  growth_ticks: number
  results: RecipeAmountData[]
  harvest_emissions?: Record<string, number>
  surface_conditions?: SurfaceConditionData[]
}

export interface SpoilageData {
  from_item: string
  to_item: string
  time: number
}

export interface AgriculturalTowerData extends MachineData {
  radius?: number
}

export interface BeaconData {
  energy_usage?: number
  distribution_effectivity: number
  distribution_effectivity_bonus_per_quality_level?: number
  profile?: number[]
  allowed_effects?: string[]
}

export interface ResourceData extends SpriteReference {
  order?: string
  key: string
  localized_name: LocalizedName
  category?: string
  fluid_amount?: number
  mining_time: number
  required_fluid?: string
  results: RecipeAmountData[]
}

export interface PlanetResourceData {
  resource?: string[]
  offshore?: string[]
  plants?: string[]
}

export interface PlanetData extends SpriteReference {
  key: string
  localized_name: LocalizedName
  order: string
  pollutant_type?: string
  resources: PlanetResourceData
  surface_properties: Record<string, number>
}

export interface BoilerData {
  key: string
  energy_consumption: number
  target_temperature: number
}

export interface FluidData {
  item_key: string
  default_temperature: number
  heat_capacity: number
}

export interface OffshorePumpData extends SpriteReference {
  key: string
  localized_name: LocalizedName
  pumping_speed: number
  surface_conditions?: SurfaceConditionData[]
}

export interface SurfacePropertyData {
  name: string
  default_value: number
}

export interface RocketLaunchData {
  parts_per_launch: number
  launch_cycle_ticks: number
  launch_cycle_ticks_by_quality?: Record<string, number>
  buffered: boolean
}

export interface SpriteSheetData {
  hash: string
  width: number
  height: number
  extra: Record<string, SpriteReference & { name: string }>
}

export interface ItemGroupData {
  order?: string
  subgroups: Record<string, string>
}

/** Browser-ready dataset consumed by the calculator runtime. */
export interface CalculatorData {
  game_version?: string
  game_build?: number
  experimental?: boolean
  source?: string
  mods?: string[]
  recipe_aliases?: Record<string, string>
  groups: Record<string, ItemGroupData>
  items: ItemData[]
  recipes: RecipeData[]
  crafting_machines: MachineData[]
  mining_drills: MiningDrillData[]
  rocket_silo?: MachineData[]
  offshore_pumps?: OffshorePumpData[]
  surface_properties?: SurfacePropertyData[]
  rocket_launch?: RocketLaunchData
  belts: BeltData[]
  fuel: FuelData[]
  modules: ModuleData[]
  qualities?: QualityData[]
  recipe_productivity_research?: RecipeProductivityResearchData[]
  resources: ResourceData[]
  boilers: BoilerData[]
  fluids: FluidData[]
  plants?: PlantData[]
  spoilage?: SpoilageData[]
  agricultural_tower?: AgriculturalTowerData[]
  beacon: BeaconData
  planets?: PlanetData[]
  sprites: SpriteSheetData
  [key: string]: unknown
}

// External data checks

export class DatasetValidationError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`)
    this.name = "DatasetValidationError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new DatasetValidationError(path, "expected an object")
  }
  return value
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new DatasetValidationError(path, "expected an array")
  }
  return value
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new DatasetValidationError(path, "expected a non-empty string")
  }
  return value
}

function requireNonnegativeNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new DatasetValidationError(path, "expected a nonnegative finite number")
  }
  return value
}

function requirePositiveNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new DatasetValidationError(path, "expected a positive finite number")
  }
  return value
}

function requireFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DatasetValidationError(path, "expected a finite number")
  }
  return value
}

function validateKeyedEntries(value: unknown, path: string): void {
  for (let [index, entry] of requireArray(value, path).entries()) {
    let record = requireRecord(entry, `${path}[${index}]`)
    requireString(record.key, `${path}[${index}].key`)
  }
}

function validateRecipes(value: unknown): void {
  for (let [index, entry] of requireArray(value, "recipes").entries()) {
    let path = `recipes[${index}]`
    let recipe = requireRecord(entry, path)
    requireString(recipe.key, `${path}.key`)
    requireArray(recipe.ingredients, `${path}.ingredients`)
    requireArray(recipe.results, `${path}.results`)
    if (recipe.categories !== undefined && !Array.isArray(recipe.categories)) {
      throw new DatasetValidationError(`${path}.categories`, "expected an array")
    }
    if (recipe.allow_productivity !== undefined && typeof recipe.allow_productivity !== "boolean") {
      throw new DatasetValidationError(`${path}.allow_productivity`, "expected a boolean")
    }
    if (recipe.allow_quality !== undefined && typeof recipe.allow_quality !== "boolean") {
      throw new DatasetValidationError(`${path}.allow_quality`, "expected a boolean")
    }
    if (recipe.maximum_productivity !== undefined) {
      requireNonnegativeNumber(recipe.maximum_productivity, `${path}.maximum_productivity`)
    }
  }
}

function validateOptionalNonnegativeNumber(record: Record<string, unknown>, key: string, path: string): void {
  if (record[key] !== undefined) {
    requireNonnegativeNumber(record[key], `${path}.${key}`)
  }
}

function validateItems(value: unknown): void {
  for (let [index, entry] of requireArray(value, "items").entries()) {
    let path = `items[${index}]`
    let item = requireRecord(entry, path)
    requireString(item.key, `${path}.key`)
    validateOptionalNonnegativeNumber(item, "stack_size", path)
  }
}

function validateEnergySource(value: unknown, path: string): void {
  if (value === undefined) return
  let source = requireRecord(value, path)
  if (source.emissions_per_minute === undefined) return
  let emissions = requireRecord(source.emissions_per_minute, `${path}.emissions_per_minute`)
  for (let [pollutant, amount] of Object.entries(emissions)) {
    requireFiniteNumber(amount, `${path}.emissions_per_minute.${pollutant}`)
  }
}

function validateRecipeProductivityResearch(value: unknown): void {
  for (let [index, entry] of requireArray(value, "recipe_productivity_research").entries()) {
    let path = `recipe_productivity_research[${index}]`
    let research = requireRecord(entry, path)
    requireString(research.key, `${path}.key`)
    let localizedName = requireRecord(research.localized_name, `${path}.localized_name`)
    requireString(localizedName.en, `${path}.localized_name.en`)
    requireNonnegativeNumber(research.icon_col, `${path}.icon_col`)
    requireNonnegativeNumber(research.icon_row, `${path}.icon_row`)
    for (let [effectIndex, entryEffect] of requireArray(research.effects, `${path}.effects`).entries()) {
      let effectPath = `${path}.effects[${effectIndex}]`
      let effect = requireRecord(entryEffect, effectPath)
      requireString(effect.recipe, `${effectPath}.recipe`)
      requireNonnegativeNumber(effect.change, `${effectPath}.change`)
    }
  }
}

function validateMachines(value: unknown, path: string): void {
  for (let [index, entry] of requireArray(value, path).entries()) {
    let machinePath = `${path}[${index}]`
    let machine = requireRecord(entry, machinePath)
    requireString(machine.key, `${machinePath}.key`)
    validateEnergySource(machine.energy_source, `${machinePath}.energy_source`)
    if (machine.allowed_effects !== undefined) {
      let effects = requireArray(machine.allowed_effects, `${machinePath}.allowed_effects`)
      for (let [effectIndex, effect] of effects.entries()) {
        requireString(effect, `${machinePath}.allowed_effects[${effectIndex}]`)
      }
    }
    if (machine.drops_full_belt_stacks !== undefined && typeof machine.drops_full_belt_stacks !== "boolean") {
      throw new DatasetValidationError(`${machinePath}.drops_full_belt_stacks`, "expected a boolean")
    }
    if (machine.resource_drain_rate_percent !== undefined) {
      requirePositiveNumber(machine.resource_drain_rate_percent, `${machinePath}.resource_drain_rate_percent`)
    }
  }
}

function validatePlants(value: unknown): void {
  for (let [index, entry] of requireArray(value, "plants").entries()) {
    let path = `plants[${index}]`
    let plant = requireRecord(entry, path)
    requireString(plant.key, `${path}.key`)
    requireString(plant.seed, `${path}.seed`)
    requireNonnegativeNumber(plant.growth_ticks, `${path}.growth_ticks`)
    requireArray(plant.results, `${path}.results`)
    if (plant.harvest_emissions !== undefined) {
      let emissions = requireRecord(plant.harvest_emissions, `${path}.harvest_emissions`)
      for (let [pollutant, amount] of Object.entries(emissions)) {
        requireFiniteNumber(amount, `${path}.harvest_emissions.${pollutant}`)
      }
    }
  }
}

function validateRocketLaunch(value: unknown): void {
  let launch = requireRecord(value, "rocket_launch")
  requirePositiveNumber(launch.parts_per_launch, "rocket_launch.parts_per_launch")
  requirePositiveNumber(launch.launch_cycle_ticks, "rocket_launch.launch_cycle_ticks")
  if (launch.launch_cycle_ticks_by_quality !== undefined) {
    for (const [quality, ticks] of Object.entries(
      requireRecord(launch.launch_cycle_ticks_by_quality, "rocket_launch.launch_cycle_ticks_by_quality"),
    )) {
      requirePositiveNumber(ticks, `rocket_launch.launch_cycle_ticks_by_quality.${quality}`)
    }
  }
  if (typeof launch.buffered !== "boolean") {
    throw new DatasetValidationError("rocket_launch.buffered", "expected a boolean")
  }
}

function validatePlanets(value: unknown): void {
  for (let [index, entry] of requireArray(value, "planets").entries()) {
    let path = `planets[${index}]`
    let planet = requireRecord(entry, path)
    requireString(planet.key, `${path}.key`)
    if (planet.pollutant_type !== undefined) {
      requireString(planet.pollutant_type, `${path}.pollutant_type`)
    }
  }
}

function validateSpoilage(value: unknown): void {
  for (let [index, entry] of requireArray(value, "spoilage").entries()) {
    let path = `spoilage[${index}]`
    let spoilage = requireRecord(entry, path)
    requireString(spoilage.from_item, `${path}.from_item`)
    requireString(spoilage.to_item, `${path}.to_item`)
    requireNonnegativeNumber(spoilage.time, `${path}.time`)
  }
}

function validateBeacon(value: unknown): void {
  let beacon = requireRecord(value, "beacon")
  requireNonnegativeNumber(beacon.distribution_effectivity, "beacon.distribution_effectivity")
  validateOptionalNonnegativeNumber(beacon, "energy_usage", "beacon")
  validateOptionalNonnegativeNumber(beacon, "distribution_effectivity_bonus_per_quality_level", "beacon")
  if (beacon.profile !== undefined) {
    for (let [index, effectivity] of requireArray(beacon.profile, "beacon.profile").entries()) {
      requireNonnegativeNumber(effectivity, `beacon.profile[${index}]`)
    }
  }
}

function validateModules(value: unknown): void {
  for (let [index, entry] of requireArray(value, "modules").entries()) {
    let path = `modules[${index}]`
    let module = requireRecord(entry, path)
    requireString(module.item_key, `${path}.item_key`)
    const validateEffect = (value: unknown, effectPath: string): void => {
      for (const [effect, amount] of Object.entries(requireRecord(value, effectPath))) {
        requireFiniteNumber(amount, `${effectPath}.${effect}`)
      }
    }
    validateEffect(module.effect, `${path}.effect`)
    if (module.quality_effects !== undefined) {
      for (const [quality, effect] of Object.entries(
        requireRecord(module.quality_effects, `${path}.quality_effects`),
      )) {
        validateEffect(effect, `${path}.quality_effects.${quality}`)
      }
    }
  }
}

function validateQualities(value: unknown): void {
  for (let [index, entry] of requireArray(value, "qualities").entries()) {
    let path = `qualities[${index}]`
    let quality = requireRecord(entry, path)
    requireString(quality.key, `${path}.key`)
    requireNonnegativeNumber(quality.level, `${path}.level`)
    requireString(quality.order, `${path}.order`)
    requireString(quality.color, `${path}.color`)
    const localizedName = requireRecord(quality.localized_name, `${path}.localized_name`)
    requireString(localizedName.en, `${path}.localized_name.en`)
    requireNonnegativeNumber(quality.icon_col, `${path}.icon_col`)
    requireNonnegativeNumber(quality.icon_row, `${path}.icon_row`)
    requirePositiveNumber(quality.crafting_speed_multiplier, `${path}.crafting_speed_multiplier`)
    requirePositiveNumber(quality.module_effect_multiplier, `${path}.module_effect_multiplier`)
    requirePositiveNumber(quality.beacon_power_usage_multiplier, `${path}.beacon_power_usage_multiplier`)
    requirePositiveNumber(
      quality.mining_drill_resource_drain_multiplier,
      `${path}.mining_drill_resource_drain_multiplier`,
    )
  }
}

/** Validate untrusted JSON once at the application boundary. */
export function parseCalculatorData(value: unknown): CalculatorData {
  let data = requireRecord(value, "dataset")
  validateItems(data.items)
  validateRecipes(data.recipes)
  validateMachines(data.crafting_machines, "crafting_machines")
  validateMachines(data.mining_drills, "mining_drills")
  if (data.agricultural_tower !== undefined) {
    validateMachines(data.agricultural_tower, "agricultural_tower")
  }
  validateKeyedEntries(data.belts, "belts")
  requireArray(data.fuel, "fuel")
  validateModules(data.modules)
  if (data.qualities !== undefined) validateQualities(data.qualities)
  validateBeacon(data.beacon)
  if (data.recipe_productivity_research !== undefined) {
    validateRecipeProductivityResearch(data.recipe_productivity_research)
  }
  if (data.rocket_launch !== undefined) validateRocketLaunch(data.rocket_launch)
  requireArray(data.resources, "resources")
  if (data.plants !== undefined) validatePlants(data.plants)
  if (data.spoilage !== undefined) validateSpoilage(data.spoilage)
  if (data.planets !== undefined) validatePlanets(data.planets)
  requireRecord(data.groups, "groups")
  requireRecord(data.sprites, "sprites")
  // Validation above establishes the runtime dataset contract at this untrusted JSON boundary.
  return data as CalculatorData
}

// Stable sorting

export type SortKey = string | number | bigint | boolean

export function sorted<T>(collection: Iterable<T> | readonly T[], key?: (value: T) => SortKey): T[] {
  const values: T[] = Array.isArray(collection) ? [...collection] : Array.from(collection)
  const indexes = values.map((_, index) => index)
  const keyValues: readonly SortKey[] = key ? values.map(key) : values.map((value) => String(value))
  indexes.sort((a, b) => {
    const x = keyValues[a]!
    const y = keyValues[b]!
    if (x < y) {
      return -1
    }
    if (x > y) {
      return 1
    }
    return 0
  })
  return indexes.map((index) => values[index]!)
}

// Item search

const ITEM_SEARCH_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "electronic-circuit": ["green circuit", "green circuits", "green chip", "green chips"],
  "advanced-circuit": ["red circuit", "red circuits", "red chip", "red chips"],
  "processing-unit": ["blue circuit", "blue circuits", "blue chip", "blue chips"],

  "firearm-magazine": ["yellow magazine", "yellow magazines"],
  "piercing-rounds-magazine": ["red magazine", "red magazines"],
  "uranium-rounds-magazine": ["green magazine", "green magazines"],

  "automation-science-pack": ["red"],
  "logistic-science-pack": ["green"],
  "military-science-pack": ["grey", "gray", "black"],
  "chemical-science-pack": ["blue"],
  "production-science-pack": ["purple"],
  "utility-science-pack": ["yellow"],
  "space-science-pack": ["white"],
  "metallurgic-science-pack": ["orange"],
  "electromagnetic-science-pack": ["pink", "magenta"],
  "agricultural-science-pack": ["lime", "light green"],
  "cryogenic-science-pack": ["cyan", "light blue", "blue"],
  "promethium-science-pack": ["black", "dark blue", "dark purple"],

  "transport-belt": ["yellow belt", "yellow belts"],
  "fast-transport-belt": ["red belt", "red belts"],
  "express-transport-belt": ["blue belt", "blue belts"],
  "turbo-transport-belt": ["green belt", "green belts"],
  "underground-belt": ["yellow underground", "yellow underground belt", "yellow underground belts"],
  "fast-underground-belt": ["red underground", "red underground belt", "red underground belts"],
  "express-underground-belt": ["blue underground", "blue underground belt", "blue underground belts"],
  "turbo-underground-belt": ["green underground", "green underground belt", "green underground belts"],
  splitter: ["yellow splitter", "yellow splitters"],
  "fast-splitter": ["red splitter", "red splitters"],
  "express-splitter": ["blue splitter", "blue splitters"],
  "turbo-splitter": ["green splitter", "green splitters"],

  "low-density-structure": ["lds"],
  "construction-robot": ["construction bot", "construction bots", "conbot", "conbots"],
  "logistic-robot": ["logistic bot", "logistic bots", "logistics bot", "logistics bots", "logibot", "logibots"],
  "copper-cable": ["copper wire", "copper wires"],
  "iron-gear-wheel": ["gears"],
}

interface SearchableItem {
  key: string
  name: string
}

/**
 * Normalize punctuation and whitespace consistently for both queries and item
 * names. Keeping word boundaries supports token searches such as "fast belt",
 * while compact matching supports both "underground belt" and
 * "undergroundbelt".
 */
export function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function compactSearchText(value: string) {
  return normalizeSearchText(value).replace(/ /g, "")
}

export function itemMatchesSearch(item: SearchableItem, query: string) {
  const normalizedQuery = normalizeSearchText(query)
  if (normalizedQuery === "") {
    return true
  }

  const terms = [item.name, ...(ITEM_SEARCH_ALIASES[item.key] ?? [])]
  const normalizedTerms = terms.map(normalizeSearchText)
  const compactQuery = compactSearchText(normalizedQuery)

  // Preserve the original substring-search behavior after applying identical
  // normalization to the query and candidate text.
  if (normalizedTerms.some((term) => compactSearchText(term).includes(compactQuery))) {
    return true
  }

  // Also allow words to be separated by other words or span the official name
  // and an alias, e.g. "fast belt" or "red science".
  const queryTokens = normalizedQuery.split(" ")
  return queryTokens.every((token) => normalizedTerms.some((term) => term.includes(token)))
}

// Location display queries

interface LocationRecipeLike<TItem> {
  isNetProducer(item: TItem): boolean
}

interface LocationItemLike<TRecipe> {
  recipes: TRecipe[]
}

interface LocationLike<TRecipe> {
  key: string
  name: string
  order: string | number
  disable: Set<TRecipe>
}

interface LocationSpecificationLike<TItem, TRecipe, TLocation> {
  planets?: Map<string, TLocation> | null
  planetaryBaseline?: Set<TRecipe> | null
  ignore: Set<TItem>
  disable: Set<TRecipe>
  selectedPlanets: Iterable<TLocation>
}

function sortedLocations<TRecipe, TLocation extends LocationLike<TRecipe>>(
  locations: Iterable<TLocation>,
): TLocation[] {
  return [...locations].sort((a, b) => String(a.order).localeCompare(String(b.order)))
}

function locationName<TRecipe>(location: LocationLike<TRecipe>, indefinite = false) {
  if (indefinite && location.key === "space-platform") {
    return "a Space platform"
  }
  return location.name
}

export function formatLocationList<TRecipe>(
  locations: Iterable<LocationLike<TRecipe>>,
  conjunction = "or",
  indefinite = false,
): string {
  const names = [...locations].map((location) => locationName(location, indefinite))
  if (names.length === 0) {
    return ""
  }
  if (names.length === 1) {
    return names[0]!
  }
  if (names.length === 2) {
    return `${names[0]!} ${conjunction} ${names[1]!}`
  }
  return `${names.slice(0, -1).join(", ")}, ${conjunction} ${names[names.length - 1]!}`
}

export function getUnavailableLocationInfo<
  TItem extends LocationItemLike<TRecipe>,
  TRecipe extends LocationRecipeLike<TItem>,
  TLocation extends LocationLike<TRecipe>,
>(spec: LocationSpecificationLike<TItem, TRecipe, TLocation>, item: TItem) {
  const planets = spec.planets
  const planetaryBaseline = spec.planetaryBaseline
  if (!planets || planets.size <= 1 || !planetaryBaseline || spec.ignore.has(item)) {
    return null
  }

  const recipes = item.recipes.filter((recipe) => recipe.isNetProducer(item))
  if (recipes.length === 0 || recipes.some((recipe) => !spec.disable.has(recipe))) {
    return null
  }

  // Only show this message when the selected locations are the reason every
  // real production recipe is disabled. Manually-disabled recipes should not
  // be presented as a location problem.
  if (!recipes.every((recipe) => planetaryBaseline.has(recipe))) {
    return null
  }

  const allLocations = Array.from(planets.values())
  const compatibleLocations = sortedLocations(
    allLocations.filter((location) => recipes.some((recipe) => !location.disable.has(recipe))),
  )
  if (compatibleLocations.length === 0) {
    return null
  }

  return {
    selectedLocations: sortedLocations(spec.selectedPlanets),
    compatibleLocations,
  }
}
// endregion data.ts

// region math.ts
// Exact integer helpers

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  while (right !== 0n) {
    const remainder = left % right
    left = right
    right = remainder
  }
  return left
}

function removeCanadianGrouping(value: string): string {
  return value.replace(/,(?=\d{3}(?:,|\.\d|\/|\s|\+|$))/g, "")
}

export function formatCanadianNumber(value: string): string {
  return value.replace(
    /(^|[^\d.])(-?)(\d+)(?=\.|\/|\s|\+|$)/g,
    (_match, prefix: string, sign: string, digits: string) => {
      const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
      return `${prefix}${sign}${grouped}`
    },
  )
}

// Exact rational arithmetic

export class Rational {
  public readonly p: bigint
  public readonly q: bigint

  constructor(numerator: bigint, denominator: bigint) {
    let p = numerator
    let q = denominator
    if (q < 0n) {
      p = -p
      q = -q
    }
    if (p === 0n && q !== 0n) {
      this.p = 0n
      this.q = 1n
      return
    }
    if (q === 1n) {
      this.p = p
      this.q = q
      return
    }
    const gcd = greatestCommonDivisor(p < 0n ? -p : p, q)
    if (gcd > 1n) {
      p /= gcd
      q /= gcd
    }
    this.p = p
    this.q = q
  }

  toFloat(): number {
    return Number(this.p) / Number(this.q)
  }

  toString(): string {
    return this.q === 1n ? this.p.toString() : `${this.p}/${this.q}`
  }

  toDecimal(maxDigits = 3, roundingFactor: Rational | null = null): string {
    let digits = maxDigits ?? 3
    const rounding = roundingFactor ?? new Rational(5n, 10n ** BigInt(digits + 1))
    let sign = ""
    let value: Rational = this
    if (value.less(zero)) {
      sign = "-"
      value = zero.sub(value)
    }
    value = value.add(rounding)

    let quotient = value.p / value.q
    let remainder = value.p % value.q
    const integerPart = quotient.toString()
    let decimalPart = ""
    let roundingNumerator = rounding.p
    const roundingDenominator = rounding.q
    const equalsRounding = () => remainder * roundingDenominator === roundingNumerator * value.q

    while (digits > 0 && !equalsRounding()) {
      const scaledRemainder = remainder * 10n
      decimalPart += (scaledRemainder / value.q).toString()
      remainder = scaledRemainder % value.q
      roundingNumerator *= 10n
      digits--
    }
    if (equalsRounding()) {
      decimalPart = decimalPart.replace(/0+$/, "")
    }
    return decimalPart === "" ? sign + integerPart : `${sign}${integerPart}.${decimalPart}`
  }

  toUpDecimal(maxDigits = 3): string {
    let fraction = new Rational(1n, 10n ** BigInt(maxDigits))
    let { remainder } = this.divmod(fraction)
    let value = remainder.isZero() ? this : this.add(fraction)
    return value.toDecimal(maxDigits, zero)
  }

  toMixed(): string {
    const quotient = this.p / this.q
    const remainder = this.p % this.q
    if (quotient === 0n || remainder === 0n) {
      return this.toString()
    }
    return `${quotient} + ${remainder}/${this.q}`
  }

  isZero(): boolean {
    return this.p === 0n
  }

  isOne(): boolean {
    return this.p === 1n && this.q === 1n
  }

  isInteger(): boolean {
    return this.q === 1n
  }

  ceil(): Rational {
    const quotient = this.p / this.q
    const remainder = this.p % this.q
    const result = new Rational(quotient, 1n)
    return remainder === 0n ? result : result.add(one)
  }

  floor(): Rational {
    const quotient = this.p / this.q
    const remainder = this.p % this.q
    const result = new Rational(quotient, 1n)
    return result.less(zero) && remainder !== 0n ? result.sub(one) : result
  }

  equal(other: Rational): boolean {
    return this.p === other.p && this.q === other.q
  }

  less(other: Rational): boolean {
    return this.p * other.q < this.q * other.p
  }

  abs(): Rational {
    return this.less(zero) ? this.mul(minusOne) : this
  }

  add(other: Rational): Rational {
    if (this.isZero()) return other
    if (other.isZero()) return this
    if (this.q === other.q) {
      return new Rational(this.p + other.p, this.q)
    }
    return new Rational(this.p * other.q + this.q * other.p, this.q * other.q)
  }

  sub(other: Rational): Rational {
    if (other.isZero()) return this
    if (this.q === other.q) {
      return new Rational(this.p - other.p, this.q)
    }
    return new Rational(this.p * other.q - this.q * other.p, this.q * other.q)
  }

  subProduct(left: Rational, right: Rational): Rational {
    if (left.isZero() || right.isZero()) return this
    const productNumerator = left.p * right.p
    const productDenominator = left.q * right.q
    return new Rational(this.p * productDenominator - this.q * productNumerator, this.q * productDenominator)
  }

  mul(other: Rational): Rational {
    if (this.isZero() || other.isZero()) {
      return zero
    }
    if (this.isOne()) {
      return other
    }
    if (other.isOne()) {
      return this
    }
    return new Rational(this.p * other.p, this.q * other.q)
  }

  div(other: Rational): Rational {
    return new Rational(this.p * other.q, this.q * other.p)
  }

  divmod(other: Rational): { quotient: Rational; remainder: Rational } {
    let quotient = this.div(other).floor()
    return { quotient, remainder: this.sub(other.mul(quotient)) }
  }

  reciprocate(): Rational {
    return new Rational(this.q, this.p)
  }

  pow(exponent: number): Rational {
    return new Rational(this.p ** BigInt(exponent), this.q ** BigInt(exponent))
  }

  static max(a: Rational, b: Rational): Rational {
    return a.less(b) ? b : a
  }

  static min(a: Rational, b: Rational): Rational {
    return a.less(b) ? a : b
  }

  static from_decimal(value: string): Rational {
    value = removeCanadianGrouping(value)
    let decimalIndex = value.indexOf(".")
    if (decimalIndex === -1 || decimalIndex === value.length - 1) {
      return new Rational(BigInt(value), 1n)
    }
    let integerPart = new Rational(BigInt(value.slice(0, decimalIndex)), 1n)
    let numerator = BigInt(value.slice(decimalIndex + 1))
    let denominator = 10n ** BigInt(value.length - decimalIndex - 1)
    return integerPart.add(new Rational(numerator, denominator))
  }

  static from_string(value: string): Rational {
    value = removeCanadianGrouping(value)
    let slashIndex = value.indexOf("/")
    if (slashIndex === -1) {
      return Rational.from_decimal(value)
    }
    let plusIndex = value.indexOf("+")
    let denominator = BigInt(value.slice(slashIndex + 1))
    let numerator =
      plusIndex === -1
        ? BigInt(value.slice(0, slashIndex))
        : BigInt(value.slice(plusIndex + 1, slashIndex)) + BigInt(value.slice(0, plusIndex)) * denominator
    return new Rational(numerator, denominator)
  }

  static from_integer(value: number): Rational {
    return Rational.from_floats(value, 1)
  }

  static from_float(value: number): Rational {
    if (value === 0 || !Number.isFinite(value) || Number.isNaN(value)) {
      return zero
    }
    if (Number.isInteger(value)) {
      return Rational.from_integer(value)
    }
    let absolute = Math.abs(value)
    let exponent = Math.max(-1023, Math.floor(Math.log2(absolute)) + 1)
    let floatPart = absolute * 2 ** -exponent
    for (let i = 0; i < 300 && floatPart !== Math.floor(floatPart); i++) {
      floatPart *= 2
      exponent--
    }
    let numerator = BigInt(floatPart)
    let denominator = 1n
    if (exponent > 0) {
      numerator <<= BigInt(exponent)
    } else {
      denominator <<= BigInt(-exponent)
    }
    if (value < 0) {
      numerator = -numerator
    }
    return new Rational(numerator, denominator)
  }

  static from_float_approximate(value: number): Rational {
    if (Number.isInteger(value)) {
      return Rational.from_floats(value, 1)
    }
    let result = new Rational(BigInt(Math.round(value * 100000)), 100000n)
    let { quotient, remainder } = result.divmod(one)
    if (remainder.equal(_oneThirdApproximation)) {
      return quotient.add(oneThird)
    }
    if (remainder.equal(_twoThirdsApproximation)) {
      return quotient.add(twoThirds)
    }
    return result
  }

  static from_floats(numerator: number, denominator: number): Rational {
    return new Rational(BigInt(numerator), BigInt(denominator))
  }
}

const _oneThirdApproximation = new Rational(33333n, 100000n)
const _twoThirdsApproximation = new Rational(33333n, 50000n)

export const minusOne = new Rational(-1n, 1n)
export const zero = new Rational(0n, 1n)
export const one = new Rational(1n, 1n)
export const half = new Rational(1n, 2n)
export const oneThird = new Rational(1n, 3n)
export const twoThirds = new Rational(2n, 3n)

// Matrix arithmetic

/** Mutable M×N matrix backed by a row-major Rational array. */
export class Matrix {
  public readonly mat: Rational[]

  constructor(
    public readonly rows: number,
    public readonly cols: number,
    mat?: Rational[],
  ) {
    this.mat = mat ?? Array.from({ length: rows * cols }, () => zero)
  }

  toString(): string {
    let widths = Array.from({ length: this.cols }, (_, col) => {
      let width = 0
      for (let row = 0; row < this.rows; row++) {
        width = Math.max(width, this.index(row, col).toDecimal(3).length)
      }
      return width
    })
    let lines: string[] = []
    for (let row = 0; row < this.rows; row++) {
      let line: string[] = []
      for (let col = 0; col < this.cols; col++) {
        line.push(this.index(row, col).toDecimal(3).padStart(widths[col]!))
      }
      lines.push(line.join(" "))
    }
    return lines.join("\n")
  }

  copy(): Matrix {
    return new Matrix(this.rows, this.cols, this.mat.slice())
  }

  index(row: number, col: number): Rational {
    const value = this.mat[row * this.cols + col]
    if (value === undefined) {
      throw new RangeError(`Matrix index out of bounds: row ${row}, column ${col}`)
    }
    return value
  }

  setIndex(row: number, col: number, value: Rational): void {
    this.mat[row * this.cols + col] = value
  }

  addIndex(row: number, col: number, value: Rational): void {
    this.setIndex(row, col, this.index(row, col).add(value))
  }

  /** Multiply every positive element in a column in place. */
  mulPosColumn(col: number, value: Rational): void {
    for (let row = 0; row < this.rows; row++) {
      let current = this.index(row, col)
      if (zero.less(current)) {
        this.setIndex(row, col, current.mul(value))
      }
    }
  }

  mulRow(row: number, value: Rational): void {
    for (let col = 0; col < this.cols; col++) {
      this.setIndex(row, col, this.index(row, col).mul(value))
    }
  }

  appendColumn(column: readonly Rational[]): Matrix {
    if (column.length !== this.rows) {
      throw new Error(`Expected ${this.rows} column values, received ${column.length}`)
    }
    let mat: Rational[] = []
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        mat.push(this.index(row, col))
      }
      mat.push(column[row]!)
    }
    return new Matrix(this.rows, this.cols + 1, mat)
  }

  appendColumns(count: number): Matrix {
    let mat: Rational[] = []
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        mat.push(this.index(row, col))
      }
      for (let col = 0; col < count; col++) {
        mat.push(zero)
      }
    }
    return new Matrix(this.rows, this.cols + count, mat)
  }

  setColumn(col: number, column: readonly Rational[]): void {
    if (column.length !== this.rows) {
      throw new Error(`Expected ${this.rows} column values, received ${column.length}`)
    }
    for (let row = 0; row < this.rows; row++) {
      this.setIndex(row, col, column[row]!)
    }
  }

  zeroColumn(col: number): void {
    for (let row = 0; row < this.rows; row++) {
      this.setIndex(row, col, zero)
    }
  }

  zeroRow(row: number): void {
    for (let col = 0; col < this.cols; col++) {
      this.setIndex(row, col, zero)
    }
  }

  swapRows(left: number, right: number): void {
    for (let col = 0; col < this.cols; col++) {
      let temp = this.index(left, col)
      this.setIndex(left, col, this.index(right, col))
      this.setIndex(right, col, temp)
    }
  }

  /** Reduce the matrix in place and return pivot column indexes. */
  rref(): number[] {
    let pivotRow = 0
    let pivotCol = 0
    let pivots: number[] = []
    while (pivotCol < this.cols && pivotRow < this.rows) {
      let pivotValue = zero
      let pivotOffset = 0
      for (; pivotOffset < this.rows - pivotRow; pivotOffset++) {
        pivotValue = this.index(pivotRow + pivotOffset, pivotCol)
        if (!pivotValue.isZero()) {
          break
        }
      }
      if (pivotOffset === this.rows - pivotRow) {
        pivotCol++
        continue
      }
      pivots.push(pivotCol)
      if (pivotOffset !== 0) {
        this.swapRows(pivotRow, pivotRow + pivotOffset)
      }
      for (let row = 0; row < this.rows; row++) {
        if (row === pivotRow) {
          continue
        }
        let value = this.index(row, pivotCol)
        if (value.isZero()) {
          continue
        }
        for (let col = 0; col < this.cols; col++) {
          let next = pivotValue.mul(this.index(row, col)).sub(value.mul(this.index(pivotRow, col)))
          this.setIndex(row, col, next)
        }
      }
      pivotRow++
    }
    for (let row = 0; row < pivots.length; row++) {
      let col = pivots[row]!
      let pivotValue = this.index(row, col)
      this.setIndex(row, col, one)
      for (let nextCol = col + 1; nextCol < this.cols; nextCol++) {
        this.setIndex(row, nextCol, this.index(row, nextCol).div(pivotValue))
      }
    }
    return pivots
  }
}

// Simplex primitive

function pivot(tableau: Matrix, row: number, col: number): void {
  let pivotValue = tableau.index(row, col)
  const pivotColumns: number[] = []
  for (let currentCol = 0; currentCol < tableau.cols; currentCol++) {
    if (currentCol === col) {
      tableau.setIndex(row, currentCol, one)
      continue
    }
    const value = tableau.index(row, currentCol)
    if (value.isZero()) continue
    tableau.setIndex(row, currentCol, value.div(pivotValue))
    pivotColumns.push(currentCol)
  }
  for (let otherRow = 0; otherRow < tableau.rows; otherRow++) {
    if (otherRow === row) {
      continue
    }
    let ratio = tableau.index(otherRow, col)
    if (ratio.isZero()) {
      continue
    }
    tableau.setIndex(otherRow, col, zero)
    for (const currentCol of pivotColumns) {
      let next = tableau.index(otherRow, currentCol).subProduct(tableau.index(row, currentCol), ratio)
      tableau.setIndex(otherRow, currentCol, next)
    }
  }
}

function pivotColumn(tableau: Matrix, col: number): number | null {
  let bestRatio: Rational | null = null
  let bestRow: number | null = null
  for (let row = 0; row < tableau.rows - 1; row++) {
    let coefficient = tableau.index(row, col)
    if (!zero.less(coefficient)) {
      continue
    }
    let ratio = tableau.index(row, tableau.cols - 1).div(coefficient)
    if (bestRatio === null || ratio.less(bestRatio)) {
      bestRatio = ratio
      bestRow = row
    }
  }
  if (bestRow !== null) {
    pivot(tableau, bestRow, col)
  }
  return bestRow
}

/** Solve a canonical simplex tableau in place. */
export function simplex(tableau: Matrix): void {
  while (true) {
    let minimum: Rational | null = null
    let minimumColumn: number | null = null
    for (let col = 0; col < tableau.cols - 1; col++) {
      let value = tableau.index(tableau.rows - 1, col)
      if (minimum === null || value.less(minimum)) {
        minimum = value
        minimumColumn = col
      }
    }
    if (minimum === null || minimumColumn === null || !minimum.less(zero)) {
      return
    }
    if (pivotColumn(tableau, minimumColumn) === null) {
      throw new Error("Simplex tableau is unbounded for the selected pivot column")
    }
  }
}

// Display formatting

export const DEFAULT_RATE = "m"
export const DEFAULT_RATE_PRECISION = 3
export const DEFAULT_COUNT_PRECISION = 1
export const DEFAULT_FORMAT = "decimal"

export type DisplayRate = "s" | "m" | "h"
export type DisplayFormat = "decimal" | "rational"

const displayRates = new Map<DisplayRate, Rational>([
  ["s", one],
  ["m", Rational.from_float(60)],
  ["h", Rational.from_float(3600)],
])

export const longRateNames = new Map<DisplayRate, string>([
  ["s", "second"],
  ["m", "minute"],
  ["h", "hour"],
])

export class Formatter {
  rateName: DisplayRate = DEFAULT_RATE
  longRate = longRateNames.get(DEFAULT_RATE)!
  rateFactor = displayRates.get(DEFAULT_RATE)!
  displayFormat: DisplayFormat = DEFAULT_FORMAT
  ratePrecision = DEFAULT_RATE_PRECISION
  countPrecision = DEFAULT_COUNT_PRECISION

  setDisplayRate(rate: DisplayRate): void {
    this.rateName = rate
    this.longRate = longRateNames.get(rate)!
    this.rateFactor = displayRates.get(rate)!
  }

  private align(value: string, precision: number): string {
    if (this.displayFormat === "rational") {
      return value
    }
    let decimalIndex = value.indexOf(".")
    if (decimalIndex === -1) {
      decimalIndex = value.length
    }
    let padding = precision - value.length + decimalIndex + (precision > 0 ? 1 : 0)
    return value + "\u00A0".repeat(Math.max(0, padding))
  }

  rate(rate: Rational): string {
    let scaled = rate.mul(this.rateFactor)
    const value = this.displayFormat === "rational" ? scaled.toMixed() : scaled.toDecimal(this.ratePrecision)
    return formatCanadianNumber(value)
  }

  alignRate(rate: Rational): string {
    return this.align(this.rate(rate), this.ratePrecision)
  }

  count(count: Rational): string {
    const value = this.displayFormat === "rational" ? count.toMixed() : count.toUpDecimal(this.countPrecision)
    return formatCanadianNumber(value)
  }

  alignCount(count: Rational): string {
    return this.align(this.count(count), this.countPrecision)
  }
}

// Power formatting

const powerSuffixes = ["W", "kW", "MW", "GW", "TW", "PW"] as const

export function powerRepresentation(value: Rational): { power: Rational; suffix: string } {
  let thousand = Rational.from_float(1000)
  let power = value
  let suffixIndex = 0
  while (thousand.less(power) && suffixIndex < powerSuffixes.length - 1) {
    power = power.div(thousand)
    suffixIndex++
  }
  return { power, suffix: powerSuffixes[suffixIndex]! }
}
// endregion math.ts

// region solver/contracts.ts
/**
 * A normalized item amount used by recipes and solver graph edges.
 *
 * The core intentionally keeps `item` generic: the solver only relies on
 * stable item identity, while the browser domain layer supplies the concrete
 * item model.
 */
export class Ingredient<TItem = unknown, TAmount = unknown> {
  constructor(
    public readonly item: TItem,
    public readonly amount: TAmount,
    public readonly productivityAmount: TAmount | null = null,
  ) {}
}

export interface SolverIngredient {
  item: SolverItem
  amount: Rational
  productivityAmount?: Rational | null
}

export interface SolverRecipe {
  key?: string
  name: string
  ingredients: readonly SolverIngredient[]
  products: readonly SolverIngredient[]
  getIngredients(): readonly SolverIngredient[]
  gives(item: SolverItem): Rational
  isReal(): boolean
  isDisable?(): boolean
  isResource?(): boolean
}

export interface SolverItem {
  key?: string
  name?: string
  recipes: SolverRecipe[]
  uses: SolverRecipe[]
  disableRecipe: SolverRecipe
}

export interface SolverTarget {
  item: SolverItem
  recipe: SolverRecipe | null
  changedBuilding: boolean
}

export interface SolverPriorityEntry {
  recipe: SolverRecipe
  weight: Rational
}

export interface SolverBuilding {
  fuel: string | null
}

export interface SolverFuel {
  item: SolverItem
}

export interface SolverSpec {
  ignore: Set<SolverItem>
  buildTargets: SolverTarget[]
  priority: Iterable<Iterable<SolverPriorityEntry>>
  getRecipes(item: SolverItem): SolverRecipe[]
  getRecipeGraph(items: Map<SolverItem, Rational>): Set<SolverRecipe>
  getProdEffect(recipe: SolverRecipe): Rational
  getBuilding(recipe: SolverRecipe): SolverBuilding | null
  getFuelForRecipe(recipe: SolverRecipe): SolverFuel | null
}

export interface SolverOutput {
  item: SolverItem
  rate: Rational
  recipe: SolverRecipe | null
}
// endregion solver/contracts.ts

// region solver/errors.ts
export class SolverFailure extends Error {
  readonly code: "missing-recipe" | "infeasible"
  readonly item: SolverItem | null

  constructor(code: "missing-recipe" | "infeasible", message: string, item: SolverItem | null = null) {
    super(message)
    this.name = "SolverFailure"
    this.code = code
    this.item = item
  }
}
// endregion solver/errors.ts

// region solver.ts
// Cycle detection

function fuelConsumers(spec: SolverSpec, recipes: Set<SolverRecipe>, item: SolverItem): SolverRecipe[] {
  return [...recipes].filter((recipe) => spec.getFuelForRecipe(recipe)?.item === item)
}

function neighboringRecipes(
  spec: SolverSpec,
  recipes: Set<SolverRecipe>,
  recipe: SolverRecipe,
  invert: boolean,
): Set<SolverRecipe> {
  let result = new Set<SolverRecipe>()
  let itemAmounts = invert ? recipe.products : recipe.getIngredients()
  for (let { item } of itemAmounts) {
    let candidates: SolverRecipe[] = invert ? item.uses : item.recipes
    if (invert) {
      candidates = candidates.concat(fuelConsumers(spec, recipes, item))
    }
    for (let candidate of candidates) {
      if (recipes.has(candidate)) {
        result.add(candidate)
      }
    }
  }
  return result
}

function effectiveProductAmount(spec: SolverSpec, recipe: SolverRecipe, product: SolverIngredient): Rational {
  let productivity = spec.getProdEffect(recipe)
  if (!one.less(productivity)) {
    return product.amount
  }

  let productivityAmount = product.productivityAmount ?? null
  if (productivityAmount === null) {
    productivityAmount = product.amount
    for (let ingredient of recipe.getIngredients()) {
      if (ingredient.item === product.item) {
        productivityAmount = productivityAmount.sub(ingredient.amount)
      }
    }
    if (productivityAmount.less(zero)) {
      return product.amount
    }
  }

  return product.amount.add(productivityAmount.mul(productivity.sub(one)))
}

function visit(
  spec: SolverSpec,
  recipes: Set<SolverRecipe>,
  recipe: SolverRecipe,
  seen: Set<SolverRecipe>,
  invert: boolean,
): SolverRecipe[] {
  if (seen.has(recipe)) {
    return []
  }
  seen.add(recipe)
  let result: SolverRecipe[] = []
  for (let neighbor of neighboringRecipes(spec, recipes, recipe, invert)) {
    result.push(...visit(spec, recipes, neighbor, seen, invert))
  }
  result.push(recipe)
  return result
}

function isSelfCycle(component: readonly SolverRecipe[]): boolean {
  const recipe = component[0]
  if (recipe === undefined) return false
  let products = new Set<SolverItem>(recipe.products.map(({ item }) => item))
  return recipe.getIngredients().some(({ item }) => products.has(item))
}

export function getCycleRecipes(spec: SolverSpec, recipes: Set<SolverRecipe>): Set<SolverRecipe> {
  let seen = new Set<SolverRecipe>()
  let ordered: SolverRecipe[] = []
  for (let recipe of recipes) {
    ordered.push(...visit(spec, recipes, recipe, seen, false))
  }

  let result = new Set<SolverRecipe>()
  seen = new Set<SolverRecipe>()
  for (let index = ordered.length - 1; index >= 0; index--) {
    const root = ordered[index]
    if (root === undefined) continue
    if (seen.has(root)) {
      continue
    }
    let component = visit(spec, recipes, root, seen, true)
    if (component.length > 1 || isSelfCycle(component)) {
      for (let recipe of component) {
        result.add(recipe)
      }
    }
  }
  return result
}

// Solver totals

function addRate<TKey>(map: Map<TKey, Rational>, key: TKey, rate: Rational): void {
  map.set(key, (map.get(key) ?? zero).add(rate))
}

function setNested<TKey1, TKey2>(
  map: Map<TKey1, Map<TKey2, Rational>>,
  key1: TKey1,
  key2: TKey2,
  value: Rational,
): void {
  let nested = map.get(key1)
  if (nested === undefined) {
    nested = new Map<TKey2, Rational>()
    map.set(key1, nested)
  }
  nested.set(key2, value)
}

export interface ProportionateLink {
  item: SolverItem
  from: SolverRecipe
  to: SolverRecipe
  rate: Rational
  fuel: boolean
}

export class Totals {
  readonly items = new Map<SolverItem, Rational>()
  readonly producers = new Map<SolverItem, Map<SolverRecipe, Rational>>()
  readonly consumers = new Map<SolverItem, Map<SolverRecipe, Rational>>()
  readonly proportionate: ProportionateLink[] = []

  constructor(
    spec: SolverSpec,
    public readonly products: Map<SolverItem, Rational>,
    public readonly rates: Map<SolverRecipe, Rational>,
    public readonly surplus: Map<SolverItem, Rational>,
    public readonly extra: Map<SolverItem, SolverRecipe>,
  ) {
    for (let [recipe, rate] of rates) {
      for (let ingredient of recipe.getIngredients()) {
        let itemRate = rate.mul(ingredient.amount)
        setNested(this.consumers, ingredient.item, recipe, itemRate)
        addRate(this.items, ingredient.item, itemRate)
      }
      for (let product of recipe.products) {
        setNested(this.producers, product.item, recipe, rate.mul(recipe.gives(product.item)))
      }
    }

    for (let [recipe, recipeRate] of rates) {
      let ingredients = recipe.getIngredients()
      for (let index = 0; index < ingredients.length; index++) {
        const ingredient = ingredients[index]
        if (ingredient === undefined) continue
        let totalRate = this.items.get(ingredient.item)
        if (totalRate === undefined || totalRate.isZero()) {
          continue
        }
        let ratio = recipeRate.mul(ingredient.amount).div(totalRate)
        let sourceRecipes = spec.getRecipes(ingredient.item)
        let extraRecipe = extra.get(ingredient.item)
        if (extraRecipe !== undefined) {
          sourceRecipes.push(extraRecipe)
        }
        for (let sourceRecipe of sourceRecipes) {
          let sourceRate = rates.get(sourceRecipe)
          if (sourceRate === undefined) {
            continue
          }
          this.proportionate.push({
            item: ingredient.item,
            from: sourceRecipe,
            to: recipe,
            rate: sourceRate.mul(sourceRecipe.gives(ingredient.item)).mul(ratio),
            fuel: index >= recipe.ingredients.length,
          })
        }
      }
    }
  }
}

function requireMapValue<TKey, TValue>(map: ReadonlyMap<TKey, TValue>, key: TKey, label: string): TValue {
  const value = map.get(key)
  if (value === undefined) throw new Error(`Missing ${label}`)
  return value
}

// Factory solver

class OutputRecipe implements SolverRecipe {
  readonly name: string = "output"
  readonly products: readonly Ingredient<SolverItem, Rational>[] = []
  readonly ingredients: readonly Ingredient<SolverItem, Rational>[]

  constructor(outputs: Iterable<[SolverItem, Rational]>) {
    this.ingredients = [...outputs].map(([item, rate]) => new Ingredient(item, rate))
  }

  getIngredients(): readonly Ingredient<SolverItem, Rational>[] {
    return this.ingredients
  }

  gives(_item: SolverItem): Rational {
    return zero
  }

  isReal(): boolean {
    return false
  }
}

class SurplusRecipe extends OutputRecipe {
  override readonly name = "surplus"
}

interface UnfinishedTarget {
  item: SolverItem
  rate: Rational
  recipe: SolverRecipe
}

class PartialResult {
  readonly recipeRates = new Map<SolverRecipe, Rational>()
  readonly remaining = new Map<SolverItem, Rational>()
  targets: UnfinishedTarget[] = []

  add(recipe: SolverRecipe, rate: Rational): void {
    this.recipeRates.set(recipe, (this.recipeRates.get(recipe) ?? zero).add(rate))
  }

  remainder(item: SolverItem, rate: Rational): void {
    this.remaining.set(item, (this.remaining.get(item) ?? zero).add(rate))
  }

  unfinishedTarget(item: SolverItem, rate: Rational, recipe: SolverRecipe): void {
    this.targets.push({ item, rate, recipe })
  }

  combine(other: PartialResult): void {
    for (let [recipe, rate] of other.recipeRates) {
      this.add(recipe, rate)
    }
    for (let [item, rate] of other.remaining) {
      this.remainder(item, rate)
    }
    this.targets.push(...other.targets)
  }
}

function traverse(
  spec: SolverSpec,
  cyclic: Set<SolverRecipe>,
  item: SolverItem,
  rate: Rational,
  forcedRecipe: SolverRecipe | null = null,
): PartialResult {
  let result = new PartialResult()
  let recipe = forcedRecipe
  if (recipe === null) {
    let itemRecipes = spec.getRecipes(item)
    if (itemRecipes.length === 0) {
      throw new SolverFailure(
        "missing-recipe",
        `No enabled production recipe can make ${item.name ?? item.key ?? "unknown item"}.`,
        item,
      )
    }
    const onlyRecipe = itemRecipes[0]
    if (onlyRecipe === undefined) {
      throw new SolverFailure(
        "missing-recipe",
        `No enabled production recipe can make ${item.name ?? item.key ?? "unknown item"}.`,
        item,
      )
    }
    if (itemRecipes.length > 1 || onlyRecipe.products.length > 1 || cyclic.has(onlyRecipe)) {
      result.remainder(item, rate)
      return result
    }
    recipe = onlyRecipe
  } else if (recipe.products.length > 1 || cyclic.has(recipe)) {
    result.remainder(item, rate)
    result.unfinishedTarget(item, rate, recipe)
    return result
  }

  let recipeRate = rate.div(recipe.gives(item))
  result.add(recipe, recipeRate)
  if (spec.ignore.has(item)) {
    return result
  }
  for (let ingredient of recipe.getIngredients()) {
    result.combine(traverse(spec, cyclic, ingredient.item, recipeRate.mul(ingredient.amount)))
  }
  return result
}

function recursiveSolve(spec: SolverSpec, cyclic: Set<SolverRecipe>, outputs: readonly SolverOutput[]): PartialResult {
  let result = new PartialResult()
  for (let { item, rate, recipe } of outputs) {
    result.combine(traverse(spec, cyclic, item, rate, recipe))
  }
  return result
}

function mergeOutputs(outputs: readonly SolverOutput[]): Map<SolverItem, Rational> {
  let merged = new Map<SolverItem, Rational>()
  for (let { item, rate } of outputs) {
    merged.set(item, (merged.get(item) ?? zero).add(rate))
  }
  return merged
}

/** Solve target outputs into recipe rates and proportional material flows. */
export function solve(spec: SolverSpec, fullOutputs: readonly SolverOutput[]): Totals {
  let outputs = mergeOutputs(fullOutputs)
  let recipes = spec.getRecipeGraph(outputs)
  let cyclic = getCycleRecipes(spec, recipes)
  let partialSolution = recursiveSolve(spec, cyclic, fullOutputs)
  let solution = partialSolution.recipeRates
  if (partialSolution.remaining.size === 0) {
    solution.set(new OutputRecipe(outputs), one)
    return new Totals(spec, outputs, solution, new Map(), new Map())
  }

  recipes = spec.getRecipeGraph(partialSolution.remaining)

  let targetItemMap = new Map<SolverItem, SolverRecipe>()
  for (let target of spec.buildTargets) {
    if (target.changedBuilding && target.recipe !== null) {
      targetItemMap.set(target.item, target.recipe)
    }
  }

  let maxPriorityRecipes = new Map<SolverItem, SolverRecipe>()
  for (let recipe of recipes) {
    if (!cyclic.has(recipe)) {
      continue
    }
    for (let { item } of recipe.getIngredients()) {
      if (recipes.has(item.disableRecipe)) {
        continue
      }
      let candidate = item.recipes.some((subrecipe) => cyclic.has(subrecipe))
      let outside = item.recipes.some((subrecipe) => !cyclic.has(subrecipe) && recipes.has(subrecipe))
      if (candidate && (targetItemMap.has(item) || !outside)) {
        maxPriorityRecipes.set(item, item.disableRecipe)
      }
    }
  }
  for (let recipe of maxPriorityRecipes.values()) {
    recipes.add(recipe)
  }

  let products = new Set<SolverItem>()
  let items: SolverItem[] = []
  let itemColumns = new Map<SolverItem, number>()
  let recipeArray: SolverRecipe[] = []
  let recipeRows = new Map<SolverRecipe, number>()
  for (let recipe of recipes) {
    recipeRows.set(recipe, recipeArray.length)
    recipeArray.push(recipe)
    for (let product of recipe.products) {
      if (!products.has(product.item)) {
        itemColumns.set(product.item, items.length)
        items.push(product.item)
      }
      products.add(product.item)
    }
  }

  let columns = items.length + partialSolution.targets.length + recipeArray.length + 3
  let rows = recipeArray.length + 2
  let tableau = new Matrix(rows, columns)
  let taxColumn = items.length + partialSolution.targets.length

  for (let [row, recipe] of recipeArray.entries()) {
    for (let product of recipe.products) {
      tableau.setIndex(
        row,
        requireMapValue(itemColumns, product.item, "product item column"),
        effectiveProductAmount(spec, recipe, product),
      )
    }
    for (let ingredient of recipe.getIngredients()) {
      tableau.addIndex(
        row,
        requireMapValue(itemColumns, ingredient.item, "ingredient item column"),
        zero.sub(ingredient.amount),
      )
    }
    tableau.setIndex(row, taxColumn, minusOne)
    tableau.setIndex(row, taxColumn + row + 1, one)
  }

  for (let [index, target] of partialSolution.targets.entries()) {
    const row = requireMapValue(recipeRows, target.recipe, "target recipe row")
    let col = items.length + index
    const itemCol = requireMapValue(itemColumns, target.item, "target item column")
    tableau.setIndex(row, col, tableau.index(row, itemCol))
    tableau.setIndex(rows - 1, col, zero.sub(target.rate))
  }

  tableau.setIndex(rows - 2, taxColumn, one)
  tableau.setIndex(rows - 1, columns - 2, one)

  for (let [item, rate] of partialSolution.remaining) {
    tableau.setIndex(rows - 1, requireMapValue(itemColumns, item, "remaining item column"), zero.sub(rate))
  }

  let minimum: Rational | null = null
  let maximum = zero
  for (let coefficient of tableau.mat) {
    if (coefficient.isZero()) {
      continue
    }
    let absolute = coefficient.abs()
    if (minimum === null || absolute.less(minimum)) {
      minimum = absolute
    }
    if (maximum.less(absolute)) {
      maximum = absolute
    }
  }
  if (minimum === null) {
    throw new Error("Cannot solve an empty recipe tableau")
  }
  let two = Rational.from_float(2)
  let costRatio = maximum.div(minimum).mul(two)
  if (costRatio.less(two)) {
    costRatio = two
  }
  tableau.setIndex(rows - 2, columns - 1, one)
  let priorityCost = costRatio
  for (let level of spec.priority) {
    let normalizedTotal = zero
    let minimumWeight: Rational | null = null
    for (let { weight } of level) {
      if (minimumWeight === null || weight.less(minimumWeight)) {
        minimumWeight = weight
      }
    }
    if (minimumWeight === null) {
      continue
    }
    for (let { recipe, weight } of level) {
      let row = recipeRows.get(recipe)
      if (row === undefined) {
        continue
      }
      let normalizedWeight = weight.div(minimumWeight)
      normalizedTotal = normalizedTotal.add(normalizedWeight)
      tableau.setIndex(row, columns - 1, priorityCost.mul(normalizedWeight))
    }
    if (!normalizedTotal.isZero()) {
      priorityCost = priorityCost.mul(costRatio).mul(normalizedTotal)
    }
  }
  for (let recipe of maxPriorityRecipes.values()) {
    tableau.setIndex(requireMapValue(recipeRows, recipe, "priority recipe row"), columns - 1, priorityCost)
  }

  try {
    simplex(tableau)
  } catch {
    throw new SolverFailure(
      "infeasible",
      "This combination of recipes and resource priorities cannot produce every requested output.",
    )
  }
  for (let [row, recipe] of recipeArray.entries()) {
    let rate = tableau.index(tableau.rows - 1, taxColumn + row + 1)
    if (zero.less(rate)) {
      solution.set(recipe, (solution.get(recipe) ?? zero).add(rate))
    }
  }
  solution.set(new OutputRecipe(outputs), one)

  let surplus = new Map<SolverItem, Rational>()
  for (let [index, item] of items.entries()) {
    let rate = tableau.index(tableau.rows - 1, index)
    if (zero.less(rate)) {
      surplus.set(item, rate)
    }
  }
  if (surplus.size > 0) {
    solution.set(new SurplusRecipe(surplus), one)
  }
  return new Totals(spec, outputs, solution, surplus, maxPriorityRecipes)
}
// endregion solver.ts

// region presentation.ts
// Tooltips

interface TooltipRegistryEntry {
  readonly reference: Element
  destroy(): void
}

let textTooltipDelegate: DelegateInstance | null = null
const tooltipRegistry = new Set<TooltipRegistryEntry>()

function formatTooltipText(value: string): string {
  return value.replace(/\s*·\s*/g, "\n").replace(/\. (?=\S)/g, ".\n")
}

function tooltipProps(): Partial<Props> {
  return {
    appendTo: () => document.body,
    arrow: false,
    delay: [100, 0] as [number, number],
    duration: [120, 80] as [number, number],
    maxWidth: 420,
    offset: [0, 4] as [number, number],
    theme: "factorio",
  }
}

export function initializeTooltips(): void {
  if (textTooltipDelegate !== null) {
    return
  }
  textTooltipDelegate = delegate(document.body, {
    ...tooltipProps(),
    target: "[data-tooltip]",
    content: (reference) => formatTooltipText(reference.getAttribute("data-tooltip") ?? ""),
    onTrigger(instance) {
      instance.setContent(formatTooltipText(instance.reference.getAttribute("data-tooltip") ?? ""))
    },
  })
}

export function makePopover(reference: HTMLElement, content: string | Element, props: Partial<Props> = {}): Instance {
  let { onShow, ...popoverProps } = props
  let instance = tippy(reference, {
    ...tooltipProps(),
    content,
    interactive: true,
    trigger: "click",
    ...popoverProps,
    onShow(instance) {
      hideAll({ exclude: instance })
      return onShow?.(instance)
    },
  })
  tooltipRegistry.add(instance)
  return instance
}

export class Tooltip implements TooltipRegistryEntry {
  private instance: Instance | null = null
  private content: HTMLElement | null = null
  private removed = false
  private readonly activate: () => void

  constructor(
    readonly reference: HTMLElement,
    private readonly callback: () => HTMLElement,
    private readonly target: HTMLElement = reference,
  ) {
    this.activate = () => {
      this.ensureInstance()?.show()
    }
    reference.addEventListener("pointerenter", this.activate)
    reference.addEventListener("focus", this.activate)
    reference.addEventListener("touchstart", this.activate, { passive: true })
    tooltipRegistry.add(this)
  }

  private ensureInstance(): Instance | null {
    if (this.removed) {
      return null
    }
    if (this.instance !== null) {
      return this.instance
    }
    this.reference.removeEventListener("pointerenter", this.activate)
    this.reference.removeEventListener("focus", this.activate)
    this.reference.removeEventListener("touchstart", this.activate)
    this.instance = tippy(this.reference, {
      ...tooltipProps(),
      content: " ",
      ...(this.target === this.reference ? {} : { getReferenceClientRect: () => this.target.getBoundingClientRect() }),
      placement: "right-start",
      onShow: (instance) => {
        if (this.content === null) {
          this.content = this.callback()
          instance.setContent(this.content)
        }
      },
    })
    return this.instance
  }

  destroy(): void {
    if (this.removed) {
      return
    }
    this.removed = true
    tooltipRegistry.delete(this)
    this.reference.removeEventListener("pointerenter", this.activate)
    this.reference.removeEventListener("focus", this.activate)
    this.reference.removeEventListener("touchstart", this.activate)
    this.instance?.destroy()
    this.instance = null
  }

  remove(): void {
    this.destroy()
  }
}

export function reapTooltips(): void {
  for (let instance of tooltipRegistry) {
    if (!document.body.contains(instance.reference)) {
      tooltipRegistry.delete(instance)
      instance.destroy()
    }
  }
}

// Icons and sprite sheet

export const PX_WIDTH = 32
export const PX_HEIGHT = 32

// An object representing an icon of an item, recipe, belt, building, or
// whatever else.
//
// Args:
//   obj: The object which this icon will represent. If it provides a
//        renderTooltip() method, this will be used to make a tooltip on the
//        icon available.
//   name: The filename of the image to use. If not provided, defaults to
//         obj.name.
export interface IconObject {
  readonly name: string
  readonly icon_col: number
  readonly icon_row: number
  renderTooltip?(): HTMLElement
}

export class Icon {
  readonly name: string

  constructor(
    readonly obj: IconObject,
    name?: string,
  ) {
    this.name = name ?? obj.name
  }
  // Creates a new <img> node.
  //
  // Args:
  //   size: The width and height of the (square) image, in pixels. If null
  //         or not given, the size will not be set in the markup (and should
  //         probably be set in the style sheet).
  //   suppressTooltip: If true, a tooltip will not be added to this image.
  //   target: The reference node next to which any tooltip will be rendered.
  //           If not provided, defaults to the image itself.
  make(size = 32, suppressTooltip = false, target?: HTMLElement): HTMLImageElement {
    let x = -this.obj.icon_col * PX_WIDTH
    let y = -this.obj.icon_row * PX_HEIGHT
    let img = select(makeEmptyIcon(size))
      .classed("icon", true)
      .style("background", "url(images/sprite-sheet-" + sheetHash + ".webp)")
    if (size !== 32) {
      let ratio = size / 32
      x *= ratio
      y *= ratio
      let width = sheetWidth * ratio
      let height = sheetHeight * ratio
      img.style("background-size", `${width}px ${height}px`)
    }
    img.style("background-position", `${x}px ${y}px`)
    if (!suppressTooltip) {
      if (this.obj.renderTooltip) {
        let self = this
        const image = requirePresentationNode(img.node(), "icon image")
        new Tooltip(image, () => self.obj.renderTooltip!(), target ?? image)
      } else {
        img.attr("data-tooltip", this.obj.name)
      }
    }
    img.attr("alt", this.name)
    return requirePresentationNode(img.node(), "icon image") as HTMLImageElement
  }
}

export interface QualityIconTier {
  readonly key: string
  readonly name: string
  readonly icon: Icon
}

export interface QualityIconOptions {
  readonly label: string
  readonly tooltip?: string | (() => HTMLElement) | null
  readonly badgeTitle?: string
}

export function makeQualityIcon(
  baseIcon: Icon,
  quality: QualityIconTier | null,
  options: QualityIconOptions,
): HTMLSpanElement {
  const wrapper = create("span")
    .classed("quality-icon", true)
    .attr("role", "img")
    .attr("aria-label", options.label)
    .attr("data-quality", quality?.key ?? null)
  wrapper.append(() => baseIcon.make(32, true)).attr("aria-hidden", "true")

  if (quality !== null && quality.key !== "normal") {
    wrapper
      .append(() => quality.icon.make(16, true))
      .classed("equipment-quality-badge", true)
      .attr("data-quality", quality.key)
      .attr("title", options.badgeTitle ?? `${quality.name} quality`)
      .attr("aria-hidden", "true")
  }

  const node = requirePresentationNode(wrapper.node(), "quality icon")
  const tooltip = options.tooltip === undefined ? options.label : options.tooltip
  if (typeof tooltip === "string") {
    wrapper.attr("data-tooltip", tooltip)
  } else if (tooltip !== null) {
    new Tooltip(node, tooltip)
  }
  return node
}

export function makeEmptyIcon(size?: number): HTMLImageElement {
  let img = create("img")
    .classed("icon", true)
    // Chrome wants the <img> element to have a src attribute, or it will
    // draw a border around it. Cram in this transparent 1x1 pixel image.
    .attr("src", "images/pixel.gif")
  if (size) {
    img.attr("width", size).attr("height", size)
  }
  return requirePresentationNode(img.node(), "empty icon") as HTMLImageElement
}

export class Sprite implements IconObject {
  readonly icon: Icon
  constructor(
    readonly name: string,
    readonly icon_col: number,
    readonly icon_row: number,
  ) {
    this.icon = new Icon(this)
  }
}

export let sprites = new Map<string, Sprite>()
export let sheetHash = ""
export let sheetWidth = 0
export let sheetHeight = 0

export function getSprites(data: CalculatorData): void {
  sheetHash = data.sprites.hash
  sheetWidth = data.sprites.width
  sheetHeight = data.sprites.height
  sprites = new Map<string, Sprite>()
  for (const [name, d] of Object.entries(data.sprites.extra)) {
    sprites.set(name, new Sprite(d.name, d.icon_col, d.icon_row))
  }
}

// Dropdown primitives

interface DropdownInstance extends TooltipRegistryEntry {
  readonly state: { readonly isVisible: boolean }
  show(): void
  hide(): void
}

interface DropdownState {
  readonly dropdownNode: HTMLElement
  readonly instance: DropdownInstance
  readonly spacerNode: HTMLElement
  readonly wrapperNode: HTMLElement
}

type D3Selection = Selection<HTMLElement, unknown, null, undefined>
type DropdownLifecycle = ((selection: D3Selection) => void) | null
const dropdownLocal = local<DropdownState>()

export function closeDropdowns(): void {
  hideAll()
}

function toggleDropdown(this: HTMLElement): void {
  const state = dropdownLocal.get(this)
  if (state === undefined) return
  const { instance } = state
  if (instance.state.isVisible) {
    instance.hide()
  } else {
    instance.show()
  }
}

// Appends a dropdown to the selection, and returns a selection over the div
// for the content of the dropdown.
export function makeDropdown<GElement extends BaseType, TDatum, PElement extends BaseType, PDatum>(
  selector: Selection<GElement, TDatum, PElement, PDatum>,
  onOpen: DropdownLifecycle = null,
  onClose: DropdownLifecycle = null,
) {
  let wrapper = selector
    .append("div")
    .classed("dropdownWrapper", true)
    .attr("role", "button")
    .attr("tabindex", 0)
    .attr("aria-haspopup", "listbox")
    .attr("aria-expanded", "false")
  let dropdownInner = wrapper.append("div").classed("dropdown tippy-dropdown-menu", true)
  let spacer = wrapper.append("div").classed("spacer", true)
  const wrapperNode = requirePresentationNode(wrapper.node() as HTMLElement | null, "dropdown wrapper")
  const dropdownNode = requirePresentationNode(dropdownInner.node() as HTMLElement | null, "dropdown content")
  const spacerNode = requirePresentationNode(spacer.node() as HTMLElement | null, "dropdown spacer")
  let escapeHandler: ((event: KeyboardEvent) => void) | null = null
  let tippyInstance: Instance | null = null
  let destroyed = false
  const hiddenState = { isVisible: false }
  const clearStableWrapperSize = (): void => {
    wrapperNode.style.removeProperty("width")
    wrapperNode.style.removeProperty("height")
  }
  const instance = {
    reference: wrapperNode,
    get state() {
      return tippyInstance?.state ?? hiddenState
    },
    show() {
      if (destroyed) {
        return
      }
      const wrapperBounds = wrapperNode.getBoundingClientRect()
      wrapperNode.style.width = `${wrapperBounds.width}px`
      wrapperNode.style.height = `${wrapperBounds.height}px`
      tippyInstance ??= tippy(wrapperNode, {
        ...tooltipProps(),
        animation: false,
        arrow: false,
        content: " ",
        duration: 0,
        hideOnClick: true,
        interactive: true,
        maxWidth: "none",
        offset: [0, 4],
        placement: "bottom-start",
        theme: "factorio-dropdown",
        trigger: "manual",
        onShow(realInstance) {
          hideAll({ exclude: realInstance })
          let selected = dropdownNode.querySelector("input:checked + label")
          if (selected instanceof HTMLElement) {
            let bounds = selected.getBoundingClientRect()
            spacer.style("width", `${bounds.width}px`).style("height", `${bounds.height}px`)
          }
          wrapperNode.classList.add("open")
          dropdownNode.classList.add("open")
          wrapper.attr("aria-expanded", "true")
          realInstance.setContent(dropdownNode)
        },
        onMount() {
          escapeHandler = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
              instance.hide()
              wrapperNode.focus()
            }
          }
          document.addEventListener("keydown", escapeHandler)
          onOpen?.(select(dropdownNode))
        },
        onClickOutside(realInstance) {
          realInstance.hide()
        },
        onHidden(realInstance) {
          if (escapeHandler !== null) {
            document.removeEventListener("keydown", escapeHandler)
            escapeHandler = null
          }
          wrapperNode.insertBefore(dropdownNode, spacerNode)
          realInstance.setContent(" ")
          wrapperNode.classList.remove("open")
          dropdownNode.classList.remove("open")
          wrapper.attr("aria-expanded", "false")
          clearStableWrapperSize()
          onClose?.(select(dropdownNode))
        },
      })
      tippyInstance.show()
    },
    hide() {
      tippyInstance?.hide()
    },
    destroy() {
      if (destroyed) {
        return
      }
      destroyed = true
      clearStableWrapperSize()
      if (escapeHandler !== null) {
        document.removeEventListener("keydown", escapeHandler)
        escapeHandler = null
      }
      tippyInstance?.destroy()
      tippyInstance = null
    },
  }
  const dropdownState: DropdownState = { dropdownNode, instance, spacerNode, wrapperNode }
  dropdownLocal.set(wrapperNode, dropdownState)
  dropdownLocal.set(dropdownNode, dropdownState)
  tooltipRegistry.add(instance)
  wrapper
    .on("click", function (this: Element) {
      if (this instanceof HTMLElement) toggleDropdown.call(this)
    })
    .on("keydown", function (this: Element, event: KeyboardEvent) {
      if (!(this instanceof HTMLElement)) return
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        toggleDropdown.call(this)
      }
    })
  return dropdownInner
}

let inputId = 0
let labelFor = 0

// Appends a dropdown input to the selection.
//
// Args:
//   name: Should be unique to the dropdown.
//   checked: Should be true when a given input is the selected one.
//   callback: Called when the selected item is changed.
//
// Returns:
//   Selection with the input's label.
export function addInputs<
  TDatum,
  GElement extends BaseType = BaseType,
  PElement extends BaseType = BaseType,
  PDatum = unknown,
>(
  selector: Selection<GElement, TDatum, PElement, PDatum>,
  name: string | ((datum: TDatum) => string),
  checked: ValueFn<GElement, TDatum, boolean>,
  callback: (this: HTMLInputElement, datum: TDatum) => void,
) {
  selector
    .append("input")
    .on("change", function (this: Element, _event: Event, d: TDatum) {
      if (!(this instanceof HTMLInputElement)) return
      toggleDropdown.call(this)
      callback.call(this, d)
    })
    .attr("id", () => "input-" + inputId++)
    .attr("name", typeof name === "string" ? name : (datum: TDatum) => name(datum))
    .attr("type", "radio")
    .property("checked", checked)
  let label = selector.append("label").attr("for", () => "input-" + labelFor++)
  return label
}

// Wrapper around makeDropdown/addInputs to create an input for each item in
// data.
export function dropdown<
  TDatum,
  GElement extends BaseType = BaseType,
  PElement extends BaseType = BaseType,
  PDatum = unknown,
>(
  selector: Selection<GElement, TDatum, PElement, PDatum>,
  data: readonly TDatum[],
  name: string,
  checked: (datum: TDatum) => boolean,
  callback: (this: HTMLInputElement, datum: TDatum) => void,
) {
  let dd = makeDropdown(selector).selectAll("div").data(data).join("div")
  return addInputs(dd, name, checked, callback)
}

function requirePresentationNode<T extends Node>(node: T | null, label: string): T {
  if (node === null) throw new Error(`Unable to create ${label}`)
  return node
}
// endregion presentation.ts

// region models/productivity-research.ts
export interface RecipeProductivityResearch {
  readonly key: string
  readonly name: string
  readonly icon_col: number
  readonly icon_row: number
  readonly effects: Map<Recipe, Rational>
  readonly icon: Icon
}

export function getRecipeProductivityResearch(
  data: CalculatorData,
  recipes: ReadonlyMap<string, Recipe>,
): Map<string, RecipeProductivityResearch> {
  const result = new Map<string, RecipeProductivityResearch>()
  for (let entry of data.recipe_productivity_research ?? []) {
    const effects = new Map<Recipe, Rational>()
    for (let effect of entry.effects) {
      let recipe = recipes.get(effect.recipe)
      if (recipe !== undefined) {
        effects.set(recipe, Rational.from_float_approximate(effect.change))
      }
    }
    const iconTarget = {
      key: entry.key,
      name: entry.localized_name.en,
      icon_col: entry.icon_col,
      icon_row: entry.icon_row,
      effects,
    }
    const research: RecipeProductivityResearch = { ...iconTarget, icon: new Icon(iconTarget) }
    result.set(entry.key, research)
  }
  return result
}
// endregion models/productivity-research.ts

// region models/item-groups.ts
// Sorts items into their groups and subgroups. Used chiefly by the target
// dropdown.
export type ItemGroups = Item[][][]

export function getItemGroups(items: ReadonlyMap<string, Item>, data: CalculatorData): ItemGroups {
  // {groupName: {subgroupName: [item]}}
  const itemGroupMap = new Map<string, Map<string, Item[]>>()
  for (let [itemKey, item] of items) {
    let group = itemGroupMap.get(item.group)
    if (group === undefined) {
      group = new Map()
      itemGroupMap.set(item.group, group)
    }
    let subgroup = group.get(item.subgroup)
    if (subgroup === undefined) {
      subgroup = []
      group.set(item.subgroup, subgroup)
    }
    subgroup.push(item)
  }
  const itemGroups: ItemGroups = []
  let groupNames = sorted(itemGroupMap.keys(), function (k) {
    return data.groups[k]?.order ?? k
  })
  for (let groupName of groupNames) {
    const groupMap = itemGroupMap.get(groupName)
    if (groupMap === undefined) continue
    const subgroupNames = sorted(groupMap.keys(), (key) => data.groups[groupName]?.subgroups[key] ?? key)
    const group: Item[][] = []
    itemGroups.push(group)
    for (let subgroupName of subgroupNames) {
      const subgroupItems = groupMap.get(subgroupName) ?? []
      const items = sorted(subgroupItems, function (item) {
        return item.order
      })
      group.push(items)
    }
  }
  return itemGroups
}
// endregion models/item-groups.ts

// region models.ts
// Runtime context

export interface ModelFactorySpecification {
  readonly items: Map<string, Item>
  readonly recipes: Map<string, Recipe>
  readonly format: Formatter
  readonly miningProd: Rational
  readonly defaultBeacon: readonly (Module | null)[]
  readonly defaultBeaconCount: Rational
  readonly defaultModuleQuality?: Quality
  readonly defaultBeaconQuality?: Quality
  getMachineQuality?(recipe: Recipe): Quality
  getBuilding(recipe: Recipe): Building | null
  getModuleSpec(recipe: Recipe): ModuleSpec | null
  getDefaultModule(recipe: Recipe, building: Building): Module | null
  getResourceYield(recipe: Recipe): Rational
  getFuelForRecipe(recipe: Recipe): Fuel | null
  getRecipeRate(recipe: Recipe): Rational | null
  getPowerUsage(recipe: Recipe, rate: Rational): { readonly fuel: string | null; readonly power: Rational }
  getProdEffect(recipe: Recipe): Rational
  notifyRecipeConfigurationChanged(recipe: Recipe): void
  recordRecipeConfigurationChange(recipe: Recipe): void
}

export interface ModelRuntimeContext {
  getSpecification(): ModelFactorySpecification
  useLegacyCalculation(): boolean
}

export type ConfigurationSource = "default" | "automatic-quality" | "user"

export class Quality {
  readonly icon: Icon

  constructor(
    readonly key: string,
    readonly name: string,
    readonly icon_col: number,
    readonly icon_row: number,
    readonly level: number,
    readonly order: string,
    readonly color: string,
    readonly craftingSpeedMultiplier: Rational,
    readonly moduleEffectMultiplier: Rational,
    readonly beaconPowerUsageMultiplier: Rational,
    readonly miningDrillResourceDrainMultiplier: Rational,
  ) {
    this.icon = new Icon(this)
  }
}

export const normalQuality = new Quality("normal", "Normal", 0, 0, 0, "a", "#b3b3b3", one, one, one, one)

function qualitySixth(value: number): Rational {
  const numerator = Math.round(value * 6)
  return Math.abs(value - numerator / 6) < 1e-9
    ? Rational.from_floats(numerator, 6)
    : Rational.from_float_approximate(value)
}

export function getQualities(data: CalculatorData): Map<string, Quality> {
  const qualities = new Map<string, Quality>()
  for (const entry of data.qualities ?? []) {
    qualities.set(
      entry.key,
      new Quality(
        entry.key,
        entry.localized_name.en,
        entry.icon_col,
        entry.icon_row,
        entry.level,
        entry.order,
        entry.color,
        Rational.from_float_approximate(entry.crafting_speed_multiplier),
        Rational.from_float_approximate(entry.module_effect_multiplier),
        qualitySixth(entry.beacon_power_usage_multiplier),
        qualitySixth(entry.mining_drill_resource_drain_multiplier),
      ),
    )
  }
  if (qualities.size === 0 && data.mods?.includes("quality")) {
    const fallback = [
      ["normal", "Normal", 0, "a", "#b3b3b3"],
      ["uncommon", "Uncommon", 1, "b", "#2ba53d"],
      ["rare", "Rare", 2, "c", "#1968b2"],
      ["epic", "Epic", 3, "d", "#8900b2"],
      ["legendary", "Legendary", 5, "e", "#b26800"],
    ] as const
    for (const [key, name, level, order, color] of fallback) {
      const multiplier = Rational.from_floats(10 + 3 * level, 10)
      const sixth = Rational.from_floats(Math.max(1, 6 - level), 6)
      qualities.set(key, new Quality(key, name, 0, 0, level, order, color, multiplier, multiplier, sixth, sixth))
    }
  }
  if (qualities.size === 0) qualities.set(normalQuality.key, normalQuality)
  return qualities
}

let context: ModelRuntimeContext | null = null

export function configureModelRuntime(nextContext: ModelRuntimeContext): void {
  context = nextContext
}

export function currentSpecification(): ModelFactorySpecification {
  if (context === null) {
    throw new Error("Model runtime has not been configured")
  }
  return context.getSpecification()
}

export function usesLegacyModelCalculation(): boolean {
  return context?.useLegacyCalculation() ?? false
}

// Belts

export class Belt {
  readonly icon: Icon
  constructor(
    readonly key: string,
    readonly name: string,
    readonly icon_col: number,
    readonly icon_row: number,
    readonly rate: Rational,
  ) {
    this.icon = new Icon(this)
  }
  renderTooltip(): HTMLElement {
    let self = this
    let t = create("div").classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true))
    header.append("span").text(self.name)
    t.append("b").text(`Max throughput: `)
    t.append("span").text(`${spec.format.rate(this.rate)}/${spec.format.longRate}`)
    return requireModelElement(t.node(), "tooltip")
  }
}

export function getBelts(data: CalculatorData): Map<string, Belt> {
  const beltObjs: Belt[] = []
  for (let beltInfo of data.belts) {
    // Belt speed is given in tiles/tick, which we can convert to
    // items/second as follows:
    //       tiles      ticks              32 pixels/tile
    // speed ----- * 60 ------ * 2 lanes * --------------
    //       tick       second             8 pixels/item
    let baseSpeed = Rational.from_float_approximate(beltInfo.speed)
    let speed = baseSpeed.mul(Rational.from_float(480))
    beltObjs.push(new Belt(beltInfo.key, beltInfo.localized_name.en, beltInfo.icon_col, beltInfo.icon_row, speed))
  }
  beltObjs.sort(function (a, b) {
    if (a.rate.less(b.rate)) {
      return -1
    } else if (b.rate.less(a.rate)) {
      return 1
    }
    return 0
  })
  const belts = new Map<string, Belt>()
  for (let belt of beltObjs) {
    belts.set(belt.key, belt)
  }
  return belts
}

// Fuels

const energySuffixes = ["J", "kJ", "MJ", "GJ", "TJ", "PJ"] as const

export class Fuel {
  readonly icon: Icon
  constructor(
    readonly key: string,
    readonly name: string,
    readonly icon_col: number,
    readonly icon_row: number,
    readonly item: Item,
    readonly category: string,
    readonly value: Rational,
  ) {
    this.icon = new Icon(this)
  }
  valueString(): string {
    let x = this.value
    let thousand = Rational.from_float(1000)
    let i = 0
    while (thousand.less(x) && i < energySuffixes.length - 1) {
      x = x.div(thousand)
      i++
    }
    return x.toUpDecimal(0) + " " + energySuffixes[i]
  }
  renderTooltip(): HTMLElement {
    let self = this
    let t = create("div").classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true))
    header.append("span").text(self.name)
    t.append("b").text("Energy: ")
    t.append("span").text(self.valueString())
    return requireModelElement(t.node(), "tooltip")
  }
}

export class FuelCollection extends Map<string, Fuel> {
  readonly categories: Map<string, Fuel[]>

  constructor(categories: Map<string, Fuel[]>) {
    super()
    this.categories = categories
    for (let fuel of categories.get("chemical") ?? []) {
      this.set(fuel.key, fuel)
    }
  }

  getForCategory(category: string, selectedChemicalFuel: Fuel | null = null): Fuel | null {
    if (category === "chemical" && selectedChemicalFuel !== null) {
      return selectedChemicalFuel
    }
    return this.categories.get(category)?.[0] ?? null
  }
}

export function getFuel(data: CalculatorData, items: ReadonlyMap<string, Item>): FuelCollection {
  const fuelCategories = new Map<string, Fuel[]>()
  for (let d of data.fuel) {
    const item = requireModelItem(items, d.item_key)
    let fuel = new Fuel(
      d.item_key,
      item.name,
      item.icon_col,
      item.icon_row,
      item,
      d.category,
      Rational.from_float_approximate(d.value),
    )
    let f = fuelCategories.get(fuel.category)
    if (f === undefined) {
      f = []
      fuelCategories.set(fuel.category, f)
    }
    f.push(fuel)
  }
  for (const category of fuelCategories.values()) {
    category.sort(function (a, b) {
      if (a.value.less(b.value)) {
        return -1
      } else if (b.value.less(a.value)) {
        return 1
      }
      return 0
    })
  }
  return new FuelCollection(fuelCategories)
}

// Buildings

let thirty = Rational.from_float(30)

export class Building {
  readonly categories: Set<string>
  readonly conditions: readonly SurfaceConditionData[]
  readonly emissions: Readonly<Record<string, Rational>>
  readonly allowedEffects: Set<string> | null
  readonly icon: Icon

  constructor(
    readonly key: string,
    readonly name: string,
    readonly icon_col: number,
    readonly icon_row: number,
    categories: readonly string[],
    readonly speed: Rational,
    readonly prodBonus: Rational,
    readonly moduleSlots: number,
    readonly power: Rational,
    readonly fuel: string | null,
    conditions: readonly SurfaceConditionData[] = [],
    allowedEffects: readonly string[] | Readonly<Record<string, boolean>> | null = null,
    emissions: Readonly<Record<string, number>> | null = null,
    readonly dropsFullBeltStacks = false,
    readonly qualityCraftingSpeed = true,
    readonly qualityPowerThroughput = false,
  ) {
    this.categories = new Set(categories)
    this.conditions = conditions
    this.emissions = Object.fromEntries(
      Object.entries(emissions ?? {}).map(([pollutant, value]) => [pollutant, Rational.from_float_approximate(value)]),
    )
    this.allowedEffects =
      allowedEffects === null
        ? null
        : new Set(
            Array.isArray(allowedEffects)
              ? allowedEffects
              : Object.entries(allowedEffects)
                  .filter(([, enabled]) => enabled)
                  .map(([effect]) => effect),
          )
    this.icon = new Icon(this)
  }
  less(other: Building): boolean {
    if (!this.speed.equal(other.speed)) {
      return this.speed.less(other.speed)
    }
    return this.moduleSlots < other.moduleSlots
  }
  canCraft(recipe: Recipe): boolean {
    for (let category of recipe.categories) {
      if (this.categories.has(category)) {
        return true
      }
    }
    return false
  }
  allowedOn(location: Planet): boolean {
    return location.allowsConditions(this.conditions)
  }
  allowsModule(module: Module | null): boolean {
    if (module === null || this.allowedEffects === null) {
      return true
    }
    for (let effect of module.requiredEffectTypes()) {
      if (!this.allowedEffects.has(effect)) {
        return false
      }
    }
    return true
  }
  getCount(spec: ModelFactorySpecification, recipe: Recipe, rate: Rational): Rational {
    return rate.div(this.getRecipeRate(spec, recipe))
  }
  getRecipeRate(spec: ModelFactorySpecification, recipe: Recipe): Rational {
    let modules = spec.getModuleSpec(recipe)
    let speedEffect
    if (modules) {
      speedEffect = modules.speedEffect()
    } else {
      speedEffect = one
    }
    const quality = spec.getMachineQuality?.(recipe) ?? normalQuality
    const qualitySpeed = this.qualityCraftingSpeed ? quality.craftingSpeedMultiplier : one
    return recipe.time.reciprocate().mul(this.speed).mul(qualitySpeed).mul(speedEffect)
  }
  supportsEquipmentQuality(): boolean {
    return this.qualityCraftingSpeed
  }
  canBeacon(): boolean {
    return this.moduleSlots > 0
  }
  prodEffect(_spec: ModelFactorySpecification): Rational {
    return this.prodBonus
  }
  drain(): Rational {
    return this.power.div(thirty)
  }
  powerForQuality(quality: Quality): Rational {
    return this.qualityPowerThroughput ? this.power.mul(quality.craftingSpeedMultiplier) : this.power
  }
  drainForQuality(quality: Quality): Rational {
    const drain = this.drain()
    return this.qualityPowerThroughput ? drain.mul(quality.craftingSpeedMultiplier) : drain
  }
  renderTooltip(): HTMLElement {
    let self = this
    let t = create("div").classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true))
    header.append("span").text(self.name)
    let line = t.append("div")
    line.append("b").text("Energy consumption: ")
    let { power, suffix } = powerRepresentation(this.power)
    line.append("span").text(`${formatCanadianNumber(power.toDecimal(0))} ${suffix}`)
    line = t.append("div")
    line.append("b").text("Crafting speed: ")
    line.append("span").text(formatCanadianNumber(this.speed.toDecimal()))
    line = t.append("div")
    line.append("b").text("Module slots: ")
    line.append("span").text(String(this.moduleSlots))
    return requireModelElement(t.node(), "tooltip")
  }
}

export class Miner extends Building {
  constructor(
    key: string,
    name: string,
    col: number,
    row: number,
    categories: readonly string[],
    readonly miningSpeed: Rational,
    moduleSlots: number,
    power: Rational,
    fuel: string | null,
    readonly resourceDrainRate: Rational = one,
    conditions: readonly SurfaceConditionData[] = [],
    allowedEffects: readonly string[] | null = null,
    emissions: Readonly<Record<string, number>> | null = null,
    dropsFullBeltStacks = false,
  ) {
    super(
      key,
      name,
      col,
      row,
      categories,
      zero,
      zero,
      moduleSlots,
      power,
      fuel,
      conditions,
      allowedEffects,
      emissions,
      dropsFullBeltStacks,
    )
  }
  override less(other: Building): boolean {
    return other instanceof Miner ? this.miningSpeed.less(other.miningSpeed) : super.less(other)
  }
  override drain(): Rational {
    return zero
  }
  override getRecipeRate(spec: ModelFactorySpecification, recipe: Recipe): Rational {
    let modules = spec.getModuleSpec(recipe)
    let speedEffect
    if (modules) {
      speedEffect = modules.speedEffect()
    } else {
      speedEffect = one
    }
    const miningTime = recipe.miningTime
    if (miningTime === undefined) {
      throw new Error(`Mining recipe ${recipe.key} is missing mining_time`)
    }
    let rate = this.miningSpeed.div(miningTime).mul(speedEffect)
    if (recipe.categories.has("basic-fluid")) {
      rate = rate.mul(spec.getResourceYield(recipe))
    }
    return rate
  }
  override prodEffect(spec: ModelFactorySpecification): Rational {
    return spec.miningProd
  }
  override supportsEquipmentQuality(): boolean {
    return true
  }
  getResourceDrainRate(spec: ModelFactorySpecification, recipe: Recipe): Rational {
    const quality = spec.getMachineQuality?.(recipe) ?? normalQuality
    return this.resourceDrainRate.mul(quality.miningDrillResourceDrainMultiplier)
  }
  override renderTooltip(): HTMLElement {
    let self = this
    let t = create("div").classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true))
    header.append("span").text(self.name)
    let line = t.append("div")
    line.append("b").text("Energy consumption: ")
    let { power, suffix } = powerRepresentation(this.power)
    line.append("span").text(`${formatCanadianNumber(power.toDecimal(0))} ${suffix}`)
    line = t.append("div")
    line.append("b").text("Mining speed: ")
    line.append("span").text(formatCanadianNumber(this.miningSpeed.toDecimal()))
    line = t.append("div")
    line.append("b").text("Module slots: ")
    line.append("span").text(String(this.moduleSlots))
    return requireModelElement(t.node(), "tooltip")
  }
}

export class OffshorePump extends Building {
  constructor(
    key: string,
    name: string,
    col: number,
    row: number,
    readonly pumpingSpeed: Rational,
    conditions: readonly SurfaceConditionData[] = [],
  ) {
    super(key, name, col, row, ["offshore-pumping"], zero, zero, 0, zero, null, conditions)
  }
  override less(other: Building): boolean {
    return other instanceof OffshorePump ? this.pumpingSpeed.less(other.pumpingSpeed) : super.less(other)
  }
  override supportsEquipmentQuality(): boolean {
    return false
  }
  override getRecipeRate(_spec: ModelFactorySpecification, _recipe: Recipe): Rational {
    return this.pumpingSpeed
  }
  override renderTooltip(): HTMLElement {
    let self = this
    let t = create("div").classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true))
    header.append("span").text(self.name)
    let line = t.append("div")
    line.append("b").text("Pumping speed: ")
    line.append("span").text(`${spec.format.rate(this.pumpingSpeed)}/${spec.format.rateName}`)
    return requireModelElement(t.node(), "tooltip")
  }
}

let rocketLaunchDuration = Rational.from_floats(2434, 60)

export interface RocketLaunchConfiguration {
  readonly partsPerLaunch: Rational
  readonly launchCycle: Rational
  readonly launchCyclesByQuality: ReadonlyMap<string, Rational>
  readonly buffered: boolean
}

export interface RocketLaunchStats {
  readonly part: Rational
  readonly launch: Rational
  readonly partsPerLaunch: Rational
  readonly craftsPerLaunch: Rational
  readonly craftingRate: Rational
  readonly effectivePartsPerCraft: Rational
  readonly craftingLaunchRate: Rational
  readonly animationLaunchRate: Rational
  readonly launchLimited: boolean
  readonly buffered: boolean
}

function getRocketLaunchStats(
  spec: ModelFactorySpecification,
  launchConfig: RocketLaunchConfiguration | null = null,
): RocketLaunchStats {
  const partRecipe = requireRecipe(spec.recipes, "rocket-part")
  const partFactory = spec.getBuilding(partRecipe)
  if (partFactory === null) throw new Error("Rocket-part recipe has no compatible silo")
  const partItem = requireModelItem(spec.items, "rocket-part")
  // gives() already includes module and researched recipe productivity.
  let effectivePartsPerCraft = partRecipe.gives(partItem)
  // The base rate at which the silo can complete rocket-part crafts.
  let craftingRate = Building.prototype.getRecipeRate.call(partFactory, spec, partRecipe)
  // Productivity reduces the number of recipe crafts required to fill a rocket.
  let partsPerLaunch = launchConfig?.partsPerLaunch ?? Rational.from_float(100)
  let craftsPerLaunch = partsPerLaunch.div(effectivePartsPerCraft)

  if (launchConfig?.buffered) {
    let craftingLaunchRate = craftingRate.div(craftsPerLaunch)
    const quality = spec.getMachineQuality?.(partRecipe) ?? normalQuality
    const launchCycle = launchConfig.launchCyclesByQuality.get(quality.key) ?? launchConfig.launchCycle
    let animationLaunchRate = launchCycle.reciprocate()
    let launchRate = Rational.min(craftingLaunchRate, animationLaunchRate)
    return {
      part: launchRate.mul(craftsPerLaunch),
      launch: launchRate,
      partsPerLaunch,
      craftsPerLaunch,
      craftingRate,
      effectivePartsPerCraft,
      craftingLaunchRate,
      animationLaunchRate,
      launchLimited: !craftingLaunchRate.less(animationLaunchRate),
      buffered: true,
    }
  }

  // Legacy datasets model the original serial build + animation cycle.
  let time = craftsPerLaunch.div(craftingRate).add(rocketLaunchDuration)
  let launchRate = time.reciprocate()
  return {
    part: craftsPerLaunch.div(time),
    launch: launchRate,
    partsPerLaunch,
    craftsPerLaunch,
    craftingRate,
    effectivePartsPerCraft,
    craftingLaunchRate: launchRate,
    animationLaunchRate: rocketLaunchDuration.reciprocate(),
    launchLimited: false,
    buffered: false,
  }
}

export class RocketLaunch extends Building {
  constructor(
    key: string,
    name: string,
    col: number,
    row: number,
    categories: readonly string[],
    speed: Rational,
    prodBonus: Rational,
    moduleSlots: number,
    power: Rational,
    fuel: string | null,
    readonly launchConfig: RocketLaunchConfiguration | null,
  ) {
    super(key, name, col, row, categories, speed, prodBonus, moduleSlots, power, fuel)
  }
  override getRecipeRate(spec: ModelFactorySpecification, _recipe: Recipe): Rational {
    return getRocketLaunchStats(spec, this.launchConfig).launch
  }
}

export class RocketSilo extends Building {
  constructor(
    key: string,
    name: string,
    col: number,
    row: number,
    categories: readonly string[],
    speed: Rational,
    prodBonus: Rational,
    moduleSlots: number,
    power: Rational,
    fuel: string | null,
    conditions: readonly SurfaceConditionData[],
    allowedEffects: readonly string[] | null,
    emissions: Readonly<Record<string, number>> | null,
    readonly launchConfig: RocketLaunchConfiguration | null,
  ) {
    super(
      key,
      name,
      col,
      row,
      categories,
      speed,
      prodBonus,
      moduleSlots,
      power,
      fuel,
      conditions,
      allowedEffects,
      emissions,
    )
  }
  override getRecipeRate(spec: ModelFactorySpecification, _recipe: Recipe): Rational {
    return getRocketLaunchStats(spec, this.launchConfig).part
  }
  getLaunchStats(spec: ModelFactorySpecification): RocketLaunchStats {
    return getRocketLaunchStats(spec, this.launchConfig)
  }
}

function renderTooltipBase(this: Building): HTMLElement {
  let self = this
  let t = create("div").classed("frame", true)
  let header = t.append("h3")
  header.append(() => self.icon.make(32, true))
  header.append("span").text(self.name)
  return requireModelElement(t.node(), "tooltip")
}

export function getBuildings(data: CalculatorData, items: ReadonlyMap<string, Item>): Building[] {
  const buildings: Building[] = []
  let launchConfig = data.rocket_launch
    ? {
        partsPerLaunch: Rational.from_float_approximate(data.rocket_launch.parts_per_launch),
        launchCycle: Rational.from_floats(data.rocket_launch.launch_cycle_ticks, 60),
        launchCyclesByQuality: new Map(
          Object.entries(data.rocket_launch.launch_cycle_ticks_by_quality ?? {}).map(([key, ticks]) => [
            key,
            Rational.from_floats(ticks, 60),
          ]),
        ),
        buffered: data.rocket_launch.buffered,
      }
    : null
  const reactorDef = requireModelItem(items, "nuclear-reactor")
  let reactor = new Building(
    "nuclear-reactor",
    reactorDef.name,
    reactorDef.icon_col,
    reactorDef.icon_row,
    ["nuclear"],
    one,
    zero,
    0,
    zero,
    null,
    [],
    null,
    null,
    false,
    true,
    true,
  )
  reactor.renderTooltip = renderTooltipBase
  buildings.push(reactor)
  const boilerItem = requireModelItem(items, "boiler")
  const boilerDef = data.boilers.find((entry) => entry.key === "boiler")
  if (boilerDef === undefined) throw new Error("Dataset is missing the base boiler")
  let boiler_energy = Rational.from_float(boilerDef.energy_consumption)
  let boiler = new Building(
    "boiler",
    boilerItem.name,
    boilerItem.icon_col,
    boilerItem.icon_row,
    ["boiler"],
    one,
    zero,
    0,
    boiler_energy,
    "chemical",
    [],
    null,
    null,
    false,
    true,
    true,
    //boilerDef.target_temperature,
  )
  boiler.renderTooltip = renderTooltipBase
  buildings.push(boiler)
  const siloDef = requireModelItem(items, "rocket-silo")
  let launch = new RocketLaunch(
    "rocket-silo",
    siloDef.name,
    siloDef.icon_col,
    siloDef.icon_row,
    ["rocket-launch"],
    one,
    zero,
    0,
    zero,
    null,
    launchConfig,
  )
  launch.renderTooltip = renderTooltipBase
  buildings.push(launch)
  for (let d of data.crafting_machines) {
    const fuel = d.energy_source?.type === "burner" ? (d.energy_source.fuel_category ?? null) : null
    let prod = zero
    if (d.prod_bonus) {
      prod = Rational.from_float_approximate(d.prod_bonus)
    }
    buildings.push(
      new Building(
        d.key,
        d.localized_name.en,
        d.icon_col,
        d.icon_row,
        d.crafting_categories ?? [],
        Rational.from_float_approximate(d.crafting_speed ?? 1),
        prod,
        d.module_slots ?? 0,
        Rational.from_float_approximate(d.energy_usage ?? 0),
        fuel,
        d.surface_conditions ?? [],
        d.allowed_effects ?? null,
        d.energy_source?.emissions_per_minute ?? null,
        d.drops_full_belt_stacks ?? false,
      ),
    )
  }
  for (let d of data.rocket_silo ?? []) {
    buildings.push(
      new RocketSilo(
        d.key,
        d.localized_name.en,
        d.icon_col,
        d.icon_row,
        d.crafting_categories ?? [],
        Rational.from_float_approximate(d.crafting_speed ?? 1),
        zero,
        d.module_slots ?? 0,
        Rational.from_float_approximate(d.energy_usage ?? 0),
        null,
        d.surface_conditions ?? [],
        d.allowed_effects ?? null,
        d.energy_source?.emissions_per_minute ?? null,
        launchConfig,
      ),
    )
  }
  for (let d of data.offshore_pumps ?? []) {
    // Pumping speed is given in units/tick.
    let speed = Rational.from_float_approximate(d.pumping_speed).mul(Rational.from_float(60))
    buildings.push(
      new OffshorePump(d.key, d.localized_name.en, d.icon_col, d.icon_row, speed, d.surface_conditions ?? []),
    )
  }
  for (let d of data.mining_drills) {
    const fuel = d.energy_source?.type === "burner" ? (d.energy_source.fuel_category ?? null) : null
    buildings.push(
      new Miner(
        d.key,
        d.localized_name.en,
        d.icon_col,
        d.icon_row,
        d.resource_categories,
        Rational.from_float_approximate(d.mining_speed),
        d.module_slots ?? 0,
        Rational.from_float_approximate(d.energy_usage ?? 0),
        fuel,
        Rational.from_floats(d.resource_drain_rate_percent ?? 100, 100),
        d.surface_conditions ?? [],
        d.allowed_effects ?? null,
        d.energy_source?.emissions_per_minute ?? null,
        d.drops_full_belt_stacks ?? false,
      ),
    )
  }
  for (let d of data.agricultural_tower ?? []) {
    buildings.push(
      new Building(
        d.key,
        d.localized_name.en,
        d.icon_col,
        d.icon_row,
        ["agriculture"],
        Rational.from_float(47),
        zero,
        0,
        Rational.from_float_approximate(d.energy_usage ?? 0),
        null,
        d.surface_conditions ?? [],
        d.allowed_effects ?? [],
        d.energy_source?.emissions_per_minute ?? null,
        false,
        false,
      ),
    )
  }
  return buildings
}

// Modules and beacons

let hundred = Rational.from_float(100)
function percent(x: Rational): string {
  let sign = ""
  if (!x.less(zero)) {
    sign = "+"
  }
  return `${sign}${formatCanadianNumber(x.mul(hundred).toDecimal())}%`
}

export class Module {
  readonly effectTypes = new Set<string>()
  readonly icon: Icon

  constructor(
    readonly key: string,
    readonly name: string,
    readonly icon_col: number,
    readonly icon_row: number,
    readonly category: string | undefined,
    readonly order: string,
    readonly productivity: Rational,
    readonly quality: Rational,
    readonly speed: Rational,
    readonly power: Rational,
    readonly pollution: Rational,
    readonly qualityEffects: ReadonlyMap<
      string,
      {
        readonly productivity: Rational
        readonly quality: Rational
        readonly speed: Rational
        readonly power: Rational
        readonly pollution: Rational
      }
    > = new Map(),
  ) {
    // Pollution is retained in the dataset but does not affect production rates.
    if (!power.isZero()) {
      this.effectTypes.add("consumption")
    }
    if (!speed.isZero()) {
      this.effectTypes.add("speed")
    }
    if (!productivity.isZero()) {
      this.effectTypes.add("productivity")
    }
    if (!quality.isZero() || category === "quality") {
      this.effectTypes.add("quality")
    }
    if (!pollution.isZero()) {
      this.effectTypes.add("pollution")
    }

    this.icon = new Icon(this)
  }
  private effectFor(quality: Quality): {
    readonly productivity: Rational
    readonly quality: Rational
    readonly speed: Rational
    readonly power: Rational
    readonly pollution: Rational
  } {
    const generated = this.qualityEffects.get(quality.key)
    if (generated !== undefined) return generated
    const scale = (value: Rational, beneficial: boolean, precision: number): Rational => {
      if (!beneficial || quality.level === 0) return value
      const negative = value.less(zero)
      const magnitude = negative ? zero.sub(value) : value
      const rounded = magnitude
        .mul(quality.moduleEffectMultiplier)
        .mul(Rational.from_integer(precision))
        .floor()
        .div(Rational.from_integer(precision))
      return negative ? zero.sub(rounded) : rounded
    }
    return {
      productivity: scale(this.productivity, zero.less(this.productivity), 100),
      quality: scale(this.quality, zero.less(this.quality), 1000),
      speed: scale(this.speed, zero.less(this.speed), 100),
      power: scale(this.power, this.power.less(zero), 100),
      pollution: scale(this.pollution, this.pollution.less(zero), 100),
    }
  }
  productivityFor(quality: Quality): Rational {
    return this.effectFor(quality).productivity
  }
  qualityFor(quality: Quality): Rational {
    return this.effectFor(quality).quality
  }
  speedFor(quality: Quality): Rational {
    return this.effectFor(quality).speed
  }
  powerFor(quality: Quality): Rational {
    return this.effectFor(quality).power
  }
  pollutionFor(quality: Quality): Rational {
    return this.effectFor(quality).pollution
  }
  // This naming scheme is some older cruft, which works in the vanilla
  // dataset, but it's possible other datasets would render it unworkable.
  shortName(): string {
    return `${this.key.at(0) ?? ""}${this.key.at(-1) ?? ""}`
  }
  requiredEffectTypes(): Set<string> {
    const effects = new Set<string>(this.effectTypes)
    // Speed modules reduce quality in Factorio 2.1, but that penalty does not
    // require a machine or beacon to advertise support for positive quality.
    if (this.quality.less(zero)) {
      effects.delete("quality")
    }
    return effects
  }
  canUse(recipe: Recipe, building: Building | null = null): boolean {
    if (building !== null && !building.allowsModule(this)) {
      return false
    }
    if (this.hasProdEffect() && !recipe.allow_productivity) {
      return false
    }
    if ((this.category === "quality" || zero.less(this.quality)) && recipe.allow_quality === false) {
      return false
    }
    return true
  }
  canBeacon(): boolean {
    for (let effect of this.requiredEffectTypes()) {
      if (!beaconAllowedEffects.has(effect)) {
        return false
      }
    }
    return true
  }
  hasProdEffect(): boolean {
    return !this.productivity.isZero()
  }
  hasQualityEffect(): boolean {
    return !this.quality.isZero() || this.category === "quality"
  }
  renderTooltip(): HTMLElement {
    let self = this
    let t = create("div").classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true))
    header.append("span").text(self.name)
    let line
    if (!this.power.isZero()) {
      line = t.append("div")
      line.append("b").text("Energy consumption: ")
      line.append("span").text(percent(this.power))
    }
    if (!this.speed.isZero()) {
      line = t.append("div")
      line.append("b").text("Speed: ")
      line.append("span").text(percent(this.speed))
    }
    if (!this.productivity.isZero()) {
      line = t.append("div")
      line.append("b").text("Productivity: ")
      line.append("span").text(percent(this.productivity))
    }
    if (!this.quality.isZero()) {
      line = t.append("div")
      line.append("b").text("Quality: ")
      line.append("span").text(percent(this.quality))
    }
    if (!this.pollution.isZero()) {
      line = t.append("div")
      line.append("b").text("Pollution: ")
      line.append("span").text(percent(this.pollution))
    }
    return requireModelElement(t.node(), "tooltip")
  }
}

export interface ModuleDropdownOption {
  readonly cell: ModuleDropdownCell
  readonly module: Module | null
  checked(): boolean
  choose(): void
  tooltip?(): string | null
}

export interface ModulePipetteSelection {
  readonly module: Module
  readonly quality: Quality
}

export interface ModuleDropdownCell {
  readonly name: string
  readonly inputRows: readonly (readonly ModuleDropdownOption[])[]
  readonly qualityOptions?: readonly Quality[]
  selectedQuality?(): Quality
  chooseQuality?(quality: Quality): void
  keepOpenAfterQualitySelection?(): boolean
  pipetteLabel?(): string
  applyPipetteSelection?(selection: ModulePipetteSelection): "applied" | "incompatible"
}

let modulePipetteSelection: ModulePipetteSelection | null = null
let modulePipettePointerTarget: Element | null = null
let modulePipetteStatus: HTMLElement | null = null
let modulePipetteGhost: HTMLElement | null = null
let modulePipetteInitialized = false

function qualifiedModuleName(selection: ModulePipetteSelection): string {
  return selection.quality === normalQuality
    ? selection.module.name
    : `${selection.quality.name} ${selection.module.name}`
}

function selectedPipetteSelection(cell: ModuleDropdownCell): ModulePipetteSelection | null {
  for (const row of cell.inputRows) {
    for (const option of row) {
      if (option.checked() && option.module !== null) {
        return {
          module: option.module,
          quality: cell.selectedQuality?.() ?? currentSpecification().defaultModuleQuality ?? normalQuality,
        }
      }
    }
  }
  return null
}

function moduleOptionTooltip(option: ModuleDropdownOption): string | null {
  const tooltip = option.tooltip?.() ?? null
  if (!option.checked()) return tooltip
  const shortcut = option.module === null ? "Press Q to clear the pipette" : "Press Q to pick up"
  return tooltip === null ? shortcut : `${tooltip}\n${shortcut}`
}

function getModuleDropdownCell(element: Element): ModuleDropdownCell | null {
  const wrapper = element.closest("span.module-wrapper")
  return wrapper === null ? null : select<Element, ModuleDropdownCell>(wrapper).datum()
}

function getPipetteSource(element: Element | null): ModulePipetteSelection | null {
  if (element === null) return null
  const optionElement = element.closest("span.input")
  if (optionElement !== null) {
    const option = select<Element, ModuleDropdownOption>(optionElement).datum()
    if (option.module === null) return null
    return {
      module: option.module,
      quality: option.cell.selectedQuality?.() ?? currentSpecification().defaultModuleQuality ?? normalQuality,
    }
  }
  const cell = getModuleDropdownCell(element)
  return cell === null ? null : selectedPipetteSelection(cell)
}

function renderModulePipetteStatus(message: string | null = null): void {
  document.body.classList.toggle("module-pipette-active", modulePipetteSelection !== null)
  if (modulePipetteSelection === null) {
    if (modulePipetteStatus !== null) modulePipetteStatus.textContent = "Module pipette cleared."
    if (modulePipetteGhost !== null) modulePipetteGhost.hidden = true
    return
  }

  const selection = modulePipetteSelection
  const name = qualifiedModuleName(selection)
  const instruction = message ?? "Click compatible module slots to apply. Press Q or Esc to clear."
  if (modulePipetteStatus !== null) modulePipetteStatus.textContent = `Pipette: ${name}. ${instruction}`
  if (modulePipetteGhost === null) return
  modulePipetteGhost.hidden = false
  modulePipetteGhost.classList.toggle("incompatible", message !== null)
  modulePipetteGhost.replaceChildren(
    makeQualityIcon(selection.module.icon, selection.quality, { label: name, tooltip: null }),
  )
}

export function clearModulePipette(): void {
  modulePipetteSelection = null
  renderModulePipetteStatus()
}

function isTextEntry(element: Element | null): boolean {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  )
}

function handleModulePipettePointer(event: PointerEvent): void {
  modulePipettePointerTarget = event.target instanceof Element ? event.target : null
  if (modulePipetteGhost === null) return
  const gap = 12
  const ghostSize = 40
  const left = event.clientX + gap + ghostSize <= window.innerWidth ? event.clientX + gap : event.clientX - ghostSize
  const top = event.clientY + gap + ghostSize <= window.innerHeight ? event.clientY + gap : event.clientY - ghostSize
  modulePipetteGhost.style.left = `${Math.max(4, left)}px`
  modulePipetteGhost.style.top = `${Math.max(4, top)}px`
}

function handleModulePipetteKeydown(event: KeyboardEvent): void {
  if (event.key === "Tab") {
    modulePipettePointerTarget = null
    return
  }
  if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
  if (event.key === "Escape" && modulePipetteSelection !== null) {
    clearModulePipette()
    return
  }
  if (event.key.toLowerCase() !== "q" || isTextEntry(document.activeElement)) return

  const sourceElement =
    modulePipettePointerTarget ?? (document.activeElement instanceof Element ? document.activeElement : null)
  modulePipetteSelection = getPipetteSource(sourceElement)
  event.preventDefault()
  closeDropdowns()
  renderModulePipetteStatus()
}

function handleModulePipetteClick(event: MouseEvent): void {
  if (modulePipetteSelection === null || event.button !== 0 || !(event.target instanceof Element)) return
  const trigger = event.target.closest("span.module-wrapper > .dropdownWrapper")
  if (trigger === null) return
  const cell = getModuleDropdownCell(trigger)
  if (cell?.applyPipetteSelection === undefined) return

  event.preventDefault()
  event.stopImmediatePropagation()
  const result = cell.applyPipetteSelection(modulePipetteSelection)
  renderModulePipetteStatus(
    result === "incompatible" ? `${qualifiedModuleName(modulePipetteSelection)} cannot be used in that slot.` : null,
  )
}

export function initializeModulePipette(): void {
  if (modulePipetteInitialized) return
  modulePipetteInitialized = true
  const status = document.createElement("div")
  status.id = "module_pipette_status"
  status.className = "module-pipette-status"
  status.setAttribute("role", "status")
  status.setAttribute("aria-live", "polite")
  document.body.append(status)
  modulePipetteStatus = status
  const ghost = document.createElement("div")
  ghost.id = "module_pipette_ghost"
  ghost.className = "module-pipette-ghost"
  ghost.setAttribute("aria-hidden", "true")
  ghost.hidden = true
  document.body.append(ghost)
  modulePipetteGhost = ghost
  document.addEventListener("pointerover", handleModulePipettePointer)
  document.addEventListener("pointermove", handleModulePipettePointer)
  document.addEventListener("keydown", handleModulePipetteKeydown)
  document.addEventListener("click", handleModulePipetteClick, true)
}

export function disposeModulePipette(): void {
  if (!modulePipetteInitialized) return
  modulePipetteInitialized = false
  document.removeEventListener("pointerover", handleModulePipettePointer)
  document.removeEventListener("pointermove", handleModulePipettePointer)
  document.removeEventListener("keydown", handleModulePipetteKeydown)
  document.removeEventListener("click", handleModulePipetteClick, true)
  modulePipetteStatus?.remove()
  modulePipetteGhost?.remove()
  modulePipetteStatus = null
  modulePipetteGhost = null
  modulePipettePointerTarget = null
  clearModulePipette()
}

export function moduleDropdown<GElement extends Element, TDatum, PElement extends BaseType, PDatum>(
  selector: Selection<GElement, TDatum, PElement, PDatum>,
  data:
    | readonly ModuleDropdownCell[]
    | ((datum: TDatum, index: number, groups: GElement[]) => readonly ModuleDropdownCell[]),
): void {
  selector.each(function (datum, index, groups) {
    const cells = typeof data === "function" ? data(datum, index, Array.from(groups)) : data
    renderModuleDropdown(this, cells)
  })
}

function renderModuleDropdown(element: Element, data: readonly ModuleDropdownCell[]): void {
  const selector = select(element)
  const moduleDropdownSpan = selector
    .selectAll<HTMLSpanElement, ModuleDropdownCell>("span.module-wrapper")
    .data(data)
    .join((enter) => {
      const wrappers = enter.append("span").classed("module-wrapper", true)
      wrappers.each(function (this: Element) {
        makeDropdown(select(this))
      })
      return wrappers
    })
  moduleDropdownSpan
    .select<HTMLDivElement>("div.dropdownWrapper")
    .attr("aria-keyshortcuts", "Q")
    .attr("data-module-pipette-target", (cell) => (cell.applyPipetteSelection === undefined ? null : "true"))
    .attr("aria-label", (cell) => {
      const label = cell.pipetteLabel?.() ?? "Module selector"
      const selection = selectedPipetteSelection(cell)
      return selection === null
        ? `${label}. Press Q to clear the module pipette.`
        : `${label}: ${qualifiedModuleName(selection)}. Press Q to pick it up.`
    })
    .attr("data-tooltip", null)
  const moduleDropdown = moduleDropdownSpan.selectAll<HTMLDivElement, ModuleDropdownCell>("div.dropdown")
  moduleDropdown
    .selectAll<HTMLDivElement, ModuleDropdownCell>("div.equipment-quality-strip")
    .data((cell) =>
      cell.qualityOptions && cell.qualityOptions.length > 1 && cell.selectedQuality && cell.chooseQuality ? [cell] : [],
    )
    .join("div")
    .classed("equipment-quality-strip", true)
    .attr("aria-label", "Equipment quality")
    .selectAll<HTMLButtonElement, Quality>("button")
    .data((cell) => cell.qualityOptions ?? [])
    .join("button")
    .attr("type", "button")
    .style("--quality-color", (quality) => quality.color)
    .classed("selected", function (quality) {
      const parent = this.parentElement
      if (parent === null) return false
      const cell = select<HTMLElement, ModuleDropdownCell>(parent).datum()
      return cell.selectedQuality?.() === quality
    })
    .attr("aria-label", (quality) => `${quality.name} quality`)
    .attr("title", (quality) => `${quality.name} quality`)
    .each(function (quality) {
      this.replaceChildren(quality.icon.make(20, true))
    })
    .on("click", function (event: MouseEvent, quality) {
      event.stopPropagation()
      const parent = this.parentElement
      if (parent === null) return
      const cell = select<HTMLElement, ModuleDropdownCell>(parent).datum()
      if (cell.keepOpenAfterQualitySelection?.()) {
        cell.chooseQuality?.(quality)
      } else {
        closeDropdowns()
        globalThis.setTimeout(() => cell.chooseQuality?.(quality), 0)
      }
      select(parent)
        .selectAll<HTMLButtonElement, Quality>("button")
        .classed("selected", (option) => option === quality)
      const dropdown = parent.parentElement
      if (dropdown !== null) {
        select(dropdown)
          .selectAll<HTMLElement, ModuleDropdownOption>("span.input")
          .attr("data-tooltip", moduleOptionTooltip)
      }
    })
  const moduleInputs = moduleDropdown
    .selectAll<HTMLDivElement, readonly ModuleDropdownOption[]>("div.moduleRow")
    .data<readonly ModuleDropdownOption[]>((cell) => cell.inputRows)
    .join("div")
    .classed("moduleRow", true)
    .selectAll<HTMLSpanElement, ModuleDropdownOption>("span.input")
    .data<ModuleDropdownOption>((options) => options)
    .join(
      (enter) => {
        const inputs = enter.append("span").classed("input", true).attr("data-tooltip", moduleOptionTooltip)
        const label = addInputs(
          inputs,
          (option) => option.cell.name,
          (option) => option.checked(),
          (option) => option.choose(),
        )
        label.append("span").classed("module-option-icon", true)
        return inputs
      },
      (update) => update,
    )
  moduleInputs.attr("data-tooltip", moduleOptionTooltip)
  moduleInputs
    .selectAll<HTMLInputElement, ModuleDropdownOption>("input")
    .property("checked", (option: ModuleDropdownOption) => option.checked())
  moduleInputs.select<HTMLSpanElement>("span.module-option-icon").each(function (option: ModuleDropdownOption) {
    const wrapper = this.closest<HTMLSpanElement>("span.module-wrapper")
    if (wrapper === null) throw new Error("Module option is missing its wrapper")
    const cell = select<HTMLSpanElement, ModuleDropdownCell>(wrapper).datum()
    const quality =
      option.checked() && cell.qualityOptions && cell.qualityOptions.length > 1
        ? (cell.selectedQuality?.() ?? normalQuality)
        : null
    const baseIcon = option.module?.icon ?? sprites.get("slot_icon_module")?.icon
    if (baseIcon === undefined) throw new Error("Missing slot_icon_module sprite")
    const moduleName = option.module?.name ?? "Empty module slot"
    const label = quality === null ? moduleName : `${quality.name} ${moduleName}`
    this.replaceChildren(makeQualityIcon(baseIcon, quality, { label, tooltip: null }))
  })
}

const MIN_SPEED_EFFECT = Rational.from_floats(1, 5) // 20%
const MIN_POWER_EFFECT = Rational.from_floats(1, 5) // 20%
const MIN_POLLUTION_EFFECT = Rational.from_floats(1, 5) // 20%

// ModuleSpec represents the set of modules (including beacons) configured for
// a given recipe.
export class ModuleSpec {
  building: Building | null = null
  readonly modules: (Module | null)[] = []
  readonly moduleQualities: Quality[] = []
  readonly moduleQualityOverrides = new Set<number>()
  moduleSource: ConfigurationSource = "default"
  readonly beaconModules: (Module | null)[]
  readonly beaconModuleQualities: Quality[]
  readonly beaconModuleQualityOverrides = new Set<number>()
  beaconQuality: Quality
  beaconQualityOverride = false
  beaconCount: Rational

  constructor(
    readonly recipe: Recipe,
    readonly owner: ModelFactorySpecification,
  ) {
    this.beaconModules = owner.defaultBeacon.map((module) => (module === null || module.canBeacon() ? module : null))
    this.beaconModuleQualities = owner.defaultBeacon.map(() => owner.defaultModuleQuality ?? normalQuality)
    this.beaconQuality = owner.defaultBeaconQuality ?? normalQuality
    this.beaconCount = owner.defaultBeaconCount
  }
  setBuilding(building: Building, spec: ModelFactorySpecification): void {
    this.building = building
    if (this.modules.length > building.moduleSlots) {
      this.modules.length = building.moduleSlots
      this.moduleQualities.length = building.moduleSlots
      for (const index of this.moduleQualityOverrides) {
        if (index >= building.moduleSlots) this.moduleQualityOverrides.delete(index)
      }
    }
    let toAdd = spec.getDefaultModule(this.recipe, building)
    for (let i = 0; i < this.modules.length; i++) {
      const module = this.modules[i]
      if (module !== undefined && module !== null && !module.canUse(this.recipe, building)) {
        this.modules[i] = toAdd
      }
    }
    while (this.modules.length < building.moduleSlots) {
      this.modules.push(toAdd)
      this.moduleQualities.push(spec.defaultModuleQuality ?? normalQuality)
    }
    for (let i = 0; i < this.beaconModules.length; i++) {
      const module = this.beaconModules[i]
      if (module !== undefined && module !== null && (!module.canBeacon() || !module.canUse(this.recipe, building))) {
        this.beaconModules[i] = null
      }
    }
  }
  getModule(index: number): Module | null | undefined {
    return this.modules[index]
  }
  // Returns true if the module change requires a recalculation.
  setModule(index: number, module: Module | null, source: ConfigurationSource = "user"): boolean {
    if (index >= this.modules.length) {
      return false
    }
    if (module !== null && !module.canUse(this.recipe, this.building)) {
      return false
    }
    let oldModule = this.modules[index]
    const needRecalc = Boolean(
      (oldModule !== undefined && oldModule !== null && (oldModule.hasProdEffect() || oldModule.hasQualityEffect())) ||
      (module !== null && (module.hasProdEffect() || module.hasQualityEffect())),
    )
    this.modules[index] = module
    if (source !== "default") {
      this.moduleSource = source
    }
    if (source === "user") {
      this.owner?.notifyRecipeConfigurationChanged?.(this.recipe)
    } else if (source === "automatic-quality") {
      this.owner?.recordRecipeConfigurationChange?.(this.recipe)
    }
    return needRecalc
  }
  setModuleQuality(index: number, quality: Quality, source: ConfigurationSource = "user"): boolean {
    if (index >= this.modules.length) return false
    this.moduleQualities[index] = quality
    if (source === "default" || quality === this.owner.defaultModuleQuality) this.moduleQualityOverrides.delete(index)
    else this.moduleQualityOverrides.add(index)
    if (source !== "default") this.moduleSource = source
    if (source === "user") this.owner.notifyRecipeConfigurationChanged(this.recipe)
    else this.owner.recordRecipeConfigurationChange(this.recipe)
    const module = this.modules[index]
    return module !== null && module !== undefined && (module.hasProdEffect() || module.hasQualityEffect())
  }
  restoreModuleQualityOverride(index: number, quality: Quality): void {
    if (index >= this.modules.length) return
    this.moduleQualities[index] = quality
    this.moduleQualityOverrides.add(index)
    this.owner.recordRecipeConfigurationChange(this.recipe)
  }
  setBeaconModule(module: Module | null, i: number): void {
    this.beaconModules[i] =
      module === null || (module.canBeacon() && module.canUse(this.recipe, this.building)) ? module : null
  }
  setBeaconModuleQuality(quality: Quality, index: number): void {
    this.beaconModuleQualities[index] = quality
    if (quality === this.owner.defaultModuleQuality) this.beaconModuleQualityOverrides.delete(index)
    else this.beaconModuleQualityOverrides.add(index)
    this.owner.notifyRecipeConfigurationChanged(this.recipe)
  }
  restoreBeaconModuleQualityOverride(quality: Quality, index: number): void {
    if (index >= this.beaconModuleQualities.length) return
    this.beaconModuleQualities[index] = quality
    this.beaconModuleQualityOverrides.add(index)
    this.owner.recordRecipeConfigurationChange(this.recipe)
  }
  setBeaconQuality(quality: Quality): void {
    this.beaconQuality = quality
    this.beaconQualityOverride = quality !== this.owner.defaultBeaconQuality
    this.owner.notifyRecipeConfigurationChanged(this.recipe)
  }
  restoreBeaconQualityOverride(quality: Quality): void {
    this.beaconQuality = quality
    this.beaconQualityOverride = true
    this.owner.recordRecipeConfigurationChange(this.recipe)
  }
  setBeaconCount(count: Rational): void {
    this.beaconCount = count
  }

  qualityEffect(): Rational {
    let quality = zero
    for (const [index, module] of this.modules.entries()) {
      if (module !== null && module !== undefined) {
        quality = quality.add(module.qualityFor(this.moduleQualities[index] ?? normalQuality))
      }
    }
    if (this.modules.length > 0) {
      for (const [index, module] of this.beaconModules.entries()) {
        if (module === null) continue
        let beacon = module
          .qualityFor(this.beaconModuleQualities[index] ?? normalQuality)
          .mul(this.beaconCount)
          .mul(getBeaconEffect(this.beaconQuality))
        if (!usesLegacyModelCalculation()) {
          beacon = beacon.mul(getBeaconProfileEffect(this.beaconCount))
        }
        quality = quality.add(beacon)
      }
    }
    return Rational.max(zero, Rational.min(one, quality))
  }

  speedEffect(): Rational {
    let speed = one
    for (const [index, module] of this.modules.entries()) {
      if (!module) {
        continue
      }
      speed = speed.add(module.speedFor(this.moduleQualities[index] ?? normalQuality))
    }
    if (this.modules.length > 0) {
      for (const [index, module] of this.beaconModules.entries()) {
        if (module === null) {
          continue
        }
        let beacon = module
          .speedFor(this.beaconModuleQualities[index] ?? normalQuality)
          .mul(this.beaconCount)
          .mul(getBeaconEffect(this.beaconQuality))
        if (!usesLegacyModelCalculation()) {
          beacon = beacon.mul(getBeaconProfileEffect(this.beaconCount))
        }
        speed = speed.add(beacon)
      }
    }
    return Rational.max(speed, MIN_SPEED_EFFECT)
  }
  prodEffect(spec: ModelFactorySpecification): Rational {
    let prod = one
    for (const [index, module] of this.modules.entries()) {
      if (!module) {
        continue
      }
      prod = prod.add(module.productivityFor(this.moduleQualities[index] ?? normalQuality))
    }
    if (this.building === null) {
      throw new Error(`Module specification for ${this.recipe.key} has no building`)
    }
    prod = prod.add(this.building.prodEffect(spec))
    return prod
  }
  powerEffect(_spec: ModelFactorySpecification): Rational {
    let power = one
    for (const [index, module] of this.modules.entries()) {
      if (!module) {
        continue
      }
      power = power.add(module.powerFor(this.moduleQualities[index] ?? normalQuality))
    }
    if (this.modules.length > 0) {
      for (const [index, module] of this.beaconModules.entries()) {
        if (module === null) {
          continue
        }
        let beacon = module
          .powerFor(this.beaconModuleQualities[index] ?? normalQuality)
          .mul(this.beaconCount)
          .mul(getBeaconEffect(this.beaconQuality))
        if (!usesLegacyModelCalculation()) {
          beacon = beacon.mul(getBeaconProfileEffect(this.beaconCount))
        }
        power = power.add(beacon)
      }
    }
    return Rational.max(power, MIN_POWER_EFFECT)
  }
  pollutionEffect(): Rational {
    let pollution = one
    for (const [index, module] of this.modules.entries()) {
      if (module) pollution = pollution.add(module.pollutionFor(this.moduleQualities[index] ?? normalQuality))
    }
    if (this.modules.length > 0) {
      for (const [index, module] of this.beaconModules.entries()) {
        if (module === null) continue
        let beacon = module
          .pollutionFor(this.beaconModuleQualities[index] ?? normalQuality)
          .mul(this.beaconCount)
          .mul(getBeaconEffect(this.beaconQuality))
        if (!usesLegacyModelCalculation()) {
          beacon = beacon.mul(getBeaconProfileEffect(this.beaconCount))
        }
        pollution = pollution.add(beacon)
      }
    }
    return Rational.max(pollution, MIN_POLLUTION_EFFECT)
  }
}

export let moduleRows: (Module | null)[][] = [[null]]
export let shortModules = new Map<string, Module>()

let beaconProfile: Rational[] | null = null
let beaconEffect = one
let beaconEffectBonusPerQualityLevel = zero
let beaconAllowedEffects = new Set(["consumption", "speed", "pollution"])

function getBeaconProfileEffect(count: Rational): Rational {
  if (beaconProfile === null || beaconProfile.length === 0) {
    return one
  }
  const index = Math.min(Math.max(count.ceil().toFloat() - 1, 0), beaconProfile.length - 1)
  return beaconProfile[index] ?? one
}

export function getBeaconEffect(quality: Quality): Rational {
  return beaconEffect.add(beaconEffectBonusPerQualityLevel.mul(Rational.from_integer(quality.level)))
}

export function getDatasetBeaconPower(data: CalculatorData): Rational {
  return Rational.from_float_approximate(data.beacon.energy_usage ?? 0)
}

export function getModules(data: CalculatorData, items: ReadonlyMap<string, Item>): Map<string, Module> {
  const modules = new Map<string, Module>()
  for (let d of data.modules) {
    const item = requireModelItem(items, d.item_key)
    let effect = d.effect
    let category = d.category
    let order = item.order
    let speed = Rational.from_float_approximate(effect.speed || 0)
    let productivity = Rational.from_float_approximate(effect.productivity || 0)
    let quality = Rational.from_float_approximate(effect.quality || 0)
    let power = Rational.from_float_approximate(effect.consumption || 0)
    let pollution = Rational.from_float_approximate(effect.pollution || 0)
    const qualityEffects = new Map(
      Object.entries(d.quality_effects ?? {}).map(([qualityKey, qualityEffect]) => [
        qualityKey,
        {
          productivity: Rational.from_float_approximate(qualityEffect.productivity ?? 0),
          quality: Rational.from_float_approximate(qualityEffect.quality ?? 0),
          speed: Rational.from_float_approximate(qualityEffect.speed ?? 0),
          power: Rational.from_float_approximate(qualityEffect.consumption ?? 0),
          pollution: Rational.from_float_approximate(qualityEffect.pollution ?? 0),
        },
      ]),
    )
    modules.set(
      d.item_key,
      new Module(
        d.item_key,
        item.name,
        item.icon_col,
        item.icon_row,
        category,
        order,
        productivity,
        quality,
        speed,
        power,
        pollution,
        qualityEffects,
      ),
    )
  }
  let sortedModules = sorted(modules.values(), (m) => m.order)
  moduleRows = [[null]]
  shortModules = new Map<string, Module>()
  let category = null
  for (let module of sortedModules) {
    if (module.category !== category) {
      category = module.category
      moduleRows.push([])
    }
    const currentRow = moduleRows.at(-1)
    if (currentRow === undefined) throw new Error("Module row initialization failed")
    currentRow.push(module)
    let shortName = module.shortName()
    if (shortModules.has(shortName)) {
      // This does not occur in the vanilla data, but let's plan ahead.
      module.shortName = function (): string {
        return this.key
      }
      shortName = module.key
    }
    shortModules.set(shortName, module)
  }
  beaconAllowedEffects = new Set(data.beacon.allowed_effects ?? ["consumption", "speed", "pollution"])
  beaconEffect = Rational.from_float_approximate(data.beacon.distribution_effectivity)
  beaconEffectBonusPerQualityLevel = Rational.from_float_approximate(
    data.beacon.distribution_effectivity_bonus_per_quality_level ?? (data.mods?.includes("quality") ? 0.2 : 0),
  )
  if (usesLegacyModelCalculation() || !data.beacon.profile) {
    beaconProfile = null
  } else {
    beaconProfile = []
    for (let x of data.beacon.profile) {
      beaconProfile.push(Rational.from_float_approximate(x))
    }
  }
  return modules
}

// Planets and surfaces

export class Planet {
  readonly disable = new Set<Recipe>()
  readonly icon: Icon
  constructor(
    readonly key: string,
    readonly name: string,
    readonly order: string,
    readonly icon_col: number,
    readonly icon_row: number,
    readonly resources: Set<Recipe>,
    readonly properties: Map<string, number>,
    readonly pollutantType: string | null = null,
  ) {
    this.icon = new Icon(this)
  }
  allowsConditions(conditions: readonly SurfaceConditionData[]): boolean {
    for (let condition of conditions ?? []) {
      let value = this.properties.get(condition.property)
      if (value === undefined) {
        value = defaultProperties.get(condition.property) ?? 0
      }
      let aboveMinimum = true
      let belowMaximum = true
      if (condition.min !== undefined) {
        aboveMinimum = value >= condition.min
      }
      if (condition.max !== undefined) {
        belowMaximum = value <= condition.max
      }
      if (!(aboveMinimum && belowMaximum)) {
        return false
      }
    }
    return true
  }
  allowsRecipe(recipe: Recipe): boolean {
    if (recipe.isResource()) {
      return this.resources.has(recipe)
    }
    return this.allowsConditions(recipe.conditions)
  }
  allowsBuilding(building: Building): boolean {
    return building.allowedOn(this)
  }
  allows(recipe: Recipe, buildings: readonly Building[]): boolean {
    if (!this.allowsRecipe(recipe)) {
      return false
    }
    if (recipe.isResource() || recipe.categories.size === 0) {
      return true
    }
    return buildings.some((building) => building.canCraft(recipe) && this.allowsBuilding(building))
  }
}

let defaultProperties = new Map<string, number>()

const RECYCLING_ROOT_KEYS = new Set(["scrap"])

function traverseRecycling(recipe: Recipe, found: Set<Recipe>): void {
  for (let { item } of recipe.products) {
    for (let subrecipe of item.uses) {
      if (subrecipe.key.endsWith("-recycling")) {
        if (!found.has(subrecipe)) {
          found.add(subrecipe)
          traverseRecycling(subrecipe, found)
        }
      }
    }
  }
}

export function getPlanets(
  data: CalculatorData,
  recipes: ReadonlyMap<string, Recipe>,
  buildings: readonly Building[],
): Map<string, Planet> | null {
  if (!data.planets) {
    // For legacy 1.1 datasets.
    return null
  }
  defaultProperties = new Map<string, number>()
  for (let { name, default_value } of data.surface_properties ?? []) {
    defaultProperties.set(name, default_value)
  }

  const planets = new Map<string, Planet>()
  for (let d of data.planets) {
    const resources = new Set<Recipe>()
    const roots = new Set<Recipe>()
    for (let key of (d.resources.resource ?? []).concat(d.resources.offshore ?? []).concat(d.resources.plants ?? [])) {
      const r = requireRecipe(recipes, key)
      resources.add(r)
      if (RECYCLING_ROOT_KEYS.has(key)) {
        roots.add(r)
      }
    }
    const properties = new Map<string, number>()
    for (let key in d.surface_properties) {
      const value = d.surface_properties[key]
      if (value !== undefined) {
        properties.set(key, value)
      }
    }
    let planet = new Planet(
      d.key,
      d.localized_name.en,
      d.order,
      d.icon_col,
      d.icon_row,
      resources,
      properties,
      d.pollutant_type ?? null,
    )
    for (let recipe of recipes.values()) {
      if (!planet.allows(recipe, buildings) || recipe.key.endsWith("-recycling")) {
        planet.disable.add(recipe)
      }
      if (roots.size > 0) {
        const recycling = new Set<Recipe>()
        for (let root of roots) {
          traverseRecycling(root, recycling)
        }
        for (let recycle of recycling) {
          planet.disable.delete(recycle)
        }
      }
    }
    planets.set(planet.key, planet)
  }
  return planets
}

function requireModelElement<T extends Element>(element: T | null, label: string): T {
  if (element === null) throw new Error(`Unable to create ${label}`)
  return element
}

function requireModelItem(items: ReadonlyMap<string, Item>, key: string): Item {
  const item = items.get(key)
  if (item === undefined) throw new Error(`Dataset is missing required item ${key}`)
  return item
}

function requireRecipe(recipes: ReadonlyMap<string, Recipe>, key: string): Recipe {
  const recipe = recipes.get(key)
  if (recipe === undefined) throw new Error(`Dataset is missing required recipe ${key}`)
  return recipe
}
// endregion models.ts

// region priorities.ts
export type PrioritizedRecipe = Recipe | DisabledRecipe

// Priority model

export interface PrioritySpecification {
  priority: PriorityList
  readonly defaultPriority: readonly ReadonlyMap<PrioritizedRecipe, Rational>[]
  readonly recipes: Map<string, Recipe>
  readonly items: Map<string, Item>
  isItemDisabled(item: Item): boolean
}

export class PriorityResource {
  level: PriorityLevel | null = null

  constructor(
    public readonly recipe: PrioritizedRecipe,
    public weight: Rational,
  ) {}
}

export class PriorityLevel implements Iterable<PriorityResource> {
  readonly resources: PriorityResource[] = []

  constructor(readonly list: PriorityList) {}

  [Symbol.iterator](): ArrayIterator<PriorityResource> {
    return this.resources[Symbol.iterator]()
  }

  equalMap(expected: ReadonlyMap<PrioritizedRecipe, Rational>): boolean {
    if (expected.size !== this.resources.length) {
      return false
    }
    return this.resources.every(({ recipe, weight }) => expected.get(recipe)?.equal(weight) === true)
  }

  has(resource: PriorityResource): boolean {
    return resource.level === this
  }

  isEmpty(): boolean {
    return this.resources.length === 0
  }

  insertSorted(resource: PriorityResource): void {
    this.list.moveResource(resource, this)
  }
}

export class PriorityList implements Iterable<PriorityLevel> {
  readonly priorities: PriorityLevel[] = []
  private readonly listeners = new Set<() => void>()
  private notificationDepth = 0
  private notificationPending = false;

  [Symbol.iterator](): ArrayIterator<PriorityLevel> {
    return this.priorities[Symbol.iterator]()
  }

  static getDefaultArray(recipes: ReadonlyMap<string, Recipe>): Map<PrioritizedRecipe, Rational>[] {
    const levels: Map<PrioritizedRecipe, Rational>[] = []
    for (const recipe of recipes.values()) {
      if (!recipe.isResource()) {
        continue
      }
      const priority = recipe.defaultPriority ?? 0
      while (levels.length <= priority) {
        levels.push(new Map())
      }
      const level = levels[priority]
      if (level === undefined || recipe.defaultWeight === undefined) {
        throw new Error(`Resource recipe ${recipe.key} is missing a default priority weight`)
      }
      level.set(recipe, recipe.defaultWeight)
    }
    return levels
  }

  static fromArray(levels: readonly ReadonlyMap<PrioritizedRecipe, Rational>[]): PriorityList {
    const priority = new PriorityList()
    priority.batch(() => {
      for (const recipes of levels) {
        const level = priority.addPriorityBefore(null)
        for (const [recipe, weight] of recipes) {
          priority.addRecipe(recipe, weight, level)
        }
      }
    })
    return priority
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  batch(operation: () => void): void {
    this.notificationDepth++
    try {
      operation()
    } finally {
      this.notificationDepth--
      if (this.notificationDepth === 0 && this.notificationPending) {
        this.notificationPending = false
        this.notify()
      }
    }
  }

  applyArray(levels: readonly ReadonlyMap<PrioritizedRecipe, Rational>[]): void {
    this.batch(() => {
      for (let index = 0; index < levels.length; index++) {
        while (this.priorities.length <= index) {
          this.addPriorityBefore(null)
        }
        const level = this.priorities[index]
        const recipes = levels[index]
        if (level === undefined || recipes === undefined) continue
        for (const [recipe, weight] of recipes) {
          const resource = this.getResource(recipe)
          if (resource === null) {
            this.addRecipe(recipe, weight, level)
          } else {
            resource.weight = weight
            this.moveResource(resource, level)
          }
        }
      }
    })
  }

  equalArray(levels: readonly ReadonlyMap<PrioritizedRecipe, Rational>[]): boolean {
    return (
      levels.length === this.priorities.length &&
      levels.every((level, index) => this.priorities[index]?.equalMap(level) === true)
    )
  }

  addPriorityBefore(level: PriorityLevel | null): PriorityLevel {
    const newLevel = new PriorityLevel(this)
    if (level === null) {
      this.priorities.push(newLevel)
    } else {
      const index = this.priorities.indexOf(level)
      if (index === -1) {
        throw new Error("Cannot insert a priority before a level that is not in this list")
      }
      this.priorities.splice(index, 0, newLevel)
    }
    this.changed()
    return newLevel
  }

  getFirstLevel(): PriorityLevel | null {
    return this.priorities[0] ?? null
  }

  getLastLevel(): PriorityLevel | null {
    return this.priorities.at(-1) ?? null
  }

  setPriority(resource: PriorityResource, level: PriorityLevel): void {
    this.moveResource(resource, level)
  }

  setWeight(resource: PriorityResource, weight: Rational): void {
    resource.weight = weight
    if (resource.level !== null) {
      this.moveResource(resource, resource.level)
    } else {
      this.changed()
    }
  }

  addRecipe(recipe: PrioritizedRecipe, weight: Rational, level: PriorityLevel): PriorityResource {
    const existing = this.getResource(recipe)
    if (existing !== null) {
      existing.weight = weight
      this.moveResource(existing, level)
      return existing
    }
    const resource = new PriorityResource(recipe, weight)
    this.insertIntoLevel(resource, level)
    this.changed()
    return resource
  }

  getResource(recipe: PrioritizedRecipe): PriorityResource | null {
    for (const level of this.priorities) {
      const resource = level.resources.find((candidate) => candidate.recipe === recipe)
      if (resource !== undefined) {
        return resource
      }
    }
    return null
  }

  getWeight(recipe: PrioritizedRecipe): Rational {
    const resource = this.getResource(recipe)
    if (resource === null) {
      throw new Error(`Recipe ${recipe?.key ?? "<unknown>"} is missing from resource priorities`)
    }
    return resource.weight
  }

  removeRecipe(recipe: PrioritizedRecipe): void {
    const resource = this.getResource(recipe)
    if (resource !== null) {
      this.removeResource(resource)
    }
  }

  removeResource(resource: PriorityResource): void {
    const level = resource.level
    if (level === null) {
      return
    }
    const index = level.resources.indexOf(resource)
    if (index !== -1) {
      level.resources.splice(index, 1)
    }
    resource.level = null
    this.removeEmptyLevels()
    this.changed()
  }

  moveResource(resource: PriorityResource, level: PriorityLevel): void {
    if (level.list !== this) {
      throw new Error("Cannot move a resource to a priority level from another list")
    }
    const currentLevel = resource.level
    if (currentLevel !== null) {
      const index = currentLevel.resources.indexOf(resource)
      if (index !== -1) {
        currentLevel.resources.splice(index, 1)
      }
    }
    this.insertIntoLevel(resource, level)
    this.removeEmptyLevels()
    this.changed()
  }

  private insertIntoLevel(resource: PriorityResource, level: PriorityLevel): void {
    resource.level = level
    const index = level.resources.findIndex((candidate) => resource.weight.less(candidate.weight))
    if (index === -1) {
      level.resources.push(resource)
    } else {
      level.resources.splice(index, 0, resource)
    }
  }

  private removeEmptyLevels(): void {
    for (let index = this.priorities.length - 1; index >= 0; index--) {
      const level = this.priorities[index]
      if (level !== undefined && level.isEmpty()) this.priorities.splice(index, 1)
    }
  }

  private changed(): void {
    if (this.notificationDepth > 0) {
      this.notificationPending = true
      return
    }
    this.notify()
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}

// Priority policy

export interface PriorityMutationList {
  getResource(recipe: PrioritizedRecipe): PriorityResource | null
  getLastLevel(): PriorityLevel | null
  addPriorityBefore(level: PriorityLevel | null): PriorityLevel
  addRecipe(recipe: PrioritizedRecipe, weight: Rational, level: PriorityLevel): PriorityResource
  removeRecipe(recipe: PrioritizedRecipe): void
}

export const DISABLED_RECIPE_PREFIX = "D-"

export function addItemToMaximumPriority(specification: { readonly priority: PriorityMutationList }, item: Item): void {
  if (specification.priority.getResource(item.disableRecipe) !== null) {
    return
  }
  let level = specification.priority.getLastLevel()
  if (level === null || ![...level].some((resource) => resource.recipe.isDisable())) {
    level = specification.priority.addPriorityBefore(null)
  }
  specification.priority.addRecipe(item.disableRecipe, Rational.from_float(100), level)
}

export function buildDefaultPriorityArray(specification: PrioritySpecification): Map<PrioritizedRecipe, Rational>[] {
  const levels: Map<PrioritizedRecipe, Rational>[] = []
  for (let recipe of specification.recipes.values()) {
    if (recipe.defaultPriority === undefined) {
      continue
    }
    while (levels.length <= recipe.defaultPriority) {
      levels.push(new Map())
    }
    let weight = recipe.defaultWeight
    const product = recipe.products[0]
    const level = levels[recipe.defaultPriority]
    if (weight === undefined || product === undefined || level === undefined) {
      throw new Error(`Recipe ${recipe.key} has incomplete priority metadata`)
    }
    if (product.item.phase === "fluid") weight = weight.div(Rational.from_float(10))
    level.set(recipe, weight)
  }
  return levels
}

export function restoreDefaultPriorities(specification: PrioritySpecification): void {
  specification.priority = PriorityList.fromArray(specification.defaultPriority)
  for (let item of specification.items.values()) {
    if (specification.isItemDisabled(item)) {
      addItemToMaximumPriority(specification, item)
    }
  }
}

export function isValidPriorityKey(specification: PrioritySpecification, key: string): boolean {
  if (key.startsWith(DISABLED_RECIPE_PREFIX)) {
    return specification.items.has(key.slice(DISABLED_RECIPE_PREFIX.length))
  }
  return specification.recipes.get(key)?.defaultPriority !== undefined
}

export function applyPriorities(
  specification: PrioritySpecification,
  tiers: readonly (readonly (readonly [string, Rational])[])[],
): void {
  let levels = tiers.map((tier) => {
    let level = new Map()
    for (let [recipeKey, weight] of tier) {
      let recipe: PrioritizedRecipe | undefined = specification.recipes.get(recipeKey)
      if (recipe === undefined && recipeKey.startsWith(DISABLED_RECIPE_PREFIX)) {
        recipe = specification.items.get(recipeKey.slice(DISABLED_RECIPE_PREFIX.length))?.disableRecipe
      }
      if (recipe === undefined) throw new Error(`Unknown priority recipe: ${recipeKey}`)
      level.set(recipe, weight)
    }
    return level
  })
  specification.priority.applyArray(levels)
}

// Resource-priority editor

let unsubscribe: (() => void) | null = null
let mountedPriority: PriorityList | null = null
let onCalculationChange: (() => void) | null = null
let draggedResource: PriorityResource | null = null

export function renderResourcePriorityEditor(priority: PriorityList, onChange: () => void) {
  if (mountedPriority !== priority) {
    unsubscribe?.()
    mountedPriority = priority
    unsubscribe = priority.subscribe(render)
  }
  onCalculationChange = onChange
  render()
}

export function unmountResourcePriorityEditor(): void {
  unsubscribe?.()
  unsubscribe = null
  mountedPriority = null
  onCalculationChange = null
  document.getElementById("resource_settings")?.replaceChildren()
}

function render(): void {
  if (mountedPriority === null) {
    return
  }

  const container = select<HTMLElement, unknown>("#resource_settings")
  container.selectAll("*").remove()

  renderBookend(container, "less valuable", () => mountedPriority!.getFirstLevel())

  mountedPriority.priorities.forEach((level, index) => {
    if (index > 0) {
      renderDropTarget(container, "middle", () => level)
    }
    renderLevel(container, level)
  })

  renderBookend(container, "more valuable", () => null)
}

function renderLevel<GElement extends Element, TDatum, PElement extends BaseType, PDatum>(
  container: Selection<GElement, TDatum, PElement, PDatum>,
  level: PriorityLevel,
): void {
  const levelElement = container.append("div").classed("resource-tier", true)
  installDropTarget(levelElement, () => level)

  for (const resource of level.resources) {
    const resourceElement = levelElement
      .append("div")
      .classed("resource", true)
      .attr("draggable", "true")
      .on("dragstart", function (this: Element, event: DragEvent) {
        if (!(this instanceof HTMLElement)) return
        draggedResource = resource
        event.dataTransfer?.setData("text/plain", resource.recipe.key ?? "resource")
        event.dataTransfer?.setDragImage(this, 24, 24)
        container.classed("dragging", true)
      })
      .on("dragend", () => {
        draggedResource = null
        container.classed("dragging", false)
      })

    resourceElement.append(() => resource.recipe.icon.make(48))
    resourceElement
      .append("input")
      .attr("type", "text")
      .attr("size", 4)
      .attr("value", resource.weight.toString())
      .on("change", function (this: Element) {
        if (!(this instanceof HTMLInputElement)) return
        mountedPriority!.setWeight(resource, Rational.from_string(this.value))
        onCalculationChange?.()
      })
  }
}

function renderBookend<GElement extends Element, TDatum, PElement extends BaseType, PDatum>(
  container: Selection<GElement, TDatum, PElement, PDatum>,
  label: string,
  level: () => PriorityLevel | null,
): void {
  const element = container.append("div").classed("resource-tier bookend", true)
  installDropTarget(element, level)
  element.append("span").text(label)
}

function renderDropTarget<GElement extends Element, TDatum, PElement extends BaseType, PDatum>(
  container: Selection<GElement, TDatum, PElement, PDatum>,
  className: string,
  level: () => PriorityLevel | null,
): void {
  const element = container.append("div").classed(className, true)
  installDropTarget(element, level)
}

function installDropTarget<GElement extends Element, TDatum, PElement extends BaseType, PDatum>(
  element: Selection<GElement, TDatum, PElement, PDatum>,
  targetLevel: () => PriorityLevel | null,
): void {
  element
    .on("dragover", (event: DragEvent) => event.preventDefault())
    .on("dragenter", function (this: Element, event: DragEvent) {
      if (!(this instanceof HTMLElement)) return
      event.preventDefault()
      this.classList.add("highlight")
    })
    .on("dragleave", function (this: Element, event: DragEvent) {
      if (!(this instanceof HTMLElement)) return
      if (event.target === this) {
        this.classList.remove("highlight")
      }
    })
    .on("drop", function (this: Element, event: DragEvent) {
      if (!(this instanceof HTMLElement)) return
      event.preventDefault()
      this.classList.remove("highlight")
      if (draggedResource === null || mountedPriority === null) {
        return
      }
      let level = targetLevel()
      if (level === null) {
        level = mountedPriority.addPriorityBefore(null)
      } else if (
        element.classed("middle") ||
        (element.classed("bookend") && level === mountedPriority.getFirstLevel())
      ) {
        level = mountedPriority.addPriorityBefore(level)
      }
      mountedPriority.setPriority(draggedResource, level)
      draggedResource = null
      onCalculationChange?.()
    })
}
// endregion priorities.ts

// region recipes.ts
function requireItem(items: ReadonlyMap<string, Item>, key: string): Item {
  const item = items.get(key)
  if (item === undefined) throw new Error(`Dataset is missing required item ${key}`)
  return item
}

function requireElement<T extends Element>(element: T | null, label: string): T {
  if (element === null) throw new Error(`Unable to create ${label}`)
  return element
}

function requireSprite(key: string): { icon: Icon } {
  const sprite = sprites.get(key)
  if (sprite === undefined) throw new Error(`Sprite sheet is missing ${key}`)
  return sprite
}

// Items

export type ItemPhase = "solid" | "fluid" | "abstract"

export class Item {
  readonly recipes: Recipe[] = []
  readonly uses: Recipe[] = []
  readonly icon: Icon
  readonly disableRecipe: DisabledRecipe
  spoilTime: Rational | null = null
  spoilResult: Item | null = null

  constructor(
    readonly key: string,
    readonly name: string,
    readonly icon_col: number,
    readonly icon_row: number,
    readonly phase: ItemPhase,
    readonly group: string,
    readonly subgroup: string,
    readonly order: string,
    readonly stackSize = 1,
  ) {
    this.icon = new Icon(this)

    this.disableRecipe = new DisabledRecipe(this)
  }
  allRecipes(): (Recipe | DisabledRecipe)[] {
    return [...this.recipes, this.disableRecipe]
  }
  addRecipe(recipe: Recipe): void {
    this.recipes.push(recipe)
  }
  addUse(recipe: Recipe): void {
    this.uses.push(recipe)
  }
  renderTooltip(extra?: Node): HTMLElement {
    if (this.recipes.length === 1 && this.recipes[0]!.name === this.name) {
      return this.recipes[0]!.renderTooltip(extra)
    }
    let self = this
    let t = create("div").classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true, undefined))
    header.append("span").text(self.name)
    if (extra) {
      requireElement(t.node(), "item tooltip").append(extra)
    }
    return requireElement(t.node(), "item tooltip")
  }
}

export function getItems(data: CalculatorData): Map<string, Item> {
  const items = new Map<string, Item>()
  for (let d of data.items) {
    if (!d.localized_name) {
      console.log("bad item:", d)
      continue
    }
    const phase: ItemPhase = d.type === "fluid" ? "fluid" : "solid"
    items.set(
      d.key,
      new Item(
        d.key,
        d.localized_name.en,
        d.icon_col,
        d.icon_row,
        phase,
        d.group,
        d.subgroup,
        d.order,
        d.stack_size ?? 1,
      ),
    )
  }
  let cycleKey = "nuclear-reactor-cycle"
  const reactor = requireItem(items, "nuclear-reactor")
  items.set(
    cycleKey,
    new Item(
      cycleKey,
      "Nuclear reactor cycle",
      reactor.icon_col,
      reactor.icon_row,
      "abstract",
      "production",
      "energy",
      "f[nuclear-energy]-d[reactor-cycle]",
    ),
  )
  return items
}

export class SurfaceCondition {
  readonly min?: number
  readonly max?: number

  constructor(
    readonly property: string,
    min: number | undefined,
    max: number | undefined,
  ) {
    if (min !== undefined) this.min = min
    if (max !== undefined) this.max = max
  }
}

export class Recipe implements SolverRecipe {
  readonly categories: Set<string>
  readonly category: string | null
  readonly icon: Icon
  readonly allow_productivity: boolean
  readonly allow_quality: boolean
  readonly defaultPriority: number | undefined = undefined
  readonly defaultWeight: Rational | undefined = undefined
  readonly processKind: string | undefined = undefined
  readonly harvestEmissions: Readonly<Record<string, Rational>> | undefined = undefined
  readonly miningTime: Rational | undefined = undefined

  constructor(
    readonly key: string,
    readonly name: string,
    readonly order: string | null,
    readonly icon_col: number,
    readonly icon_row: number,
    allowProductivity: boolean,
    allowQuality: boolean | undefined,
    categories: string | readonly string[] | null | undefined,
    readonly time: Rational,
    readonly ingredients: Ingredient<Item, Rational>[],
    readonly products: Ingredient<Item, Rational>[],
    readonly conditions: SurfaceCondition[] = [],
    readonly maximumProductivity: Rational | null = null,
  ) {
    this.allow_productivity = allowProductivity
    this.allow_quality = allowQuality !== false
    const normalizedCategories =
      categories === undefined || categories === null ? [] : typeof categories === "string" ? [categories] : categories
    this.categories = new Set(normalizedCategories)
    // Retain the old property for third-party consumers. Internal code
    // uses categories so Factorio 2.1 recipes can be made in any eligible
    // machine category.
    this.category = this.categories.values().next().value ?? null
    for (let ing of ingredients) {
      ing.item.addUse(this)
    }
    for (let ing of products) {
      ing.item.addRecipe(this)
    }

    const primaryProduct = products[0]
    if (primaryProduct === undefined) throw new Error(`Recipe ${key} has no products`)
    this.icon = new Icon(this, primaryProduct.item.name)
  }
  fuelIngredient(): Ingredient<Item, Rational>[] {
    let spec = currentSpecification()
    let building = spec.getBuilding(this)
    let fuel = spec.getFuelForRecipe(this)
    if (building === null || fuel === null) {
      return []
    }
    // baseRate = craft/s
    // basePower = J/s
    // perCraftEnergy = J/s / craft/s = J/craft
    // fuel.value = J/i
    // fuelAmount = J/craft / J/i = i/craft
    const baseRate = spec.getRecipeRate(this)
    if (baseRate === null) {
      throw new Error(`Recipe ${this.key} has no machine rate`)
    }
    let basePower = spec.getPowerUsage(this, baseRate).power
    let perCraftEnergy = basePower.div(baseRate)
    let fuelAmount = perCraftEnergy.div(fuel.value)
    return [new Ingredient(fuel.item, fuelAmount)]
  }
  getIngredients(): Ingredient<Item, Rational>[] {
    return this.ingredients.concat(this.fuelIngredient())
  }
  gives(item: Item): Rational {
    let spec = currentSpecification()
    let prodEffect = spec.getProdEffect(this).sub(one)
    for (let ing of this.products) {
      if (ing.item === item) {
        if (!prodEffect.isZero()) {
          let productiveAmount = ing.productivityAmount
          if (productiveAmount === null) {
            // Compatibility with older datasets that did not
            // export ignored_by_productivity. Their return products
            // were represented by subtracting same-item inputs.
            productiveAmount = ing.amount.sub(this.uses(item))
            if (productiveAmount.less(zero)) {
              return ing.amount
            }
          }
          return ing.amount.add(productiveAmount.mul(prodEffect))
        }
        return ing.amount
      }
    }
    throw new Error("recipe does not give item")
  }
  // There's an asymmetry with gives() here: It returns zero if the recipe
  // does not have this item as an ingredient.
  uses(item: Item): Rational {
    for (let ing of this.getIngredients()) {
      if (ing.item === item) {
        return ing.amount
      }
    }
    return zero
  }
  isNetProducer(item: Item): boolean {
    let amount = this.gives(item)
    return zero.less(amount.sub(this.uses(item)))
  }
  isResource(): boolean {
    return false
  }
  isReal(): boolean {
    return true
  }
  isDisable(): boolean {
    return false
  }
  renderTooltip(extra?: Node): HTMLElement {
    let self = this
    let t = create("div").classed("frame recipe", true).datum(this)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true, undefined))
    let name = this.name
    if (this.products.length === 1 && this.products[0]!.item.name === this.name && one.less(this.products[0]!.amount)) {
      name = formatCanadianNumber(this.products[0]!.amount.toDecimal()) + " \u00d7 " + name
    }
    header.append("span").text("\u00A0" + name)
    if (extra) {
      requireElement(t.node(), "recipe tooltip").append(extra)
    }
    if (this.ingredients.length === 0) {
      return requireElement(t.node(), "recipe tooltip")
    }
    if (this.products.length > 1 || this.products[0]!.item.name !== this.name) {
      let productLine = t.append("div")
      productLine.append("span").text("Products:")
      let product = productLine.append("span").selectAll("span").data(this.products).join("span")
      product.append("span").text("\u00A0")
      let prodIcon = product.append("div").classed("product", true)
      prodIcon.append((d: Ingredient<Item, Rational>) => d.item.icon.make(32, true, undefined))
      prodIcon
        .append("span")
        .classed("count", true)
        .text((d: Ingredient<Item, Rational>) => formatCanadianNumber(d.amount.toDecimal()))
    }
    let time = t.append("div")
    time
      .append("div")
      .classed("product", true)
      .append(() => requireSprite("clock").icon.make(32, true, undefined))
    time.append("span").text("\u00A0" + formatCanadianNumber(this.time.toDecimal()))
    let ingredient = t.append("div").selectAll("div").data(this.ingredients).join("div")
    ingredient
      .append("div")
      .classed("product", true)
      .append((d: Ingredient<Item, Rational>) => d.item.icon.make(32, true, undefined))
    ingredient
      .append("span")
      .text(
        (d: Ingredient<Item, Rational>) => `\u00A0${formatCanadianNumber(d.amount.toDecimal())} \u00d7 ${d.item.name}`,
      )
    return requireElement(t.node(), "recipe tooltip")
  }
}

const ASTEROID_CHUNK_RESOURCE_KEYS = new Set([
  "carbonic-asteroid-chunk",
  "metallic-asteroid-chunk",
  "oxide-asteroid-chunk",
  "promethium-asteroid-chunk",
])

// Pseudo-recipe representing the ex nihilo production of items with all
// recipes disabled.
export class DisabledRecipe implements SolverRecipe {
  readonly key: string
  readonly name: string
  readonly categories = new Set<string>()
  readonly category: null = null
  readonly ingredients: Ingredient<Item, Rational>[] = []
  readonly products: Ingredient<Item, Rational>[]
  readonly icon_col: number
  readonly icon_row: number
  readonly icon: Icon

  constructor(item: Item) {
    this.key = DISABLED_RECIPE_PREFIX + item.key
    this.name = item.name
    this.products = [new Ingredient(item, one)]
    this.icon_col = item.icon_col
    this.icon_row = item.icon_row
    this.icon = new Icon(this)
  }
  getIngredients(): Ingredient<Item, Rational>[] {
    return this.ingredients
  }
  gives(item: Item): Rational {
    for (let ing of this.products) {
      if (ing.item === item) {
        return ing.amount
      }
    }
    throw new Error(`Disabled recipe ${this.key} does not produce ${item.key}`)
  }
  isResource(): boolean {
    return false
  }
  isReal(): boolean {
    return true
  }
  isDisable(): boolean {
    return true
  }
}

function getResultProbability(result: RecipeAmountData): number | null {
  let probability = result.independent_probability ?? result.probability ?? 1
  if (result.shared_probability !== undefined) {
    let min = result.shared_probability.min ?? 0
    let max = result.shared_probability.max ?? 1
    probability *= max - min
  }
  return probability === 1 ? null : probability
}

function applyResultProbability(amount: Rational, result: RecipeAmountData): Rational {
  let probability = getResultProbability(result)
  if (probability !== null) {
    amount = amount.mul(Rational.from_float_approximate(probability))
  }
  return amount
}

export function getExpectedResultAmount(result: RecipeAmountData): Rational {
  let amount
  if (result.amount !== undefined) {
    amount = Rational.from_float_approximate(result.amount)
  } else if (result.amount_min !== undefined || result.amount_max !== undefined) {
    const min = result.amount_min ?? result.amount_max
    const max = result.amount_max ?? result.amount_min
    if (min === undefined || max === undefined) throw new Error("Recipe result range is incomplete")
    amount = Rational.from_float_approximate((min + max) / 2)
  } else {
    amount = one
  }

  if (result.extra_count_fraction !== undefined) {
    amount = amount.add(Rational.from_float_approximate(result.extra_count_fraction))
  }

  return applyResultProbability(amount, result)
}

function getProductivityAmount(result: RecipeAmountData, totalAmount: Rational): Rational | null {
  if (result.ignored_by_productivity === undefined) {
    return null
  }
  let ignored = Rational.from_float_approximate(result.ignored_by_productivity)
  ignored = applyResultProbability(ignored, result)
  return totalAmount.sub(ignored)
}

function makeRecipe(_data: CalculatorData, items: Map<string, Item>, d: RecipeData): Recipe | null {
  let time = Rational.from_float_approximate(d.energy_required)
  const products: Ingredient<Item, Rational>[] = []
  for (let result of d.results) {
    const item = items.get(result.name)
    if (item === undefined) return null
    let amount = getExpectedResultAmount(result)
    products.push(new Ingredient(item, amount, getProductivityAmount(result, amount)))
  }
  const ingredients: Ingredient<Item, Rational>[] = []
  for (let { name, amount } of d.ingredients) {
    const item = items.get(name)
    if (!item) {
      return null
    }
    if (amount === undefined) return null
    ingredients.push(new Ingredient(item, Rational.from_float_approximate(amount)))
  }
  const conditions: SurfaceCondition[] = []
  if (d.surface_conditions) {
    for (let { property, min, max } of d.surface_conditions) {
      conditions.push(new SurfaceCondition(property, min, max))
    }
  }
  return new Recipe(
    d.key,
    d.localized_name.en,
    d.order,
    d.icon_col,
    d.icon_row,
    d.allow_productivity,
    d.allow_quality,
    d.categories ?? d.category,
    time,
    ingredients,
    products,
    conditions,
    Rational.from_float_approximate(d.maximum_productivity ?? 3),
  )
}

export class RecipeMap extends Map<string, Recipe> {
  private readonly aliases: Map<string, string>

  constructor(aliases: Record<string, string> | undefined) {
    super()
    this.aliases = new Map(Object.entries(aliases ?? {}))
  }
  resolveKey(key: string): string {
    return this.aliases.get(key) ?? key
  }
  override get(key: string): Recipe | undefined {
    return super.get(this.resolveKey(key))
  }
  override has(key: string): boolean {
    return super.has(this.resolveKey(key))
  }
}

export class ResourceRecipe extends Recipe {
  override readonly defaultPriority: number
  override readonly defaultWeight: Rational

  constructor(item: Item, category: string | null, priority: number, weight: Rational) {
    super(
      item.key,
      item.name,
      item.order,
      item.icon_col,
      item.icon_row,
      false,
      true,
      category,
      zero,
      [],
      [new Ingredient(item, one)],
      [],
    )
    this.defaultPriority = priority
    this.defaultWeight = weight
  }
  override isResource(): boolean {
    return true
  }
}

export class SpoilageRecipe extends Recipe {
  override readonly processKind = "spoilage"

  constructor(from_item: Item, to_item: Item, spoilTime: Rational) {
    let key = `${from_item.key}-spoilage`
    let name = `${from_item.name} to ${to_item.name} (Spoilage)`
    super(
      key,
      name,
      null,
      to_item.icon_col,
      to_item.icon_row,
      false,
      true,
      null,
      spoilTime,
      [new Ingredient(from_item, one)],
      [new Ingredient(to_item, one)],
      [],
    )
  }
}

export class PlantRecipe extends Recipe {
  override readonly processKind = "growth"
  override readonly harvestEmissions: Readonly<Record<string, Rational>>
  override readonly defaultPriority = 1
  override readonly defaultWeight = Rational.from_float(100)

  constructor(
    key: string,
    name: string,
    order: string | null,
    col: number,
    row: number,
    seed: Item,
    results: Ingredient<Item, Rational>[],
    conditions: SurfaceCondition[],
    growthTime: Rational,
    harvestEmissions: Readonly<Record<string, number>> = {},
  ) {
    super(
      key,
      name,
      order,
      col,
      row,
      false,
      true,
      "agriculture",
      growthTime,
      [new Ingredient(seed, one)],
      results,
      conditions,
    )
    this.harvestEmissions = Object.fromEntries(
      Object.entries(harvestEmissions).map(([pollutant, amount]) => [
        pollutant,
        Rational.from_float_approximate(amount),
      ]),
    )
  }
  override isResource(): boolean {
    return true
  }
}

export class MiningRecipe extends Recipe {
  override readonly miningTime: Rational
  override readonly defaultPriority = 1
  override readonly defaultWeight = Rational.from_float(100)

  constructor(
    key: string,
    name: string,
    order: string | null,
    col: number,
    row: number,
    category: string,
    miningTime: Rational,
    ingredients: Ingredient<Item, Rational>[] | null,
    products: Ingredient<Item, Rational>[],
  ) {
    if (!ingredients) {
      ingredients = []
    }
    super(key, name, order, col, row, true, true, category, zero, ingredients, products, [])
    this.miningTime = miningTime
  }
  override isResource(): boolean {
    return true
  }
}

export class OffshorePumpRecipe extends Recipe {
  override readonly defaultPriority = 0
  override readonly defaultWeight = Rational.from_float(100)

  constructor(key: string, name: string, order: string | null, col: number, row: number, product: Item) {
    super(key, name, order, col, row, false, true, "offshore-pumping", zero, [], [new Ingredient(product, one)], [])
  }
  override isResource(): boolean {
    return true
  }
}

function getSteam(data: CalculatorData): [Rational, Rational] {
  let R = Rational.from_float
  let boilerDef = data.boilers.find((entry) => entry.key === "boiler")
  let water = data.fluids.find((entry) => entry.item_key === "water")
  let steam = data.fluids.find((entry) => entry.item_key === "steam")
  if (boilerDef === undefined || water === undefined || steam === undefined) {
    throw new Error("Dataset is missing the base boiler, water, or steam prototype")
  }
  let power = R(boilerDef.energy_consumption)
  let tempDelta = R(boilerDef.target_temperature).sub(R(water.default_temperature))
  // heat_capacity is denominated in J/degrees C/unit.
  let waterCap = R(water.heat_capacity)
  let steamCap = R(steam.heat_capacity)
  // water/second
  let waterRate = power.div(tempDelta.mul(waterCap))
  // steam/second
  let steamRate = power.div(tempDelta.mul(steamCap))
  return [waterRate, steamRate]
}

export function getRecipes(data: CalculatorData, items: Map<string, Item>): RecipeMap {
  let hundred = Rational.from_float(100)
  let recipes = new RecipeMap(data.recipe_aliases)
  let reactor = requireItem(items, "nuclear-reactor")
  let used_cell_name = "used-up-uranium-fuel-cell"
  if (!items.has(used_cell_name)) {
    used_cell_name = "depleted-uranium-fuel-cell"
  }
  recipes.set(
    "nuclear-reactor-cycle",
    new Recipe(
      "nuclear-reactor-cycle",
      "Nuclear reactor cycle",
      reactor.order,
      reactor.icon_col,
      reactor.icon_row,
      false,
      true,
      "nuclear",
      Rational.from_float(200),
      [new Ingredient(requireItem(items, "uranium-fuel-cell"), one)],
      [
        new Ingredient(requireItem(items, used_cell_name), one),
        new Ingredient(requireItem(items, "nuclear-reactor-cycle"), one),
      ],
    ),
  )
  if (items.has("satellite")) {
    let rocket = requireItem(items, "rocket-silo")
    recipes.set(
      "rocket-launch",
      new Recipe(
        "rocket-launch",
        "Rocket launch",
        rocket.order,
        rocket.icon_col,
        rocket.icon_row,
        false,
        true,
        "rocket-launch",
        one,
        [
          new Ingredient(
            requireItem(items, "rocket-part"),
            Rational.from_float_approximate(data.rocket_launch?.parts_per_launch ?? 100),
          ),
          new Ingredient(requireItem(items, "satellite"), one),
        ],
        [new Ingredient(requireItem(items, "space-science-pack"), Rational.from_float(1000))],
      ),
    )
  }
  let steam = requireItem(items, "steam")
  let [waterRate, steamRate] = getSteam(data)
  recipes.set(
    "steam",
    new Recipe(
      "steam",
      "Steam",
      steam.order,
      steam.icon_col,
      steam.icon_row,
      false,
      true,
      "boiler",
      one,
      [new Ingredient(requireItem(items, "water"), waterRate)],
      [new Ingredient(requireItem(items, "steam"), steamRate)],
    ),
  )
  for (let d of data.recipes) {
    /*if (d.key.endsWith("-recycling")) {
            continue
        }*/
    let r = makeRecipe(data, items, d)
    if (r) {
      recipes.set(d.key, r)
    }
  }
  for (let d of data.resources) {
    let category = d.category
    if (!category) {
      category = "basic-solid"
    }
    if (category === "basic-fluid") {
      const products: Ingredient<Item, Rational>[] = []
      for (let result of d.results) {
        products.push(new Ingredient(requireItem(items, result.name), getExpectedResultAmount(result)))
      }
      recipes.set(
        d.key,
        new MiningRecipe(
          d.key,
          d.localized_name.en,
          d.order ?? null,
          d.icon_col,
          d.icon_row,
          category,
          Rational.from_float_approximate(d.mining_time),
          [],
          products,
        ),
      )
      continue
    }
    let ingredients = null
    if (d.required_fluid !== undefined && d.fluid_amount !== undefined) {
      ingredients = [
        new Ingredient(requireItem(items, d.required_fluid), Rational.from_float_approximate(d.fluid_amount / 10)),
      ]
    }
    const products: Ingredient<Item, Rational>[] = []
    for (let result of d.results) {
      products.push(new Ingredient(requireItem(items, result.name), getExpectedResultAmount(result)))
    }
    recipes.set(
      d.key,
      new MiningRecipe(
        d.key,
        d.localized_name.en,
        d.order ?? null,
        d.icon_col,
        d.icon_row,
        category,
        Rational.from_float_approximate(d.mining_time),
        ingredients,
        products,
      ),
    )
  }
  const offshoreItems = new Set<string>()
  if (data.planets) {
    for (let planet of data.planets) {
      for (let key of planet.resources.offshore ?? []) {
        offshoreItems.add(key)
      }
    }
  } else {
    offshoreItems.add("water")
  }
  for (let key of offshoreItems) {
    const item = requireItem(items, key)
    const r = new OffshorePumpRecipe(key, item.name, item.order, item.icon_col, item.icon_row, item)
    if (recipes.has(key)) {
      console.log("duplicate key:", key)
    }
    recipes.set(key, r)
  }
  if (data.plants) {
    for (let plant of data.plants) {
      const results: Ingredient<Item, Rational>[] = []
      for (let result of plant.results) {
        results.push(new Ingredient(requireItem(items, result.name), getExpectedResultAmount(result)))
      }
      const conditions: SurfaceCondition[] = []
      if (plant.surface_conditions) {
        for (let { property, min, max } of plant.surface_conditions) {
          conditions.push(new SurfaceCondition(property, min, max))
        }
      }
      let r = new PlantRecipe(
        plant.key,
        plant.localized_name.en,
        plant.order ?? null,
        plant.icon_col,
        plant.icon_row,
        requireItem(items, plant.seed),
        results,
        conditions,
        Rational.from_float_approximate(plant.growth_ticks / 60),
        plant.harvest_emissions ?? {},
      )
      recipes.set(plant.key, r)
    }
  }
  if (data.spoilage) {
    for (let spoil of data.spoilage) {
      const from_item = requireItem(items, spoil.from_item)
      const to_item = requireItem(items, spoil.to_item)
      let spoilTime = Rational.from_float_approximate(spoil.time / 60)
      from_item.spoilTime = spoilTime
      from_item.spoilResult = to_item
      let r = new SpoilageRecipe(from_item, to_item, spoilTime)
      recipes.set(r.key, r)
    }
  }
  // Asteroid chunks are gathered directly by platform collectors. They may
  // also be returned by processing recipes, so they need explicit resource
  // recipes even though they already have other producers.
  for (let itemKey of ASTEROID_CHUNK_RESOURCE_KEYS) {
    let item = items.get(itemKey)
    if (item !== undefined && !recipes.has(itemKey)) {
      recipes.set(itemKey, new ResourceRecipe(item, null, 1, hundred))
    }
  }

  // Reap items both produced by no recipes and consumed by no recipes.
  let reapItems = []
  for (let [itemKey, item] of items) {
    if (item.recipes.length === 0 && item.uses.length === 0) {
      reapItems.push(itemKey)
    } else if (item.recipes.length === 0) {
      console.log("item with no recipes:", item)
      let priority = ASTEROID_CHUNK_RESOURCE_KEYS.has(itemKey) ? 1 : 2
      recipes.set(itemKey, new ResourceRecipe(item, null, priority, hundred))
    }
  }
  for (let key of reapItems) {
    items.delete(key)
  }
  return recipes
}

export interface RecipeSettingsSpecification {
  readonly recipes: Map<string, Recipe>
  readonly buildingKeys: Map<string, { readonly name: string; canCraft(recipe: Recipe): boolean }> | null
  readonly planetaryBaseline: Set<Recipe> | null
  readonly disable: Set<Recipe>
  readonly ignore: Set<Item>
  readonly buildTargets: readonly {
    readonly item: Item
    readonly recipe: Recipe | null
    readonly changedBuilding: boolean
    displayRecipes(): void
  }[]
  readonly priority: PriorityMutationList
}

// Recipe settings queries

const CATEGORY_ORDER = new Map([
  ["resources", 0],
  ["crafting", 10],
  ["advanced-crafting", 11],
  ["crafting-with-fluid", 12],
  ["smelting", 20],
  ["metallurgy", 21],
  ["chemistry", 30],
  ["oil-processing", 31],
  ["organic", 40],
  ["captive-spawner-process", 41],
  ["electromagnetics", 50],
  ["cryogenics", 60],
  ["crushing", 70],
  ["centrifuging", 80],
  ["rocket-building", 90],
  ["hand-crafting", 100],
  ["other", 1000],
])

function compactRecipeSearchText(value: string) {
  return normalizeSearchText(value).replace(/ /g, "")
}

export function humanizeRecipeCategory(value: string) {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function isRecyclingRecipe(recipe: Recipe): boolean {
  return recipe.categories?.has("recycling") || recipe.category === "recycling" || recipe.key.endsWith("-recycling")
}

export interface RecipeSelectorGroup {
  readonly key: string
  readonly name: string
  readonly recipes: Recipe[]
}

export function getRecipeSelectorGroups(recipes: readonly Recipe[], activeRecipe: Recipe): RecipeSelectorGroup[] {
  function orderGroup(groupRecipes: readonly Recipe[]): Recipe[] {
    return [...groupRecipes].sort((recipeA, recipeB) => {
      if (recipeA === activeRecipe) {
        return -1
      }
      if (recipeB === activeRecipe) {
        return 1
      }
      const nameOrder = recipeA.name.localeCompare(recipeB.name)
      return nameOrder === 0 ? recipeA.key.localeCompare(recipeB.key) : nameOrder
    })
  }

  const productionRecipes = recipes.filter((recipe) => !isRecyclingRecipe(recipe))
  const recyclingRecipes = recipes.filter(isRecyclingRecipe)
  return [
    { key: "production", name: "Production", recipes: orderGroup(productionRecipes) },
    { key: "recycling", name: "Recycling", recipes: orderGroup(recyclingRecipes) },
  ].filter((group) => group.recipes.length > 0)
}

export function getRecipeSettingsCategory(recipe: Recipe): string {
  if (recipe.isResource?.()) {
    return "resources"
  }
  return recipe.category ?? recipe.categories?.values().next().value ?? "other"
}

function getCompatibleBuildingNames(spec: RecipeSettingsSpecification, recipe: Recipe): string[] {
  const names = []
  for (const building of spec.buildingKeys?.values?.() ?? []) {
    if (building.canCraft?.(recipe)) {
      names.push(building.name)
    }
  }
  return names
}

export function recipeMatchesSettingsSearch(spec: RecipeSettingsSpecification, recipe: Recipe, query: string) {
  const normalizedQuery = normalizeSearchText(query)
  if (normalizedQuery === "") {
    return true
  }

  const values = [
    recipe.name,
    recipe.key,
    humanizeRecipeCategory(getRecipeSettingsCategory(recipe)),
    ...recipe.products.map(({ item }) => item.name),
    ...recipe.products.map(({ item }) => item.key),
    ...recipe.getIngredients().map(({ item }) => item.name),
    ...recipe.getIngredients().map(({ item }) => item.key),
    ...getCompatibleBuildingNames(spec, recipe),
  ]
  const normalizedValues = values.map(normalizeSearchText)
  const compactQuery = compactRecipeSearchText(normalizedQuery)

  if (normalizedValues.some((value) => compactRecipeSearchText(value).includes(compactQuery))) {
    return true
  }

  return normalizedQuery.split(" ").every((token) => normalizedValues.some((value) => value.includes(token)))
}

export function getConfigurableRecipes(spec: RecipeSettingsSpecification): Recipe[] {
  return [...spec.recipes.values()].filter((recipe) => recipe.isReal() && !recipe.isDisable())
}

export function isRecipeUnavailable(spec: RecipeSettingsSpecification, recipe: Recipe): boolean {
  return spec.planetaryBaseline?.has(recipe) ?? false
}

export function recipeVisibleInSettings(
  spec: RecipeSettingsSpecification,
  recipe: Recipe,
  options: {
    searchText: string
    showUnavailable: boolean
  },
) {
  return (
    (options.showUnavailable || !isRecipeUnavailable(spec, recipe)) &&
    recipeMatchesSettingsSearch(spec, recipe, options.searchText)
  )
}

function categorySortKey(category: string) {
  return CATEGORY_ORDER.get(category) ?? 500
}

export interface RecipeSettingsGroup {
  readonly category: string
  readonly name: string
  readonly recipes: Recipe[]
}

export function groupRecipesForSettings(recipes: readonly Recipe[]): RecipeSettingsGroup[] {
  const groups = new Map<string, Recipe[]>()
  for (const recipe of recipes) {
    const category = getRecipeSettingsCategory(recipe)
    const group = groups.get(category) ?? []
    group.push(recipe)
    groups.set(category, group)
  }

  return [...groups.entries()]
    .sort(([categoryA], [categoryB]) => {
      const order = categorySortKey(categoryA) - categorySortKey(categoryB)
      return order === 0 ? categoryA.localeCompare(categoryB) : order
    })
    .map(([category, categoryRecipes]) => ({
      category,
      name: humanizeRecipeCategory(category),
      recipes: sorted(categoryRecipes, (recipe) => recipe.order ?? recipe.name),
    }))
}

// Recipe policy

function refreshTargetsForItems(specification: RecipeSettingsSpecification, items: ReadonlySet<Item>): void {
  for (let target of specification.buildTargets) {
    if (items.has(target.item)) {
      target.displayRecipes()
    }
  }
}

export function disableRecipe(specification: RecipeSettingsSpecification, recipe: Recipe): void {
  if (specification.disable.has(recipe)) {
    return
  }
  let candidateItems = new Set<Item>()
  let affectedItems = new Set<Item>()
  for (let product of recipe.products) {
    let item = product.item
    affectedItems.add(item)
    if (!isItemDisabled(specification, item) && !specification.ignore.has(item)) {
      candidateItems.add(item)
    }
  }
  specification.disable.add(recipe)
  for (let item of candidateItems) {
    if (isItemDisabled(specification, item)) {
      addItemToMaximumPriority(specification, item)
    }
  }
  refreshTargetsForItems(specification, affectedItems)
}

export function enableRecipe(specification: RecipeSettingsSpecification, recipe: Recipe): void {
  if (!specification.disable.has(recipe)) {
    return
  }
  let candidateItems = new Set<Item>()
  let affectedItems = new Set<Item>()
  for (let product of recipe.products) {
    let item = product.item
    affectedItems.add(item)
    if (isItemDisabled(specification, item) && !specification.ignore.has(item)) {
      candidateItems.add(item)
    }
  }
  specification.disable.delete(recipe)
  for (let item of candidateItems) {
    if (!isItemDisabled(specification, item)) {
      specification.priority.removeRecipe(item.disableRecipe)
    }
  }
  refreshTargetsForItems(specification, affectedItems)
}

export function getEnabledUses(specification: RecipeSettingsSpecification, item: Item): Recipe[] {
  return item.uses.filter((recipe) => !specification.disable.has(recipe))
}

export function isItemDisabled(specification: RecipeSettingsSpecification, item: Item): boolean {
  return !item.recipes.some((recipe) => !specification.disable.has(recipe) && recipe.isNetProducer(item))
}

export function getEnabledRecipes(specification: RecipeSettingsSpecification, item: Item): (Recipe | DisabledRecipe)[] {
  let enabled = item.recipes.filter((recipe) => !specification.disable.has(recipe))
  if (!isItemDisabled(specification, item) && !specification.ignore.has(item)) {
    return enabled
  }
  return [
    item.disableRecipe,
    ...enabled.filter((recipe) => recipe.products.some((product) => !specification.ignore.has(product.item))),
  ]
}

function addItemGraph(
  specification: RecipeSettingsSpecification,
  item: Item,
  graph: Set<Recipe | DisabledRecipe>,
): void {
  for (let recipe of getEnabledRecipes(specification, item)) {
    if (graph.has(recipe)) {
      continue
    }
    graph.add(recipe)
    for (let ingredient of recipe.getIngredients()) {
      addItemGraph(specification, ingredient.item, graph)
    }
  }
}

export function getRecipeGraph(
  specification: RecipeSettingsSpecification,
  items: ReadonlyMap<Item, Rational>,
): Set<Recipe | DisabledRecipe> {
  const graph = new Set<Recipe | DisabledRecipe>()
  for (let item of items.keys()) {
    addItemGraph(specification, item, graph)
  }
  return graph
}

export function isFactoryTarget(specification: RecipeSettingsSpecification, recipe: Recipe): boolean {
  return specification.buildTargets.some((target) => target.recipe === recipe && target.changedBuilding)
}
// endregion recipes.ts

// region quality/contracts.ts
export type QualityStrategy = "direct" | "auto"
export type QualityOptimizationObjective = "configured" | "materials" | "machines" | "power"
export type QualityPlannerObjective = "practical" | "materials" | "machines" | "power"
export type QualityPlanProfile = "planet" | "vulcanus"

export function isQualityStrategy(value: string): value is QualityStrategy {
  return value === "direct" || value === "auto"
}

export function isQualityPlannerObjective(value: string): value is QualityPlannerObjective {
  return value === "practical" || value === "materials" || value === "machines" || value === "power"
}

export interface QualifiedItemAmount {
  readonly item: Item
  readonly qualityLevel: number
  readonly amount: Rational
}

export interface QualityTierConfiguration {
  readonly qualityLevel: number
  readonly building: Building | null
  readonly machineQuality: Quality
  readonly modules: readonly (Module | null)[]
  readonly moduleQualities: readonly Quality[]
  readonly beaconModules: readonly (Module | null)[]
  readonly beaconModuleQualities: readonly Quality[]
  readonly beaconQuality: Quality
  readonly beaconCount: Rational
  readonly qualityChance: Rational
  readonly productivity: Rational
  readonly speedEffect: Rational
  readonly powerEffect: Rational
}

export interface QualityOperationRate {
  readonly recipe: Recipe
  readonly qualityLevel: number
  readonly rate: Rational
  readonly machineCount: Rational
  readonly power: Rational
  readonly kind: "craft" | "recycle" | "source" | "dispose"
  readonly configuration: QualityTierConfiguration
}

export interface QualityTargetPlan {
  readonly profile: QualityPlanProfile
  readonly planetKey: string
  readonly objective: QualityOptimizationObjective
  readonly item: Item
  readonly recipe: Recipe
  readonly recyclerRecipe: Recipe | null
  readonly qualityLevel: number
  readonly requested: Rational
  readonly firstPassChance: Rational
  readonly freshInputs: readonly QualifiedItemAmount[]
  readonly importedInputs: readonly QualifiedItemAmount[]
  readonly fluidInputs: readonly QualifiedItemAmount[]
  readonly surplusOutputs: readonly QualifiedItemAmount[]
  readonly operations: readonly QualityOperationRate[]
  readonly totalCrafts: Rational
  readonly totalRecycles: Rational
  readonly totalMachineCount: Rational
  readonly totalPower: Rational
  readonly warnings: readonly string[]
}
// endregion quality/contracts.ts

// region quality/math.ts
const CONTINUATION_CHANCE = Rational.from_floats(1, 10)
const STOP_AFTER_UPGRADE_CHANCE = Rational.from_floats(9, 10)

/**
 * Exact probability that one quality roll moves an item from `fromLevel` to
 * `toLevel`. Levels are sequential quality indexes, not prototype level
 * values (Legendary is index 4 even though its prototype level is 5).
 */
export function qualityTransitionProbability(
  chance: Rational,
  fromLevel: number,
  toLevel: number,
  maxLevel: number,
): Rational {
  if (fromLevel < 0 || toLevel < fromLevel || maxLevel < 0 || fromLevel > maxLevel || toLevel > maxLevel) {
    return zero
  }
  if (fromLevel === maxLevel) return toLevel === maxLevel ? one : zero

  const normalizedChance = Rational.max(zero, Rational.min(one, chance))
  if (toLevel === fromLevel) return one.sub(normalizedChance)

  const upgrades = toLevel - fromLevel
  const repeated = CONTINUATION_CHANCE.pow(upgrades - 1)
  return toLevel === maxLevel
    ? normalizedChance.mul(repeated)
    : normalizedChance.mul(STOP_AFTER_UPGRADE_CHANCE).mul(repeated)
}

export function qualityTransitionDistribution(
  chance: Rational,
  fromLevel: number,
  maxLevel: number,
): readonly Rational[] {
  return Array.from({ length: maxLevel + 1 }, (_, toLevel) =>
    qualityTransitionProbability(chance, fromLevel, toLevel, maxLevel),
  )
}

/** Solve A x = b exactly. Throws for singular or underdetermined systems. */
export function solveExactLinearSystem(
  coefficients: readonly (readonly Rational[])[],
  rhs: readonly Rational[],
): Rational[] {
  const size = coefficients.length
  if (size === 0 || rhs.length !== size || coefficients.some((row) => row.length !== size)) {
    throw new Error("Quality flow requires a non-empty square linear system")
  }

  const augmented = new Matrix(size, size + 1)
  for (let row = 0; row < size; row++) {
    const coefficientRow = coefficients[row]
    if (coefficientRow === undefined) throw new Error("Missing quality-flow coefficient row")
    for (let column = 0; column < size; column++) {
      const value = coefficientRow[column]
      if (value === undefined) throw new Error("Missing quality-flow coefficient")
      augmented.setIndex(row, column, value)
    }
    const result = rhs[row]
    if (result === undefined) throw new Error("Missing quality-flow result")
    augmented.setIndex(row, size, result)
  }

  const pivots = augmented.rref()
  if (pivots.length !== size || pivots.some((pivot, index) => pivot !== index)) {
    throw new Error("Quality flow contains a neutral or non-consuming cycle")
  }
  return Array.from({ length: size }, (_, row) => augmented.index(row, size))
}

function bigintGcd(left: bigint, right: bigint): bigint {
  left = left < 0n ? -left : left
  right = right < 0n ? -right : right
  while (right !== 0n) {
    const remainder = left % right
    left = right
    right = remainder
  }
  return left
}

function bigintLcm(left: bigint, right: bigint): bigint {
  return (left / bigintGcd(left, right)) * right
}

/**
 * Solve A x = b exactly with fraction-free Bareiss elimination.
 *
 * This avoids constructing and reducing a Rational for every cell update in
 * the larger optimal-basis certification systems used by the quality solver.
 */
export function solveExactLinearSystemFractionFree(
  coefficients: readonly (readonly Rational[])[],
  rhs: readonly Rational[],
): Rational[] {
  const size = coefficients.length
  if (size === 0 || rhs.length !== size || coefficients.some((row) => row.length !== size)) {
    throw new Error("Quality flow requires a non-empty square linear system")
  }

  const matrix = coefficients.map((sourceRow, row) => {
    const result = rhs[row]
    if (result === undefined) throw new Error("Missing quality-flow result")
    let denominator = result.q
    for (const value of sourceRow) denominator = bigintLcm(denominator, value.q)
    return [...sourceRow, result].map((value) => value.p * (denominator / value.q))
  })

  let previousPivot = 1n
  for (let pivotIndex = 0; pivotIndex < size - 1; pivotIndex++) {
    let pivotRow = pivotIndex
    while (pivotRow < size && matrix[pivotRow]?.[pivotIndex] === 0n) pivotRow++
    if (pivotRow === size) throw new Error("Quality flow contains a neutral or non-consuming cycle")
    if (pivotRow !== pivotIndex) {
      const current = matrix[pivotIndex]
      const replacement = matrix[pivotRow]
      if (current === undefined || replacement === undefined) throw new Error("Missing quality-flow row")
      matrix[pivotIndex] = replacement
      matrix[pivotRow] = current
    }

    const pivot = matrix[pivotIndex]?.[pivotIndex]
    const pivotValues = matrix[pivotIndex]
    if (pivot === undefined || pivot === 0n || pivotValues === undefined) {
      throw new Error("Quality flow contains a neutral or non-consuming cycle")
    }
    for (let row = pivotIndex + 1; row < size; row++) {
      const rowValues = matrix[row]
      const factor = rowValues?.[pivotIndex]
      if (rowValues === undefined || factor === undefined) throw new Error("Missing quality-flow coefficient")
      for (let column = pivotIndex + 1; column <= size; column++) {
        const value = rowValues[column]
        const pivotValue = pivotValues[column]
        if (value === undefined || pivotValue === undefined) throw new Error("Missing quality-flow coefficient")
        const numerator = value * pivot - factor * pivotValue
        if (numerator % previousPivot !== 0n) throw new Error("Fraction-free quality elimination lost exactness")
        rowValues[column] = numerator / previousPivot
      }
      rowValues[pivotIndex] = 0n
    }
    previousPivot = pivot
  }

  const solution = Array.from({ length: size }, () => zero)
  for (let row = size - 1; row >= 0; row--) {
    const rowValues = matrix[row]
    const diagonal = rowValues?.[row]
    const result = rowValues?.[size]
    if (rowValues === undefined || diagonal === undefined || result === undefined || diagonal === 0n) {
      throw new Error("Quality flow contains a neutral or non-consuming cycle")
    }
    let remainder = new Rational(result, 1n)
    for (let column = row + 1; column < size; column++) {
      const coefficient = rowValues[column]
      const value = solution[column]
      if (coefficient === undefined || value === undefined) throw new Error("Missing quality-flow coefficient")
      if (coefficient !== 0n) remainder = remainder.sub(new Rational(coefficient, 1n).mul(value))
    }
    solution[row] = remainder.div(new Rational(diagonal, 1n))
  }
  return solution
}
// endregion quality/math.ts

// region planning/contracts.ts
export const QUALITY_TIERS = ["Normal", "Uncommon", "Rare", "Epic", "Legendary"] as const

export interface PlanningTarget {
  readonly item: Item
  readonly recipe: Recipe | null
  readonly qualityLevel: number
  readonly qualityStrategy: QualityStrategy
  getRate(): Rational
}

export interface PlanningSpecification extends ModelFactorySpecification {
  readonly spec: ReadonlyMap<Recipe, ModuleSpec>
  readonly defaultModule: Module | null
  readonly maxQualityLevel: number
  readonly modules: ReadonlyMap<string, Module>
  readonly selectedPlanets: ReadonlySet<Planet>
  readonly recipeLocations: ReadonlyMap<Recipe, Planet>
  readonly asteroidLimits: ReadonlyMap<string, Rational>
  readonly freshnessDelayMinutes: Rational
  readonly bufferMinutes: Rational
  readonly beaconPower: Rational
  readonly buildTargets: readonly PlanningTarget[]
  readonly qualityPlans: readonly QualityTargetPlan[]
  getBuildingOverrideSource(recipe: Recipe): "default" | "automatic-quality" | "user"
  getBuildingOverride(recipe: Recipe): Building | null
  getCompatibleBuildings(recipe: Recipe, availableOnly?: boolean): Building[]
  getCount(recipe: Recipe, rate: Rational): Rational
  getRecipes(item: Item): (Recipe | DisabledRecipe)[]
}

export interface TransportFlow {
  readonly from: Planet
  readonly to: Planet
  readonly item: Item
  rate: Rational
  readonly fuel: boolean
}

export interface AsteroidConstraintRow {
  readonly item: Item
  readonly required: Rational
  readonly limit: Rational
  readonly exceeded: boolean
}

export interface FreshnessRow {
  readonly item: Item
  readonly remaining: Rational
  readonly effectiveRate: Rational
  readonly expired: boolean
}

export interface PollutionComponents {
  readonly machine: Rational
  readonly process: Rational
  readonly total: Rational
}

export interface LogisticsReport {
  readonly stackRate: Rational
  readonly bufferSlots: Rational
  readonly wagonLoads: Rational
}

export interface QualityTargetRow {
  readonly item: Item
  readonly recipe: Recipe
  readonly tier: (typeof QUALITY_TIERS)[number]
  readonly qualityLevel: number
  readonly chance: Rational
  readonly probability: Rational
  readonly requested: Rational
  readonly totalProduction: Rational
  readonly otherQualityByproduct: Rational
  readonly strategy: "direct"
}

export type QualityTargetFeasibility =
  | {
      status: "feasible"
      qualityChance: Rational
    }
  | {
      status: "auto-configurable"
      building: Building
      module: Module
      slotCount: number
    }
  | {
      status: "conflict"
      building: Building | null
      module: Module | null
      reason: "explicit-building" | "explicit-modules"
    }
  | {
      status: "unavailable"
      reason: "no-compatible-building" | "no-module-slots" | "no-quality-module" | "module-incompatible"
    }
// endregion planning/contracts.ts

// region planning.ts
const AQUILO_MACHINE_HEAT_KW: Readonly<Record<string, number>> = {
  "offshore-pump": 0,
  pumpjack: 50,
  "oil-refinery": 200,
  foundry: 300,
  "rocket-silo": 300,
}

const DEFAULT_AQUILO_MACHINE_HEAT_KW = 100
const AQUILO_BEACON_HEAT_W = Rational.from_integer(400_000)

function isQualityModule(module: Module | null | undefined): module is Module {
  return module !== null && module !== undefined && module.quality !== undefined && zero.less(module.quality)
}

function moduleTier(module: Module | null | undefined): number {
  if (module === null || module === undefined) return 1
  const match = String(module.key ?? "").match(/(\d+)$/)
  return match === null ? 1 : Number(match[1])
}

function getModuleSpecWithoutMutation(specification: PlanningSpecification, recipe: Recipe): ModuleSpec | null {
  return specification.spec?.get(recipe) ?? null
}

export function qualityProbability(chance: Rational, targetLevel: number, maxLevel: number): Rational {
  if (targetLevel <= 0) return one
  return qualityTransitionProbability(chance, 0, targetLevel, maxLevel)
}

export function getRecipeQualityChance(specification: PlanningSpecification, recipe: Recipe): Rational {
  if (!recipe.allow_quality) return zero
  const building = specification.getBuilding(recipe)
  if (building === null || building.moduleSlots <= 0) return zero

  const configured = getModuleSpecWithoutMutation(specification, recipe)
  if (configured?.building === building) return configured.qualityEffect()

  // Preserve the non-mutating planning boundary while still applying default
  // beaconed speed-module penalties to recipes whose ModuleSpec has not yet
  // been materialized by the Factory table.
  const defaults = new ModuleSpec(recipe, specification)
  defaults.setBuilding(building, specification)
  return defaults.qualityEffect()
}

function chooseQualityModule(
  specification: PlanningSpecification,
  recipe: Recipe,
  building: Building,
  moduleSpec: ModuleSpec | null,
  qualityModules: readonly Module[],
): Module | null {
  const compatible = qualityModules.filter((module) => module.canUse(recipe, building))
  if (compatible.length === 0) return null

  const existing = moduleSpec?.modules?.find(
    (module) => isQualityModule(module) && module.canUse(recipe, building) && compatible.includes(module),
  )
  if (existing !== undefined) return existing

  const defaultModule = specification.defaultModule
  if (isQualityModule(defaultModule) && compatible.includes(defaultModule)) {
    return defaultModule
  }

  if (defaultModule !== null && defaultModule !== undefined) {
    const preferredTier = moduleTier(defaultModule)
    const sameTier = compatible.find((module) => moduleTier(module) === preferredTier)
    if (sameTier !== undefined) return sameTier

    const lowerTiers = compatible
      .filter((module) => moduleTier(module) < preferredTier)
      .sort((a, b) => moduleTier(b) - moduleTier(a))
    if (lowerTiers.length > 0) return lowerTiers[0] ?? null
  }

  return [...compatible].sort((a, b) => moduleTier(a) - moduleTier(b))[0] ?? null
}

export function getQualityTargetFeasibility(
  specification: PlanningSpecification,
  recipe: Recipe | null | undefined,
  qualityLevel: number,
  options: { ignoreExplicit?: boolean } = {},
): QualityTargetFeasibility {
  if (qualityLevel <= 0) {
    return { status: "feasible", qualityChance: one }
  }

  if (recipe === null || recipe === undefined || qualityLevel > specification.maxQualityLevel) {
    return { status: "unavailable", reason: "no-quality-module" }
  }

  const qualityChance = getRecipeQualityChance(specification, recipe)
  if (!qualityProbability(qualityChance, qualityLevel, specification.maxQualityLevel).isZero()) {
    return { status: "feasible", qualityChance }
  }

  const currentBuilding = specification.getBuilding(recipe)
  const moduleSpec = getModuleSpecWithoutMutation(specification, recipe)
  const buildingOverrideSource = specification.getBuildingOverrideSource(recipe)
  if (!options.ignoreExplicit && buildingOverrideSource === "user") {
    return {
      status: "conflict",
      building: currentBuilding,
      module: moduleSpec?.modules?.find((module) => module !== null) ?? null,
      reason: "explicit-building",
    }
  }
  if (!options.ignoreExplicit && moduleSpec?.moduleSource === "user") {
    return {
      status: "conflict",
      building: currentBuilding,
      module: moduleSpec.modules.find((module) => module !== null) ?? null,
      reason: "explicit-modules",
    }
  }

  const compatibleBuildings = specification.getCompatibleBuildings(recipe, true)
  if (compatibleBuildings.length === 0) {
    return { status: "unavailable", reason: "no-compatible-building" }
  }

  const qualityModules = [...specification.modules.values()].filter(isQualityModule)
  if (qualityModules.length === 0) {
    return { status: "unavailable", reason: "no-quality-module" }
  }

  const orderedBuildings =
    currentBuilding !== null && compatibleBuildings.includes(currentBuilding)
      ? [currentBuilding, ...compatibleBuildings.filter((building) => building !== currentBuilding)]
      : compatibleBuildings
  let moduleCapableBuilding = false
  for (const building of orderedBuildings) {
    if (building.moduleSlots <= 0) continue
    moduleCapableBuilding = true
    const module = chooseQualityModule(specification, recipe, building, moduleSpec, qualityModules)
    if (module !== null) {
      return {
        status: "auto-configurable",
        building,
        module,
        slotCount: building.moduleSlots,
      }
    }
  }

  if (!moduleCapableBuilding) {
    return { status: "unavailable", reason: "no-module-slots" }
  }
  return { status: "unavailable", reason: "module-incompatible" }
}

export function getQualityTargetMultiplier(
  specification: PlanningSpecification,
  recipe: Recipe,
  qualityLevel: number,
): Rational {
  if (!qualityLevel) return one
  const chance = getRecipeQualityChance(specification, recipe)
  const probability = qualityProbability(chance, qualityLevel, specification.maxQualityLevel)
  if (probability.isZero()) {
    const tier = QUALITY_TIERS[qualityLevel] ?? `quality ${qualityLevel}`
    throw new Error(
      `${recipe.name} cannot produce ${tier} output with the current quality settings. Choose a lower tier or add quality modules.`,
    )
  }
  return probability.reciprocate()
}

export function getCompatibleLocations(
  specification: PlanningSpecification,
  recipe: Recipe,
  building: Building | null = null,
): Planet[] {
  if (!specification.selectedPlanets?.size || !recipe.isReal() || recipe.isDisable()) return []
  return [...specification.selectedPlanets]
    .filter((location) => location.allowsRecipe(recipe) && (building === null || location.allowsBuilding(building)))
    .sort((a, b) => String(a.order).localeCompare(String(b.order)))
}

export function getAssignedLocation(
  specification: PlanningSpecification,
  recipe: Recipe,
  building: Building | null = null,
): Planet | null {
  const compatible = getCompatibleLocations(specification, recipe, building)
  const assigned = specification.recipeLocations.get(recipe)
  if (assigned && compatible.includes(assigned)) return assigned
  return compatible[0] ?? null
}

export function getTransportFlows(specification: PlanningSpecification, totals: Totals): TransportFlow[] {
  const flows = new Map<string, TransportFlow>()
  for (const link of totals.proportionate) {
    if (!(link.from instanceof Recipe) || !(link.to instanceof Recipe) || !(link.item instanceof Item)) continue
    if (!link.from.isReal() || !link.to.isReal() || link.from.isDisable() || link.to.isDisable()) continue
    const from = getAssignedLocation(specification, link.from, specification.getBuilding(link.from))
    const to = getAssignedLocation(specification, link.to, specification.getBuilding(link.to))
    if (!from || !to || from === to) continue
    const key = `${from.key}\u0000${to.key}\u0000${link.item.key}`
    const existing = flows.get(key)
    if (existing) {
      existing.rate = existing.rate.add(link.rate)
    } else {
      flows.set(key, { from, to, item: link.item, rate: link.rate, fuel: link.fuel })
    }
  }
  return [...flows.values()].sort((a, b) =>
    `${a.from.order}:${a.to.order}:${a.item.order}`.localeCompare(`${b.from.order}:${b.to.order}:${b.item.order}`),
  )
}

export function getAsteroidConstraintReport(
  specification: PlanningSpecification,
  totals: Totals,
): AsteroidConstraintRow[] {
  const report: AsteroidConstraintRow[] = []
  for (const [itemKey, limit] of specification.asteroidLimits) {
    const item = specification.items.get(itemKey)
    if (!item) continue
    const required = totals.items.get(item) ?? zero
    report.push({ item, required, limit, exceeded: limit.less(required) })
  }
  return report
}

export function getFreshnessReport(specification: PlanningSpecification, totals: Totals): FreshnessRow[] {
  const delaySeconds = specification.freshnessDelayMinutes.mul(Rational.from_float(60))
  const rows: FreshnessRow[] = []
  for (const [item, rate] of totals.items) {
    if (!(item instanceof Item)) continue
    if (!item.spoilTime || item.spoilTime.isZero()) continue
    const remaining = Rational.max(zero, one.sub(delaySeconds.div(item.spoilTime)))
    const effectiveRate = item.key === "agricultural-science-pack" ? rate.mul(remaining) : rate
    rows.push({ item, remaining, effectiveRate, expired: remaining.isZero() })
  }
  return rows.sort((a, b) => a.remaining.toFloat() - b.remaining.toFloat())
}

function buildingEmissions(building: Building | null, pollutant: string): Rational {
  const value = building?.emissions?.[pollutant] ?? zero
  return value instanceof Rational ? value : Rational.from_float_approximate(value)
}

function recipeEmissions(recipe: Recipe, pollutant: string): Rational {
  const value = recipe.harvestEmissions?.[pollutant] ?? zero
  return value instanceof Rational ? value : Rational.from_float_approximate(value)
}

export function getPollutionComponents(
  specification: PlanningSpecification,
  recipe: Recipe,
  rate: Rational,
  pollutant = "pollution",
): PollutionComponents {
  const building = specification.getBuilding(recipe)
  if (!building) return { machine: zero, process: zero, total: zero }

  const location = getAssignedLocation(specification, recipe, building)
  if (location !== null && location.pollutantType !== pollutant) {
    return { machine: zero, process: zero, total: zero }
  }

  let count = specification.getCount(recipe, rate)
  // Agricultural towers emit spores continuously, including while waiting for
  // plants to mature. Their fixed emissions therefore scale with placed towers,
  // not average tower utilization.
  if (recipe.processKind === "growth" && pollutant === "spores") count = count.ceil()

  const moduleSpec = specification.getModuleSpec(recipe)
  const pollutionEffect = moduleSpec?.pollutionEffect() ?? one
  const consumptionEffect = moduleSpec?.powerEffect(specification) ?? one
  const machine = buildingEmissions(building, pollutant).mul(count).mul(consumptionEffect).mul(pollutionEffect)
  const process = recipeEmissions(recipe, pollutant).mul(rate).mul(Rational.from_float(60))
  return { machine, process, total: machine.add(process) }
}

export function getPollution(
  specification: PlanningSpecification,
  recipe: Recipe,
  rate: Rational,
  pollutant = "pollution",
): Rational {
  return getPollutionComponents(specification, recipe, rate, pollutant).total
}

export function getRocketLaunchReport(specification: PlanningSpecification, totals: Totals) {
  const recipe = specification.recipes.get("rocket-part")
  if (!recipe) return null
  const rate = totals.rates.get(recipe)
  if (!rate || rate.isZero()) return null
  const building = specification.getBuilding(recipe)
  const stats = building instanceof RocketSilo ? building.getLaunchStats(specification) : null
  if (!stats) return null

  const exactSilos = specification.getCount(recipe, rate)
  const placedSilos = exactSilos.ceil()
  return {
    recipe,
    building,
    recipeRate: rate,
    exactSilos,
    placedSilos,
    launches: rate.div(stats.craftsPerLaunch),
    placedLaunchCapacity: stats.launch.mul(placedSilos),
    ...stats,
  }
}

export function getBeaconPower(specification: PlanningSpecification, recipe: Recipe, rate: Rational): Rational {
  const moduleSpec = specification.getModuleSpec(recipe)
  if (!moduleSpec || moduleSpec.beaconCount.isZero() || specification.beaconPower.isZero()) return zero
  if (!moduleSpec.beaconModules.some((module) => module !== null)) return zero
  const placedMachines = specification.getCount(recipe, rate).ceil()
  return specification.beaconPower
    .mul(moduleSpec.beaconQuality.beaconPowerUsageMultiplier)
    .mul(placedMachines)
    .mul(moduleSpec.beaconCount)
}

export function getAquiloHeat(specification: PlanningSpecification, recipe: Recipe, rate: Rational): Rational {
  const building = specification.getBuilding(recipe)
  if (!building) return zero
  const location = getAssignedLocation(specification, recipe, building)
  if (location?.key !== "aquilo") return zero
  let heatKw = AQUILO_MACHINE_HEAT_KW[building.key]
  if (heatKw === undefined) {
    if (building.fuel !== null || building.key === "heating-tower") return zero
    heatKw = DEFAULT_AQUILO_MACHINE_HEAT_KW
  }
  return Rational.from_float(heatKw * 1000).mul(specification.getCount(recipe, rate).ceil())
}

export function getLogistics(item: Item, rate: Rational, specification: PlanningSpecification): LogisticsReport | null {
  if (item.phase !== "solid") return null
  const stackSize = Rational.from_float(item.stackSize ?? 1)
  const stackRate = rate.div(stackSize)
  const bufferItems = rate.mul(specification.bufferMinutes).mul(Rational.from_float(60))
  const bufferSlots = bufferItems.div(stackSize).ceil()
  const wagonLoads = stackRate.div(Rational.from_float(40))
  return { stackRate, bufferSlots, wagonLoads }
}

export function getQualityTargetReport(specification: PlanningSpecification): QualityTargetRow[] {
  const rows: QualityTargetRow[] = []
  for (const target of specification.buildTargets ?? []) {
    if (!target.qualityLevel || target.qualityStrategy !== "direct") continue
    const recipe =
      target.recipe ?? specification.getRecipes(target.item).find((candidate) => candidate instanceof Recipe)
    if (!recipe) continue
    const chance = getRecipeQualityChance(specification, recipe)
    const probability = qualityProbability(chance, target.qualityLevel, specification.maxQualityLevel)
    if (probability.isZero()) continue
    const requested = target.getRate()
    const totalProduction = requested.div(probability)
    const tier = QUALITY_TIERS[target.qualityLevel]
    if (tier === undefined) continue
    rows.push({
      item: target.item,
      recipe,
      tier,
      qualityLevel: target.qualityLevel,
      chance,
      probability,
      requested,
      totalProduction,
      otherQualityByproduct: totalProduction.sub(requested),
      strategy: "direct",
    })
  }
  return rows
}

export function getPlanningSummary(specification: PlanningSpecification, totals: Totals) {
  let beaconPower = zero
  let pollution = zero
  let spores = zero
  let pollutionMachine = zero
  let pollutionProcess = zero
  let sporeMachine = zero
  let sporeProcess = zero
  let aquiloHeat = zero
  const perLocation = new Map<
    Planet,
    {
      location: Planet
      machines: Rational
      electricPower: Rational
      beaconPower: Rational
      pollution: Rational
      spores: Rational
      heat: Rational
    }
  >()

  for (const [recipe, rate] of totals.rates) {
    if (!(recipe instanceof Recipe) || !recipe.isReal() || recipe.isDisable()) continue
    const building = specification.getBuilding(recipe)
    const location = getAssignedLocation(specification, recipe, building)
    const count = building ? specification.getCount(recipe, rate) : zero
    const machinePower = specification.getPowerUsage(recipe, rate)
    const recipeBeaconPower = getBeaconPower(specification, recipe, rate)
    const pollutionComponents = getPollutionComponents(specification, recipe, rate, "pollution")
    const sporeComponents = getPollutionComponents(specification, recipe, rate, "spores")
    const recipePollution = pollutionComponents.total
    const recipeSpores = sporeComponents.total
    let recipeHeat = getAquiloHeat(specification, recipe, rate)
    if (location?.key === "aquilo" && !recipeBeaconPower.isZero()) {
      const moduleSpec = specification.getModuleSpec(recipe)
      if (moduleSpec !== null) {
        recipeHeat = recipeHeat.add(
          AQUILO_BEACON_HEAT_W.mul(moduleSpec.beaconCount).mul(specification.getCount(recipe, rate).ceil()),
        )
      }
    }

    beaconPower = beaconPower.add(recipeBeaconPower)
    pollution = pollution.add(recipePollution)
    spores = spores.add(recipeSpores)
    pollutionMachine = pollutionMachine.add(pollutionComponents.machine)
    pollutionProcess = pollutionProcess.add(pollutionComponents.process)
    sporeMachine = sporeMachine.add(sporeComponents.machine)
    sporeProcess = sporeProcess.add(sporeComponents.process)
    aquiloHeat = aquiloHeat.add(recipeHeat)

    if (location) {
      const current = perLocation.get(location) ?? {
        location,
        machines: zero,
        electricPower: zero,
        beaconPower: zero,
        pollution: zero,
        spores: zero,
        heat: zero,
      }
      current.machines = current.machines.add(count.ceil())
      if (machinePower.fuel === "electric") current.electricPower = current.electricPower.add(machinePower.power)
      current.beaconPower = current.beaconPower.add(recipeBeaconPower)
      current.pollution = current.pollution.add(recipePollution)
      current.spores = current.spores.add(recipeSpores)
      current.heat = current.heat.add(recipeHeat)
      perLocation.set(location, current)
    }
  }

  return {
    beaconPower,
    pollution,
    spores,
    emissions: {
      pollution: { machine: pollutionMachine, process: pollutionProcess, total: pollution },
      spores: { machine: sporeMachine, process: sporeProcess, total: spores },
    },
    rocket: getRocketLaunchReport(specification, totals),
    aquiloHeat,
    perLocation: [...perLocation.values()].sort((a, b) =>
      String(a.location.order).localeCompare(String(b.location.order)),
    ),
    transport: getTransportFlows(specification, totals),
    freshness: getFreshnessReport(specification, totals),
    asteroidConstraints: getAsteroidConstraintReport(specification, totals),
    qualityTargets: getQualityTargetReport(specification),
    qualityPlans: specification.qualityPlans,
  }
}
// endregion planning.ts

// region quality/graph.ts
export type QualityGraphOperationKind = "craft" | "recycle" | "source"

class QualityDisableRecipe implements SolverRecipe {
  readonly name: string
  readonly ingredients: readonly Ingredient<QualityGraphItem, Rational>[] = []
  readonly products: readonly Ingredient<QualityGraphItem, Rational>[] = []

  constructor(readonly item: QualityGraphItem) {
    this.name = `Disable ${item.name}`
  }

  getIngredients(): readonly Ingredient<QualityGraphItem, Rational>[] {
    return this.ingredients
  }

  gives(_item: SolverItem): Rational {
    return zero
  }

  isReal(): boolean {
    return false
  }

  isDisable(): boolean {
    return true
  }
}

export class QualityGraphItem implements SolverItem {
  readonly recipes: QualityGraphRecipe[] = []
  readonly uses: QualityGraphRecipe[] = []
  readonly disableRecipe: SolverRecipe
  readonly key: string
  readonly name: string

  constructor(
    readonly item: Item,
    readonly qualityLevel: number | null,
    key: string,
    name: string,
  ) {
    this.key = key
    this.name = name
    this.disableRecipe = new QualityDisableRecipe(this)
  }
}

export interface QualityGraphRecipeMetadata {
  readonly baseRecipe: Recipe | null
  readonly qualityLevel: number | null
  readonly kind: QualityGraphOperationKind
  readonly recycleRatesByQuality?: readonly Rational[]
  readonly sourceItem?: Item
  readonly configurationKey?: string
}

export interface QualityGraphSolution {
  readonly rates: ReadonlyMap<QualityGraphRecipe, Rational>
  readonly surplus: ReadonlyMap<QualityGraphItem, Rational>
}

export interface QualityGraphOptimizer {
  solve(graph: QualityGraph, output: QualityGraphItem, rate: Rational): QualityGraphSolution | null
}

export class QualityGraphRecipe implements SolverRecipe {
  readonly ingredients: readonly Ingredient<QualityGraphItem, Rational>[]
  readonly products: readonly Ingredient<QualityGraphItem, Rational>[]

  constructor(
    readonly key: string,
    readonly name: string,
    ingredients: Iterable<Ingredient<QualityGraphItem, Rational>>,
    products: Iterable<Ingredient<QualityGraphItem, Rational>>,
    readonly metadata: QualityGraphRecipeMetadata,
  ) {
    this.ingredients = [...ingredients].filter(({ amount }) => !amount.isZero())
    this.products = [...products].filter(({ amount }) => !amount.isZero())
    for (const ingredient of this.ingredients) ingredient.item.uses.push(this)
    for (const product of this.products) product.item.recipes.push(this)
  }

  getIngredients(): readonly Ingredient<QualityGraphItem, Rational>[] {
    return this.ingredients
  }

  gives(item: SolverItem): Rational {
    let amount = zero
    for (const product of this.products) {
      if (product.item === item) amount = amount.add(product.amount)
    }
    return amount
  }

  isReal(): boolean {
    return false
  }

  isDisable(): boolean {
    return false
  }

  isResource(): boolean {
    return this.metadata.kind === "source"
  }
}

export class QualityGraph {
  readonly items = new Map<string, QualityGraphItem>()
  readonly recipes: QualityGraphRecipe[] = []
  readonly sourceRecipes: QualityGraphRecipe[] = []
  readonly priorityLevels: Map<QualityGraphRecipe, Rational>[] = []

  item(baseItem: Item, qualityLevel: number | null): QualityGraphItem {
    const key = qualityLevel === null ? baseItem.key : `${baseItem.key}@q${qualityLevel}`
    let item = this.items.get(key)
    if (item === undefined) {
      const suffix = qualityLevel === null ? "" : ` quality ${qualityLevel}`
      item = new QualityGraphItem(baseItem, qualityLevel, key, `${baseItem.name}${suffix}`)
      this.items.set(key, item)
    }
    return item
  }

  recipe(
    key: string,
    name: string,
    ingredients: Iterable<Ingredient<QualityGraphItem, Rational>>,
    products: Iterable<Ingredient<QualityGraphItem, Rational>>,
    metadata: QualityGraphRecipeMetadata,
  ): QualityGraphRecipe {
    const recipe = new QualityGraphRecipe(key, name, ingredients, products, metadata)
    this.recipes.push(recipe)
    if (metadata.kind === "source") this.sourceRecipes.push(recipe)
    return recipe
  }

  source(item: QualityGraphItem, baseItem: Item, weight: Rational = one, level = 0): QualityGraphRecipe {
    const existing = this.sourceRecipes.find(
      (recipe) => recipe.metadata.sourceItem === baseItem && recipe.products[0]?.item === item,
    )
    if (existing !== undefined) return existing
    const recipe = this.recipe(`quality-source:${item.key}`, `Fresh ${item.name}`, [], [new Ingredient(item, one)], {
      baseRecipe: null,
      qualityLevel: item.qualityLevel,
      kind: "source",
      sourceItem: baseItem,
    })
    this.setPriority(recipe, weight, level)
    return recipe
  }

  setPriority(recipe: QualityGraphRecipe, weight: Rational, level = 0): void {
    while (this.priorityLevels.length <= level) this.priorityLevels.push(new Map())
    this.priorityLevels[level]!.set(recipe, weight)
  }

  private viableRecipes(): Set<QualityGraphRecipe> {
    const viable = new Set(this.recipes)
    let changed = true
    while (changed) {
      changed = false
      for (const recipe of [...viable]) {
        if (
          recipe.ingredients.some((ingredient) => ingredient.item.recipes.every((producer) => !viable.has(producer)))
        ) {
          viable.delete(recipe)
          changed = true
        }
      }
    }
    return viable
  }

  private recipeSignature(recipe: QualityGraphRecipe): string {
    const amounts = (values: readonly Ingredient<QualityGraphItem, Rational>[]): string[] =>
      values.map(({ item, amount }) => `${item.key}:${amount.toString()}`).sort()
    const priority = this.priorityLevels.map((level) => level.get(recipe)?.toString() ?? null)
    return JSON.stringify([
      amounts(recipe.ingredients),
      amounts(recipe.products),
      priority,
      recipe.metadata.baseRecipe?.key ?? null,
      recipe.metadata.qualityLevel,
      recipe.metadata.kind,
      recipe.metadata.recycleRatesByQuality?.map((rate) => rate.toString()) ?? null,
      recipe.metadata.sourceItem?.key ?? null,
      recipe.metadata.configurationKey ?? null,
    ])
  }

  private deduplicateRecipes(recipes: ReadonlySet<QualityGraphRecipe>): Set<QualityGraphRecipe> {
    const signatures = new Set<string>()
    const unique = new Set<QualityGraphRecipe>()
    for (const recipe of recipes) {
      const signature = this.recipeSignature(recipe)
      if (signatures.has(signature)) continue
      signatures.add(signature)
      unique.add(recipe)
    }
    return unique
  }

  solverRecipes(): ReadonlySet<QualityGraphRecipe> {
    return this.deduplicateRecipes(this.viableRecipes())
  }

  private solverSpec(viableRecipes: ReadonlySet<QualityGraphRecipe>): SolverSpec {
    const graph = this
    const priority = this.priorityLevels
      .map((level) => [...level].map(([recipe, weight]) => ({ recipe, weight })))
      .filter((level) => level.length > 0)
    return {
      ignore: new Set(),
      buildTargets: [],
      priority,
      getRecipes(item: SolverItem): SolverRecipe[] {
        if (!(item instanceof QualityGraphItem)) throw new Error("Unknown quality graph item")
        return item.recipes.filter((recipe) => viableRecipes.has(recipe))
      },
      getRecipeGraph(_items: Map<SolverItem, Rational>): Set<SolverRecipe> {
        return new Set(viableRecipes)
      },
      getProdEffect(_recipe: SolverRecipe): Rational {
        return one
      },
      getBuilding(_recipe: SolverRecipe) {
        return null
      },
      getFuelForRecipe(_recipe: SolverRecipe) {
        return null
      },
    }
  }

  private totalsFromSolution(
    viableRecipes: ReadonlySet<QualityGraphRecipe>,
    output: QualityGraphItem,
    rate: Rational,
    solution: QualityGraphSolution,
  ): Totals {
    const spec = this.solverSpec(viableRecipes)
    const outputs = new Map<SolverItem, Rational>([[output, rate]])
    const rates = new Map<SolverRecipe, Rational>(solution.rates)
    rates.set(new QualityOutputRecipe(outputs), one)
    const surplus = new Map<SolverItem, Rational>(solution.surplus)
    if (surplus.size > 0) rates.set(new QualitySurplusRecipe(surplus), one)
    return new Totals(spec, outputs, rates, surplus, new Map())
  }

  solve(output: QualityGraphItem, rate: Rational, optimizer: QualityGraphOptimizer | null = null): Totals {
    const viableRecipes = this.solverRecipes()
    const spec = this.solverSpec(viableRecipes)
    spec.buildTargets.push({ item: output, recipe: null, changedBuilding: false })

    try {
      const optimized = optimizer?.solve(this, output, rate) ?? null
      if (optimized !== null) return this.totalsFromSolution(viableRecipes, output, rate, optimized)
      return solve(spec, [{ item: output, rate, recipe: null }])
    } catch (error) {
      if (error instanceof Error && /unbounded|infeasible|cycle/i.test(error.message)) {
        throw new Error("Quality flow contains a neutral or positive production cycle", { cause: error })
      }
      throw error
    }
  }
}

class QualityOutputRecipe implements SolverRecipe {
  readonly name: string = "output"
  readonly products: readonly Ingredient<QualityGraphItem, Rational>[] = []
  readonly ingredients: readonly Ingredient<QualityGraphItem, Rational>[]

  constructor(outputs: ReadonlyMap<SolverItem, Rational>) {
    this.ingredients = [...outputs].map(([item, amount]) => {
      if (!(item instanceof QualityGraphItem)) throw new Error("Unknown quality graph output")
      return new Ingredient(item, amount)
    })
  }

  getIngredients(): readonly Ingredient<QualityGraphItem, Rational>[] {
    return this.ingredients
  }

  gives(_item: SolverItem): Rational {
    return zero
  }

  isReal(): boolean {
    return false
  }
}

class QualitySurplusRecipe extends QualityOutputRecipe {
  override readonly name = "surplus"
}

export function addIngredient(
  amounts: Map<QualityGraphItem, Rational>,
  item: QualityGraphItem,
  amount: Rational,
): void {
  if (amount.isZero()) return
  amounts.set(item, (amounts.get(item) ?? zero).add(amount))
}

export function ingredientsFromMap(
  amounts: ReadonlyMap<QualityGraphItem, Rational>,
): Ingredient<QualityGraphItem, Rational>[] {
  return [...amounts].map(([item, amount]) => new Ingredient(item, amount))
}
// endregion quality/graph.ts

// region quality/operations.ts
interface TargetRecycleClosure {
  readonly operationsByInputQuality: readonly Rational[]
  readonly products: ReadonlyMap<QualityGraphItem, Rational>
  readonly extraIngredients: ReadonlyMap<QualityGraphItem, Rational>
}

export function isQualifiedSolid(item: Item): boolean {
  return item.phase === "solid"
}

export function qualifiedItem(graph: QualityGraph, item: Item, qualityLevel: number): QualityGraphItem {
  return graph.item(item, isQualifiedSolid(item) ? qualityLevel : null)
}

export function addProductivity(recipe: Recipe, product: Ingredient<Item, Rational>, productivity: Rational): Rational {
  if (!one.less(productivity)) return product.amount
  let productiveAmount = product.productivityAmount
  if (productiveAmount === null) {
    productiveAmount = product.amount
    for (const ingredient of recipe.ingredients) {
      if (ingredient.item === product.item) productiveAmount = productiveAmount.sub(ingredient.amount)
    }
    if (productiveAmount.less(zero)) return product.amount
  }
  return product.amount.add(productiveAmount.mul(productivity.sub(one)))
}

export function findRecyclerRecipe(specification: FactorySpecification, item: Item): Recipe | null {
  const exact = specification.recipes.get(`${item.key}-recycling`)
  if (exact !== undefined && exact.ingredients.some((ingredient) => ingredient.item === item)) return exact
  return (
    item.uses.find(
      (candidate) =>
        candidate.categories.has("recycling") && candidate.ingredients.some((ingredient) => ingredient.item === item),
    ) ?? null
  )
}

function cloneModuleSpec(
  specification: FactorySpecification,
  recipe: Recipe,
  building: Building,
  configured: ModuleSpec | null,
): ModuleSpec {
  const clone = new ModuleSpec(recipe, specification)
  clone.setBuilding(building, specification)
  if (configured === null || configured.building !== building) return clone

  clone.modules.splice(0, clone.modules.length, ...configured.modules)
  clone.moduleQualities.splice(0, clone.moduleQualities.length, ...configured.moduleQualities)
  clone.beaconModules.splice(0, clone.beaconModules.length, ...configured.beaconModules)
  clone.beaconModuleQualities.splice(0, clone.beaconModuleQualities.length, ...configured.beaconModuleQualities)
  clone.beaconQuality = configured.beaconQuality
  clone.beaconCount = configured.beaconCount
  return clone
}

function productivityForConfiguration(
  specification: FactorySpecification,
  recipe: Recipe,
  moduleSpec: ModuleSpec,
): Rational {
  let productivity = moduleSpec.prodEffect(specification).add(specification.getRecipeProductivityBonus(recipe))
  if (recipe.maximumProductivity !== null) {
    productivity = Rational.min(productivity, one.add(recipe.maximumProductivity))
  }
  return productivity
}

function configurationFromModuleSpec(
  specification: FactorySpecification,
  recipe: Recipe,
  qualityLevel: number,
  moduleSpec: ModuleSpec,
): QualityTierConfiguration {
  const building = moduleSpec.building
  return {
    qualityLevel,
    building,
    machineQuality: specification.getMachineQuality(recipe),
    modules: [...moduleSpec.modules],
    moduleQualities: [...moduleSpec.moduleQualities],
    beaconModules: [...moduleSpec.beaconModules],
    beaconModuleQualities: [...moduleSpec.beaconModuleQualities],
    beaconQuality: moduleSpec.beaconQuality,
    beaconCount: moduleSpec.beaconCount,
    qualityChance: recipe.allow_quality ? moduleSpec.qualityEffect() : zero,
    productivity: productivityForConfiguration(specification, recipe, moduleSpec),
    speedEffect: moduleSpec.speedEffect(),
    powerEffect: moduleSpec.powerEffect(specification),
  }
}

export function moduleTierConfiguration(options: {
  readonly specification: FactorySpecification
  readonly recipe: Recipe
  readonly qualityLevel: number
  readonly building: Building | null
  readonly module: Module | null
  readonly moduleQuality: Quality
  readonly preserveBeacons?: boolean
}): QualityTierConfiguration {
  const { specification, recipe, qualityLevel, building, module, moduleQuality } = options
  if (building === null) {
    const normal = specification.getNormalQuality()
    return {
      qualityLevel,
      building: null,
      machineQuality: normal,
      modules: [],
      moduleQualities: [],
      beaconModules: [],
      beaconModuleQualities: [],
      beaconQuality: normal,
      beaconCount: zero,
      qualityChance: zero,
      productivity: one.add(specification.getRecipeProductivityBonus(recipe)),
      speedEffect: one,
      powerEffect: one,
    }
  }

  const configured = specification.spec.get(recipe) ?? null
  const moduleSpec = cloneModuleSpec(specification, recipe, building, configured)
  for (let index = 0; index < moduleSpec.modules.length; index++) {
    moduleSpec.modules[index] = module !== null && module.canUse(recipe, building) ? module : null
    moduleSpec.moduleQualities[index] =
      moduleSpec.modules[index] === null ? specification.getNormalQuality() : moduleQuality
  }
  if (options.preserveBeacons === false) {
    moduleSpec.beaconModules.fill(null)
    moduleSpec.beaconModuleQualities.fill(specification.getNormalQuality())
    moduleSpec.beaconCount = zero
  }
  return configurationFromModuleSpec(specification, recipe, qualityLevel, moduleSpec)
}

function moduleSpecFromConfiguration(
  specification: FactorySpecification,
  recipe: Recipe,
  configuration: QualityTierConfiguration,
): ModuleSpec | null {
  const building = configuration.building
  if (building === null) return null
  const moduleSpec = new ModuleSpec(recipe, specification)
  moduleSpec.setBuilding(building, specification)
  moduleSpec.modules.splice(0, moduleSpec.modules.length, ...configuration.modules)
  moduleSpec.moduleQualities.splice(0, moduleSpec.moduleQualities.length, ...configuration.moduleQualities)
  moduleSpec.beaconModules.splice(0, moduleSpec.beaconModules.length, ...configuration.beaconModules)
  moduleSpec.beaconModuleQualities.splice(
    0,
    moduleSpec.beaconModuleQualities.length,
    ...configuration.beaconModuleQualities,
  )
  moduleSpec.beaconQuality = configuration.beaconQuality
  moduleSpec.beaconCount = configuration.beaconCount
  return moduleSpec
}

export function operationCapacity(
  specification: FactorySpecification,
  recipe: Recipe,
  rate: Rational,
  configuration: QualityTierConfiguration,
): { readonly machineCount: Rational; readonly power: Rational } {
  const building = configuration.building
  if (building === null || rate.isZero()) return { machineCount: zero, power: zero }

  const moduleSpec = moduleSpecFromConfiguration(specification, recipe, configuration)
  const adapter = Object.create(specification) as FactorySpecification
  adapter.getModuleSpec = (candidate: Recipe) =>
    candidate === recipe ? moduleSpec : specification.getModuleSpec(candidate)
  adapter.getMachineQuality = (candidate: Recipe) =>
    candidate === recipe ? configuration.machineQuality : specification.getMachineQuality(candidate)

  const machineCount = building.getCount(adapter, recipe, rate)
  let power = building.powerForQuality(configuration.machineQuality).mul(machineCount).mul(configuration.powerEffect)
  if (building.fuel === null) {
    power = power.add(building.drainForQuality(configuration.machineQuality).mul(machineCount.ceil()))
  }
  if (
    !configuration.beaconCount.isZero() &&
    configuration.beaconModules.some((module) => module !== null) &&
    !specification.beaconPower.isZero()
  ) {
    power = power.add(
      specification.beaconPower
        .mul(configuration.beaconQuality.beaconPowerUsageMultiplier)
        .mul(machineCount.ceil())
        .mul(configuration.beaconCount),
    )
  }
  return { machineCount, power }
}

export function recyclerClosure(
  graph: QualityGraph,
  target: Item,
  recyclerRecipe: Recipe,
  keepLevel: number,
  maxLevel: number,
  configurations: readonly QualityTierConfiguration[],
): readonly TargetRecycleClosure[] {
  const targetIngredient = recyclerRecipe.ingredients.find((ingredient) => ingredient.item === target)
  if (targetIngredient === undefined || targetIngredient.amount.isZero()) {
    throw new Error(`${recyclerRecipe.name} does not consume ${target.name}`)
  }
  const transientSize = keepLevel
  if (transientSize === 0) return []

  // One column per recycled input quality. Values are expected target items
  // returned into another transient recycler state per one target item consumed.
  const transition: Rational[][] = Array.from({ length: transientSize }, () =>
    Array.from({ length: transientSize }, () => zero),
  )
  const immediateProducts: Map<QualityGraphItem, Rational>[] = Array.from({ length: transientSize }, () => new Map())
  const immediateIngredients: Map<QualityGraphItem, Rational>[] = Array.from({ length: transientSize }, () => new Map())

  for (let inputQuality = 0; inputQuality < transientSize; inputQuality++) {
    const configuration = configurations[inputQuality]
    if (configuration === undefined) throw new Error("Missing recycler quality configuration")
    const operationsPerItem = targetIngredient.amount.reciprocate()

    for (const ingredient of recyclerRecipe.ingredients) {
      if (ingredient.item === target) continue
      addIngredient(
        immediateIngredients[inputQuality]!,
        qualifiedItem(graph, ingredient.item, inputQuality),
        ingredient.amount.mul(operationsPerItem),
      )
    }

    for (const product of recyclerRecipe.products) {
      const amount = addProductivity(recyclerRecipe, product, configuration.productivity).mul(operationsPerItem)
      if (!isQualifiedSolid(product.item)) {
        addIngredient(immediateProducts[inputQuality]!, graph.item(product.item, null), amount)
        continue
      }
      const distribution = qualityTransitionDistribution(configuration.qualityChance, inputQuality, maxLevel)
      for (let outputQuality = inputQuality; outputQuality <= maxLevel; outputQuality++) {
        const probability = distribution[outputQuality] ?? zero
        if (probability.isZero()) continue
        const outputAmount = amount.mul(probability)
        if (product.item === target && outputQuality < keepLevel) {
          transition[outputQuality]![inputQuality] = transition[outputQuality]![inputQuality]!.add(outputAmount)
        } else {
          addIngredient(immediateProducts[inputQuality]!, graph.item(product.item, outputQuality), outputAmount)
        }
      }
    }
  }

  const coefficients: Rational[][] = Array.from({ length: transientSize }, (_, row) =>
    Array.from({ length: transientSize }, (_, column) =>
      row === column ? one.sub(transition[row]![column]!) : zero.sub(transition[row]![column]!),
    ),
  )

  return Array.from({ length: transientSize }, (_, initialQuality) => {
    const visits = solveExactLinearSystem(
      coefficients,
      Array.from({ length: transientSize }, (_, quality) => (quality === initialQuality ? one : zero)),
    )
    if (visits.some((value) => value.less(zero))) {
      throw new Error("Quality recycler contains a positive production cycle")
    }
    const products = new Map<QualityGraphItem, Rational>()
    const extraIngredients = new Map<QualityGraphItem, Rational>()
    for (let inputQuality = 0; inputQuality < transientSize; inputQuality++) {
      const visitCount = visits[inputQuality] ?? zero
      for (const [item, amount] of immediateProducts[inputQuality] ?? []) {
        addIngredient(products, item, amount.mul(visitCount))
      }
      for (const [item, amount] of immediateIngredients[inputQuality] ?? []) {
        addIngredient(extraIngredients, item, amount.mul(visitCount))
      }
    }
    const operationsPerItem = targetIngredient.amount.reciprocate()
    return {
      operationsByInputQuality: visits.map((visitCount) => visitCount.mul(operationsPerItem)),
      products,
      extraIngredients,
    }
  })
}

export function addCraftRecipe(
  graph: QualityGraph,
  target: Item,
  recipe: Recipe,
  inputQuality: number,
  keepLevel: number,
  maxLevel: number,
  configuration: QualityTierConfiguration,
  closures: readonly TargetRecycleClosure[],
  keyPrefix = "quality-craft",
): QualityGraphRecipe {
  const ingredients = new Map<QualityGraphItem, Rational>()
  const products = new Map<QualityGraphItem, Rational>()
  const recycleRates = Array.from({ length: maxLevel + 1 }, () => zero)

  for (const ingredient of recipe.ingredients) {
    addIngredient(ingredients, qualifiedItem(graph, ingredient.item, inputQuality), ingredient.amount)
  }

  for (const product of recipe.products) {
    const amount = addProductivity(recipe, product, configuration.productivity)
    if (!isQualifiedSolid(product.item)) {
      addIngredient(products, graph.item(product.item, null), amount)
      continue
    }

    const distribution = qualityTransitionDistribution(configuration.qualityChance, inputQuality, maxLevel)
    for (let outputQuality = inputQuality; outputQuality <= maxLevel; outputQuality++) {
      const probability = distribution[outputQuality] ?? zero
      if (probability.isZero()) continue
      const outputAmount = amount.mul(probability)
      if (product.item !== target || outputQuality >= keepLevel) {
        addIngredient(products, graph.item(product.item, outputQuality), outputAmount)
        continue
      }

      const closure = closures[outputQuality]
      if (closure === undefined) throw new Error("Missing target recycler closure")
      for (const [item, returned] of closure.products) {
        addIngredient(products, item, returned.mul(outputAmount))
      }
      for (const [item, consumed] of closure.extraIngredients) {
        addIngredient(ingredients, item, consumed.mul(outputAmount))
      }
      for (let recyclerQuality = 0; recyclerQuality < closure.operationsByInputQuality.length; recyclerQuality++) {
        recycleRates[recyclerQuality] = recycleRates[recyclerQuality]!.add(
          (closure.operationsByInputQuality[recyclerQuality] ?? zero).mul(outputAmount),
        )
      }
    }
  }

  return graph.recipe(
    `${keyPrefix}:${recipe.key}:q${inputQuality}`,
    `${recipe.name} quality ${inputQuality}`,
    ingredientsFromMap(ingredients),
    ingredientsFromMap(products),
    {
      baseRecipe: recipe,
      qualityLevel: inputQuality,
      kind: "craft",
      recycleRatesByQuality: recycleRates,
      configurationKey: JSON.stringify([
        configuration.qualityLevel,
        configuration.building?.key ?? null,
        configuration.machineQuality.key,
        configuration.modules.map((module) => module?.key ?? null),
        configuration.moduleQualities.map((quality) => quality.key),
        configuration.beaconModules.map((module) => module?.key ?? null),
        configuration.beaconModuleQualities.map((quality) => quality.key),
        configuration.beaconQuality.key,
        configuration.beaconCount.toString(),
        configuration.qualityChance.toString(),
        configuration.productivity.toString(),
        configuration.speedEffect.toString(),
        configuration.powerEffect.toString(),
      ]),
    },
  )
}

export function sortedQualifiedAmounts(values: Iterable<[QualityGraphItem, Rational]>): QualifiedItemAmount[] {
  return [...values]
    .filter(([, amount]) => !amount.isZero())
    .map(([item, amount]) => ({ item: item.item, qualityLevel: item.qualityLevel ?? 0, amount }))
    .sort((left, right) =>
      left.item.order === right.item.order
        ? left.qualityLevel - right.qualityLevel
        : left.item.order.localeCompare(right.item.order),
    )
}
// endregion quality/operations.ts

// region quality/disposal.ts
interface DisposalState {
  readonly item: Item
  readonly qualityLevel: number
  readonly recipe: Recipe
  readonly configuration: QualityTierConfiguration
  readonly operationsPerItem: Rational
}

interface QualityDisposalResult {
  readonly operations: readonly QualityOperationRate[]
  readonly terminalOutputs: readonly QualifiedItemAmount[]
  readonly extraFreshInputs: readonly QualifiedItemAmount[]
  readonly totalMachineCount: Rational
  readonly totalPower: Rational
  readonly totalRecycles: Rational
}

function stateKey(item: Item, qualityLevel: number): string {
  return `${item.key}@q${qualityLevel}`
}

function sortedDisposalAmountMap(values: ReadonlyMap<string, QualifiedItemAmount>): QualifiedItemAmount[] {
  return [...values.values()]
    .filter(({ amount }) => !amount.isZero())
    .sort((left, right) =>
      left.item.order === right.item.order
        ? left.qualityLevel - right.qualityLevel
        : left.item.order.localeCompare(right.item.order),
    )
}

function recyclerDescriptor(
  specification: FactorySpecification,
  recipe: Recipe,
  inputItem: Item,
  inputQuality: number,
  configuration: QualityTierConfiguration,
): {
  readonly products: readonly QualifiedItemAmount[]
  readonly extraIngredients: readonly QualifiedItemAmount[]
} {
  const consumed = recipe.ingredients.find((ingredient) => ingredient.item === inputItem)
  if (consumed === undefined || consumed.amount.isZero()) {
    throw new Error(`${recipe.name} does not consume ${inputItem.name}`)
  }
  const operationsPerItem = consumed.amount.reciprocate()
  const products: QualifiedItemAmount[] = []
  const extraIngredients: QualifiedItemAmount[] = []

  for (const ingredient of recipe.ingredients) {
    if (ingredient.item === inputItem) continue
    extraIngredients.push({
      item: ingredient.item,
      qualityLevel: isQualifiedSolid(ingredient.item) ? inputQuality : 0,
      amount: ingredient.amount.mul(operationsPerItem),
    })
  }

  for (const product of recipe.products) {
    const amount = addProductivity(recipe, product, configuration.productivity).mul(operationsPerItem)
    if (!isQualifiedSolid(product.item)) {
      products.push({ item: product.item, qualityLevel: 0, amount })
      continue
    }
    const chance = recipe.allow_quality ? configuration.qualityChance : zero
    const distribution = qualityTransitionDistribution(chance, inputQuality, specification.maxQualityLevel)
    for (let outputQuality = inputQuality; outputQuality <= specification.maxQualityLevel; outputQuality++) {
      const probability = distribution[outputQuality] ?? zero
      if (probability.isZero()) continue
      products.push({ item: product.item, qualityLevel: outputQuality, amount: amount.mul(probability) })
    }
  }
  return { products, extraIngredients }
}

export function planQualitySurplusDisposal(options: {
  readonly specification: FactorySpecification
  readonly target: Item
  readonly keepLevel: number
  readonly surplus: readonly QualifiedItemAmount[]
  readonly canRecycle: (recipe: Recipe) => boolean
  readonly getConfiguration: (recipe: Recipe, qualityLevel: number) => QualityTierConfiguration
  readonly cycleLabel: string
}): QualityDisposalResult {
  const { specification, target, keepLevel, surplus, canRecycle, getConfiguration, cycleLabel } = options
  const states: DisposalState[] = []
  const stateIndexes = new Map<string, number>()
  const terminalInitial = new Map<string, QualifiedItemAmount>()

  const addMapAmount = (map: Map<string, QualifiedItemAmount>, value: QualifiedItemAmount): void => {
    const key = stateKey(value.item, value.qualityLevel)
    const current = map.get(key)
    map.set(key, {
      item: value.item,
      qualityLevel: value.qualityLevel,
      amount: (current?.amount ?? zero).add(value.amount),
    })
  }

  const addTerminal = (value: QualifiedItemAmount): void => addMapAmount(terminalInitial, value)

  const ensureState = (item: Item, qualityLevel: number): number | null => {
    if (!isQualifiedSolid(item) || (item === target && qualityLevel >= keepLevel)) return null
    const key = stateKey(item, qualityLevel)
    const existing = stateIndexes.get(key)
    if (existing !== undefined) return existing
    const recipe = findRecyclerRecipe(specification, item)
    if (recipe === null || !canRecycle(recipe)) return null
    const consumed = recipe.ingredients.find((ingredient) => ingredient.item === item)
    if (consumed === undefined || consumed.amount.isZero()) return null

    const index = states.length
    stateIndexes.set(key, index)
    states.push({
      item,
      qualityLevel,
      recipe,
      configuration: getConfiguration(recipe, qualityLevel),
      operationsPerItem: consumed.amount.reciprocate(),
    })
    return index
  }

  for (const value of surplus) {
    if (ensureState(value.item, value.qualityLevel) === null) addTerminal(value)
  }

  for (let index = 0; index < states.length; index++) {
    const state = states[index]
    if (state === undefined) continue
    const descriptor = recyclerDescriptor(
      specification,
      state.recipe,
      state.item,
      state.qualityLevel,
      state.configuration,
    )
    for (const product of descriptor.products) ensureState(product.item, product.qualityLevel)
  }

  if (states.length === 0) {
    return {
      operations: [],
      terminalOutputs: sortedDisposalAmountMap(terminalInitial),
      extraFreshInputs: [],
      totalMachineCount: zero,
      totalPower: zero,
      totalRecycles: zero,
    }
  }

  const transition: Rational[][] = Array.from({ length: states.length }, () =>
    Array.from({ length: states.length }, () => zero),
  )
  const terminalByState: Map<string, QualifiedItemAmount>[] = Array.from({ length: states.length }, () => new Map())
  const extraByState: Map<string, QualifiedItemAmount>[] = Array.from({ length: states.length }, () => new Map())

  for (let column = 0; column < states.length; column++) {
    const state = states[column]
    if (state === undefined) continue
    const descriptor = recyclerDescriptor(
      specification,
      state.recipe,
      state.item,
      state.qualityLevel,
      state.configuration,
    )
    for (const product of descriptor.products) {
      const row = stateIndexes.get(stateKey(product.item, product.qualityLevel))
      if (row === undefined) addMapAmount(terminalByState[column]!, product)
      else transition[row]![column] = transition[row]![column]!.add(product.amount)
    }
    for (const ingredient of descriptor.extraIngredients) addMapAmount(extraByState[column]!, ingredient)
  }

  const coefficients = transition.map((row, rowIndex) =>
    row.map((value, columnIndex) => (rowIndex === columnIndex ? one.sub(value) : zero.sub(value))),
  )
  const initial = Array.from({ length: states.length }, () => zero)
  for (const value of surplus) {
    const index = stateIndexes.get(stateKey(value.item, value.qualityLevel))
    if (index !== undefined) initial[index] = initial[index]!.add(value.amount)
  }
  const visits = solveExactLinearSystem(coefficients, initial)
  if (visits.some((value) => value.less(zero))) {
    throw new Error(`${cycleLabel} disposal contains a positive production cycle`)
  }

  const operations: QualityOperationRate[] = []
  const terminal = new Map(terminalInitial)
  const extraFresh = new Map<string, QualifiedItemAmount>()
  let totalMachineCount = zero
  let totalPower = zero
  let totalRecycles = zero

  for (let index = 0; index < states.length; index++) {
    const state = states[index]
    if (state === undefined) continue
    const visitCount = visits[index] ?? zero
    if (visitCount.isZero()) continue
    const rate = visitCount.mul(state.operationsPerItem)
    const capacity = operationCapacity(specification, state.recipe, rate, state.configuration)
    operations.push({
      recipe: state.recipe,
      qualityLevel: state.qualityLevel,
      rate,
      machineCount: capacity.machineCount,
      power: capacity.power,
      kind: "dispose",
      configuration: state.configuration,
    })
    totalRecycles = totalRecycles.add(rate)
    totalMachineCount = totalMachineCount.add(capacity.machineCount)
    totalPower = totalPower.add(capacity.power)
    for (const [, value] of terminalByState[index] ?? []) {
      addMapAmount(terminal, { ...value, amount: value.amount.mul(visitCount) })
    }
    for (const [, value] of extraByState[index] ?? []) {
      addMapAmount(extraFresh, { ...value, amount: value.amount.mul(visitCount) })
    }
  }

  return {
    operations,
    terminalOutputs: sortedDisposalAmountMap(terminal),
    extraFreshInputs: sortedDisposalAmountMap(extraFresh),
    totalMachineCount,
    totalPower,
    totalRecycles,
  }
}
// endregion quality/disposal.ts

// region quality/practical.ts
const IMPORT_WEIGHT = Rational.from_integer(1_000_000)
const LOCAL_RESOURCE_WEIGHT = one
const LOCAL_OPERATION_LEVEL = 0
const SOURCE_LEVEL = 1
const FULGORA_CURATED_PRODUCERS = new Map<string, string>([
  ["water", "ice-melting"],
  ["light-oil", "heavy-oil-cracking"],
  ["petroleum-gas", "light-oil-cracking"],
])

interface EmbeddedRecycler {
  readonly recipe: Recipe
  readonly configurations: readonly QualityTierConfiguration[]
}

function amountKey(item: Item, qualityLevel: number): string {
  return `${item.key}@q${qualityLevel}`
}

function mergeQualifiedAmounts(target: Map<string, QualifiedItemAmount>, values: Iterable<QualifiedItemAmount>): void {
  for (const value of values) {
    const key = amountKey(value.item, value.qualityLevel)
    const current = target.get(key)
    target.set(key, {
      item: value.item,
      qualityLevel: value.qualityLevel,
      amount: (current?.amount ?? zero).add(value.amount),
    })
  }
}

function sortedAmountMap(values: ReadonlyMap<string, QualifiedItemAmount>): QualifiedItemAmount[] {
  return [...values.values()]
    .filter(({ amount }) => !amount.isZero())
    .sort((left, right) =>
      left.item.order === right.item.order
        ? left.qualityLevel - right.qualityLevel
        : left.item.order.localeCompare(right.item.order),
    )
}

function isLocalRecipe(planet: Planet, recipe: Recipe): boolean {
  return planet.allowsRecipe(recipe)
}

function isUsableProducer(specification: FactorySpecification, planet: Planet, recipe: Recipe, item: Item): boolean {
  return (
    recipe.isReal() &&
    !recipe.isDisable() &&
    !recipe.categories.has("recycling") &&
    !specification.getNetDisable().disable.has(recipe) &&
    isLocalRecipe(planet, recipe) &&
    recipe.products.some((product) => product.item === item) &&
    (recipe.isResource() || choosePracticalBuilding(specification, planet, recipe) !== null)
  )
}

function choosePracticalBuilding(specification: FactorySpecification, planet: Planet, recipe: Recipe): Building | null {
  if (!planet.allowsRecipe(recipe)) return null
  const override = specification.getBuildingOverride(recipe)
  if (override !== null && override.canCraft(recipe) && planet.allowsBuilding(override)) return override

  const configured = specification.getBuilding(recipe)
  const candidates = specification
    .getCompatibleBuildings(recipe, false)
    .filter((building) => planet.allowsBuilding(building))
  const preferredKey = recipe.categories.has("metallurgy")
    ? "foundry"
    : recipe.categories.has("recycling")
      ? "recycler"
      : recipe.categories.has("electronics") || recipe.categories.has("electromagnetics")
        ? "electromagnetic-plant"
        : null
  return (
    candidates.find((building) => building.key === preferredKey) ??
    (configured !== null && candidates.includes(configured) ? configured : null) ??
    candidates.at(-1) ??
    null
  )
}

function getPreferredPracticalQualityRecipe(options: {
  readonly specification: FactorySpecification
  readonly planet: Planet
  readonly item: Item
  readonly preferredRecipe?: Recipe | null
  readonly curatedProducers?: ReadonlyMap<string, string>
}): Recipe | null {
  const { specification, planet, item, preferredRecipe = null, curatedProducers } = options

  const curatedKey = curatedProducers?.get(item.key)
  if (curatedKey !== undefined) {
    const curated = specification.recipes.get(curatedKey)
    if (curated !== undefined && isUsableProducer(specification, planet, curated, item)) {
      return curated
    }
  }
  if (preferredRecipe !== null && isUsableProducer(specification, planet, preferredRecipe, item)) {
    return preferredRecipe
  }

  const candidates = item.recipes.filter((candidate) => isUsableProducer(specification, planet, candidate, item))
  const resource = candidates.find((candidate) => candidate.isResource() && planet.resources.has(candidate))
  if (resource !== undefined) return resource
  const canonical = candidates.find((candidate) => candidate.key === item.key)
  return canonical ?? candidates.sort((left, right) => (left.order ?? "").localeCompare(right.order ?? ""))[0] ?? null
}

function availableModuleQuality(specification: FactorySpecification, configured: Quality): Quality {
  const available = specification.getAvailableQualities()
  return available.includes(configured) ? configured : (available.at(-1) ?? specification.getNormalQuality())
}

function bestModule(
  specification: FactorySpecification,
  recipe: Recipe,
  building: Building,
  quality: Quality,
  effect: "quality" | "productivity",
): Module | null {
  const explicit =
    effect === "quality" ? specification.qualityPlannerModule : specification.qualityPlannerProductivityModule
  if (
    explicit !== null &&
    zero.less(effect === "quality" ? explicit.qualityFor(quality) : explicit.productivityFor(quality)) &&
    explicit.canUse(recipe, building)
  ) {
    return explicit
  }

  let best: Module | null = null
  let bestEffect = zero
  for (const module of specification.modules.values()) {
    if (!module.canUse(recipe, building)) continue
    const value = effect === "quality" ? module.qualityFor(quality) : module.productivityFor(quality)
    if (best === null || bestEffect.less(value)) {
      best = module
      bestEffect = value
    }
  }
  return zero.less(bestEffect) ? best : null
}

function objectiveForPlan(specification: FactorySpecification): QualityOptimizationObjective {
  return specification.qualityPlannerObjective === "practical" ? "configured" : specification.qualityPlannerObjective
}

class PracticalQualityGraphBuilder {
  readonly graph = new QualityGraph()
  readonly operations = new Map<QualityGraphRecipe, QualityTierConfiguration>()
  readonly embeddedRecyclers = new Map<QualityGraphRecipe, EmbeddedRecycler>()
  private readonly expandedItems = new Set<string>()
  private readonly expandedProducers = new Set<string>()
  private readonly importedItems = new Set<QualityGraphItem>()
  private readonly configurations = new Map<string, readonly QualityTierConfiguration[]>()
  private readonly userDisabledRecipes: ReadonlySet<Recipe>
  private readonly plannerQuality: Quality
  private readonly productivityQuality: Quality

  constructor(
    readonly specification: FactorySpecification,
    readonly planet: Planet,
    readonly target: Item,
    readonly targetRecipe: Recipe,
    readonly targetQualityLevel: number,
    readonly objective: QualityOptimizationObjective,
    readonly curatedProducers: ReadonlyMap<string, string>,
    readonly profile: QualityPlanProfile,
  ) {
    this.userDisabledRecipes = specification.getNetDisable().disable
    this.plannerQuality = availableModuleQuality(specification, specification.qualityPlannerModuleQuality)
    this.productivityQuality = availableModuleQuality(
      specification,
      specification.qualityPlannerProductivityModuleQuality,
    )
  }

  build(): QualityGraphItem {
    if (this.planet.key === "fulgora") this.addFulgoraScrapNetwork()
    const output = this.graph.item(this.target, this.targetQualityLevel)
    this.ensureItem(output)
    return output
  }

  private addFulgoraScrapNetwork(): void {
    const scrap = this.specification.items.get("scrap")
    const miningRecipe = this.specification.recipes.get("scrap")
    if (scrap === undefined || miningRecipe === undefined || !this.isUsableProducer(miningRecipe, scrap)) return

    const miningConfiguration = this.getCraftConfigurations(miningRecipe, 0)[0]
    if (miningConfiguration === undefined) throw new Error("Missing Fulgora scrap mining configuration")
    const miningOperation = addCraftRecipe(
      this.graph,
      scrap,
      miningRecipe,
      0,
      0,
      this.specification.maxQualityLevel,
      miningConfiguration,
      [],
      `${this.planet.key}:scrap-source`,
    )
    this.operations.set(miningOperation, miningConfiguration)
    this.graph.setPriority(miningOperation, LOCAL_RESOURCE_WEIGHT, SOURCE_LEVEL)

    const queuedItems = new Set<string>([scrap.key])
    const recycledRecipes = new Set<Recipe>()
    const queue: Item[] = [scrap]
    while (queue.length > 0) {
      const recycledItem = queue.shift()
      if (recycledItem === undefined) break
      const recyclingRecipe = findRecyclerRecipe(this.specification, recycledItem)
      if (recyclingRecipe === null || recycledRecipes.has(recyclingRecipe) || !this.canRecycle(recyclingRecipe)) {
        continue
      }
      recycledRecipes.add(recyclingRecipe)

      const recyclingConfigurations = this.getRecyclerConfigurations(recyclingRecipe)
      for (let inputQuality = 0; inputQuality <= this.specification.maxQualityLevel; inputQuality++) {
        const configuration = recyclingConfigurations[inputQuality]
        if (configuration === undefined) {
          throw new Error(`Missing Fulgora recycling configuration for ${recycledItem.name}`)
        }
        const operation = addCraftRecipe(
          this.graph,
          recycledItem,
          recyclingRecipe,
          inputQuality,
          0,
          this.specification.maxQualityLevel,
          configuration,
          [],
          `${this.planet.key}:source-recycling`,
        )
        this.operations.set(operation, configuration)
        this.setOperationTiebreak(operation, configuration)
      }

      for (const product of recyclingRecipe.products) {
        if (!isQualifiedSolid(product.item) || queuedItems.has(product.item.key)) continue
        queuedItems.add(product.item.key)
        queue.push(product.item)
      }
    }
  }

  getTargetConfigurations(): readonly QualityTierConfiguration[] {
    return this.getCraftConfigurations(this.targetRecipe, this.targetQualityLevel)
  }

  private chooseProducer(item: Item): Recipe | null {
    if (item === this.target) return this.isUsableProducer(this.targetRecipe, item) ? this.targetRecipe : null
    const curatedKey = this.curatedProducers.get(item.key)
    if (curatedKey !== undefined) {
      const curated = this.specification.recipes.get(curatedKey)
      if (curated !== undefined && this.isUsableProducer(curated, item)) return curated
    }

    const candidates = item.recipes.filter((recipe) => this.isUsableProducer(recipe, item))
    const resource = candidates.find((recipe) => recipe.isResource() && this.planet.resources.has(recipe))
    if (resource !== undefined) return resource
    const canonical = candidates.find((recipe) => recipe.key === item.key)
    return canonical ?? candidates.sort((left, right) => (left.order ?? "").localeCompare(right.order ?? ""))[0] ?? null
  }

  private isUsableProducer(recipe: Recipe, item: Item): boolean {
    return isUsableProducer(this.specification, this.planet, recipe, item)
  }

  private ensureItem(graphItem: QualityGraphItem): void {
    const item = graphItem.item
    if (this.expandedItems.has(graphItem.key)) return
    this.expandedItems.add(graphItem.key)

    const keepLevel = graphItem.qualityLevel ?? 0
    const producer = this.chooseProducer(item)
    if (producer !== null) this.ensureProducer(item, keepLevel, producer)

    if (keepLevel === 0 || producer === null) this.addImport(graphItem, item)
  }

  private addImport(graphItem: QualityGraphItem, item: Item): void {
    if (this.importedItems.has(graphItem)) return
    this.importedItems.add(graphItem)
    const qualityPenalty = graphItem.qualityLevel === null ? one : Rational.from_integer(10 ** graphItem.qualityLevel)
    this.graph.source(graphItem, item, IMPORT_WEIGHT.mul(qualityPenalty), SOURCE_LEVEL)
  }

  private ensureProducer(item: Item, keepLevel: number, recipe: Recipe): void {
    const producerKey = `${recipe.key}->${item.key}@q${keepLevel}`
    if (this.expandedProducers.has(producerKey)) return
    this.expandedProducers.add(producerKey)

    const craftConfigurations = this.getCraftConfigurations(recipe, keepLevel)
    const recycler = keepLevel > 0 && isQualifiedSolid(item) ? findRecyclerRecipe(this.specification, item) : null
    const usableRecycler =
      recycler !== null &&
      !this.userDisabledRecipes.has(recycler) &&
      isLocalRecipe(this.planet, recycler) &&
      choosePracticalBuilding(this.specification, this.planet, recycler) !== null
        ? recycler
        : null
    const recyclerConfigurations = usableRecycler === null ? [] : this.getRecyclerConfigurations(usableRecycler)
    const closures =
      usableRecycler === null
        ? []
        : recyclerClosure(
            this.graph,
            item,
            usableRecycler,
            keepLevel,
            this.specification.maxQualityLevel,
            recyclerConfigurations,
          )

    const hasSolidIngredients = recipe.ingredients.some(({ item: ingredient }) => isQualifiedSolid(ingredient))
    const highestInputQuality = isQualifiedSolid(item) && hasSolidIngredients ? this.specification.maxQualityLevel : 0
    for (let inputQuality = 0; inputQuality <= highestInputQuality; inputQuality++) {
      const configuration = craftConfigurations[inputQuality]
      if (configuration === undefined) throw new Error(`Missing practical configuration for ${recipe.name}`)
      const operation = addCraftRecipe(
        this.graph,
        item,
        recipe,
        inputQuality,
        usableRecycler === null ? 0 : keepLevel,
        this.specification.maxQualityLevel,
        configuration,
        closures,
        `${this.planet.key}:${item.key}:keep${keepLevel}`,
      )
      this.operations.set(operation, configuration)
      if (usableRecycler !== null) {
        this.embeddedRecyclers.set(operation, { recipe: usableRecycler, configurations: recyclerConfigurations })
      }
      this.setOperationTiebreak(operation, configuration)
      if (recipe.isResource()) this.graph.setPriority(operation, LOCAL_RESOURCE_WEIGHT, SOURCE_LEVEL)
      for (const ingredient of operation.ingredients) this.ensureItem(ingredient.item)
    }
  }

  private getCraftConfigurations(recipe: Recipe, keepLevel: number): readonly QualityTierConfiguration[] {
    const cacheKey = `craft:${recipe.key}:keep${keepLevel}`
    let configurations = this.configurations.get(cacheKey)
    if (configurations !== undefined) return configurations
    const building = choosePracticalBuilding(this.specification, this.planet, recipe)
    const qualityModule =
      building === null ? null : bestModule(this.specification, recipe, building, this.plannerQuality, "quality")
    const productivityModule =
      building === null
        ? null
        : bestModule(this.specification, recipe, building, this.productivityQuality, "productivity")
    configurations = Array.from({ length: this.specification.maxQualityLevel + 1 }, (_, qualityLevel) => {
      const qualityGoal = this.profile === "planet" ? this.targetQualityLevel : keepLevel
      const wantsQuality = qualityGoal > qualityLevel && recipe.allow_quality
      return moduleTierConfiguration({
        specification: this.specification,
        recipe,
        qualityLevel,
        building,
        module: wantsQuality ? qualityModule : productivityModule,
        moduleQuality: wantsQuality ? this.plannerQuality : this.productivityQuality,
        preserveBeacons: true,
      })
    })
    this.configurations.set(cacheKey, configurations)
    return configurations
  }

  private getRecyclerConfigurations(recipe: Recipe): readonly QualityTierConfiguration[] {
    const cacheKey = `recycler:${recipe.key}`
    let configurations = this.configurations.get(cacheKey)
    if (configurations !== undefined) return configurations
    const building = choosePracticalBuilding(this.specification, this.planet, recipe)
    const qualityModule =
      building === null ? null : bestModule(this.specification, recipe, building, this.plannerQuality, "quality")
    configurations = Array.from({ length: this.specification.maxQualityLevel + 1 }, (_, qualityLevel) =>
      moduleTierConfiguration({
        specification: this.specification,
        recipe,
        qualityLevel,
        building,
        module: qualityModule,
        moduleQuality: this.plannerQuality,
        preserveBeacons: true,
      }),
    )
    this.configurations.set(cacheKey, configurations)
    return configurations
  }

  private setOperationTiebreak(operation: QualityGraphRecipe, configuration: QualityTierConfiguration): void {
    const recipe = operation.metadata.baseRecipe
    if (recipe === null || recipe.isResource()) return
    const capacity = operationCapacity(this.specification, recipe, one, configuration)
    const cost = this.objective === "power" ? capacity.power : capacity.machineCount
    this.graph.setPriority(operation, cost.isZero() ? one : cost, LOCAL_OPERATION_LEVEL)
  }

  canRecycle(recipe: Recipe): boolean {
    return (
      !this.userDisabledRecipes.has(recipe) &&
      isLocalRecipe(this.planet, recipe) &&
      choosePracticalBuilding(this.specification, this.planet, recipe) !== null
    )
  }

  disposalConfiguration(recipe: Recipe, qualityLevel: number): QualityTierConfiguration {
    const configuration = this.getRecyclerConfigurations(recipe)[qualityLevel]
    if (configuration === undefined) throw new Error(`Missing recycler configuration for ${recipe.name}`)
    return configuration
  }
}

export function planPracticalQualityTarget(options: {
  readonly specification: FactorySpecification
  readonly planet: Planet
  readonly profile: QualityPlanProfile
  readonly item: Item
  readonly recipe: Recipe
  readonly requested: Rational
  readonly qualityLevel: number
  readonly curatedProducers?: ReadonlyMap<string, string>
  readonly profileWarnings?: readonly string[]
}): QualityTargetPlan {
  const {
    specification,
    planet,
    profile,
    item,
    recipe: preferredRecipe,
    requested,
    qualityLevel,
    curatedProducers = new Map(),
    profileWarnings = [],
  } = options
  if (qualityLevel <= 0) throw new Error(`${planet.name} quality planning requires a non-Normal target.`)
  const recipe = getPreferredPracticalQualityRecipe({
    specification,
    planet,
    item,
    preferredRecipe,
    curatedProducers,
  })
  if (recipe === null) throw new Error(`${item.name} has no usable ${planet.name} production recipe.`)

  const objective = objectiveForPlan(specification)
  const builder = new PracticalQualityGraphBuilder(
    specification,
    planet,
    item,
    recipe,
    qualityLevel,
    objective,
    curatedProducers,
    profile,
  )
  const output = builder.build()
  const totals = builder.graph.solve(output, requested, specification.getQualityGraphOptimizer())
  const sourceAmounts = new Map<string, QualifiedItemAmount>()
  const importedAmounts = new Map<string, QualifiedItemAmount>()
  const operations: QualityOperationRate[] = []
  const hiddenRecyclerRates = new Map<
    string,
    { recipe: Recipe; qualityLevel: number; rate: Rational; configuration: QualityTierConfiguration }
  >()
  let totalCrafts = zero
  let totalRecycles = zero
  let totalMachineCount = zero
  let totalPower = zero

  const addSource = (graphItem: QualityGraphItem, amount: Rational): void => {
    if (amount.isZero()) return
    mergeQualifiedAmounts(sourceAmounts, [{ item: graphItem.item, qualityLevel: graphItem.qualityLevel ?? 0, amount }])
  }

  for (const [solverRecipe, rate] of totals.rates) {
    if (!(solverRecipe instanceof QualityGraphRecipe) || rate.isZero()) continue
    const baseRecipe = solverRecipe.metadata.baseRecipe
    if (baseRecipe === null) {
      if (solverRecipe.metadata.kind === "source") {
        const product = solverRecipe.products[0]
        if (product !== undefined) {
          const amount = rate.mul(product.amount)
          addSource(product.item, amount)
          mergeQualifiedAmounts(importedAmounts, [
            { item: product.item.item, qualityLevel: product.item.qualityLevel ?? 0, amount },
          ])
        }
      }
      continue
    }
    const quality = solverRecipe.metadata.qualityLevel
    const configuration = builder.operations.get(solverRecipe)
    if (quality === null || configuration === undefined) continue
    const capacity = operationCapacity(specification, baseRecipe, rate, configuration)
    let kind: QualityOperationRate["kind"] = "craft"
    if (baseRecipe.isResource()) kind = "source"
    else if (baseRecipe.categories.has("recycling")) kind = "recycle"
    operations.push({
      recipe: baseRecipe,
      qualityLevel: quality,
      rate,
      machineCount: capacity.machineCount,
      power: capacity.power,
      kind,
      configuration,
    })
    if (kind === "source") {
      for (const product of solverRecipe.products) addSource(product.item, rate.mul(product.amount))
    } else if (kind === "recycle") {
      totalRecycles = totalRecycles.add(rate)
    } else {
      totalCrafts = totalCrafts.add(rate)
    }
    totalMachineCount = totalMachineCount.add(capacity.machineCount)
    totalPower = totalPower.add(capacity.power)

    const embedded = builder.embeddedRecyclers.get(solverRecipe)
    if (embedded === undefined) continue
    for (let recyclerQuality = 0; recyclerQuality <= specification.maxQualityLevel; recyclerQuality++) {
      const recycleRate = rate.mul(solverRecipe.metadata.recycleRatesByQuality?.[recyclerQuality] ?? zero)
      if (recycleRate.isZero()) continue
      const key = `${embedded.recipe.key}@q${recyclerQuality}`
      const current = hiddenRecyclerRates.get(key)
      const configuration = embedded.configurations[recyclerQuality]
      if (configuration === undefined) continue
      hiddenRecyclerRates.set(key, {
        recipe: embedded.recipe,
        qualityLevel: recyclerQuality,
        rate: (current?.rate ?? zero).add(recycleRate),
        configuration,
      })
    }
  }

  for (const row of hiddenRecyclerRates.values()) {
    const capacity = operationCapacity(specification, row.recipe, row.rate, row.configuration)
    operations.push({
      recipe: row.recipe,
      qualityLevel: row.qualityLevel,
      rate: row.rate,
      machineCount: capacity.machineCount,
      power: capacity.power,
      kind: "recycle",
      configuration: row.configuration,
    })
    totalRecycles = totalRecycles.add(row.rate)
    totalMachineCount = totalMachineCount.add(capacity.machineCount)
    totalPower = totalPower.add(capacity.power)
  }

  let surplusOutputs: readonly QualifiedItemAmount[] = sortedQualifiedAmounts(
    [...totals.surplus].filter(([surplus]) => surplus instanceof QualityGraphItem) as [QualityGraphItem, Rational][],
  )
  const disposal = planQualitySurplusDisposal({
    specification,
    target: item,
    keepLevel: qualityLevel,
    surplus: surplusOutputs,
    canRecycle: (candidate) => builder.canRecycle(candidate),
    getConfiguration: (candidate, level) => builder.disposalConfiguration(candidate, level),
    cycleLabel: planet.name,
  })
  operations.push(...disposal.operations)
  surplusOutputs = disposal.terminalOutputs
  mergeQualifiedAmounts(sourceAmounts, disposal.extraFreshInputs)
  mergeQualifiedAmounts(importedAmounts, disposal.extraFreshInputs)
  totalRecycles = totalRecycles.add(disposal.totalRecycles)
  totalMachineCount = totalMachineCount.add(disposal.totalMachineCount)
  totalPower = totalPower.add(disposal.totalPower)

  operations.sort((left, right) => {
    const kindOrder = { source: 0, craft: 1, recycle: 2, dispose: 3 } as const
    const kind = kindOrder[left.kind] - kindOrder[right.kind]
    if (kind !== 0) return kind
    const order = (left.recipe.order ?? "").localeCompare(right.recipe.order ?? "")
    return order === 0 ? left.qualityLevel - right.qualityLevel : order
  })

  const fresh = sortedAmountMap(sourceAmounts)
  const freshInputs = fresh.filter(({ item: input }) => input.phase === "solid")
  const importedInputs = sortedAmountMap(importedAmounts)
  const fluidInputs = fresh.filter(({ item: input }) => input.phase !== "solid")
  const craftConfigurations = builder.getTargetConfigurations()
  const firstPassChance = qualityTransitionProbability(
    craftConfigurations[0]?.qualityChance ?? zero,
    0,
    qualityLevel,
    specification.maxQualityLevel,
  )
  const recyclerRecipe = findRecyclerRecipe(specification, item)
  const warnings = [
    ...profileWarnings,
    "Quality modules are used before the requested quality; guaranteed requested-quality crafting uses the configured productivity module and quality where compatible.",
    "Lower-quality products are processed through their real recycler recipes. Irreducible or intentionally retained byproducts remain listed.",
    "Expected steady-state throughput; low-volume high-quality output will be lumpy.",
  ]
  if (!specification.selectedPlanets.has(planet)) {
    warnings.unshift(`The plan uses ${planet.name} availability because the target is in automatic quality mode.`)
  }
  warnings.push(
    `Inputs unavailable from ${planet.name} resources are shown as imports rather than silently treated as Normal local materials.`,
  )

  return {
    profile,
    planetKey: planet.key,
    objective,
    item,
    recipe,
    recyclerRecipe,
    qualityLevel,
    requested,
    firstPassChance,
    freshInputs,
    importedInputs,
    fluidInputs,
    surplusOutputs,
    operations,
    totalCrafts,
    totalRecycles,
    totalMachineCount,
    totalPower,
    warnings,
  }
}

export function planPlanetQualityTarget(options: {
  readonly specification: FactorySpecification
  readonly planet: Planet
  readonly item: Item
  readonly recipe: Recipe
  readonly requested: Rational
  readonly qualityLevel: number
}): QualityTargetPlan {
  return planPracticalQualityTarget({
    ...options,
    profile: "planet",
    ...(options.planet.key === "fulgora" ? { curatedProducers: FULGORA_CURATED_PRODUCERS } : {}),
    profileWarnings: [
      options.planet.key === "fulgora"
        ? "Fulgora practical mode starts at quality-moduled scrap mining, recycles every scrap quality locally, " +
          "and reuses generated recycler outputs before importing materials."
        : `${options.planet.name} practical mode recursively produces higher-quality intermediates from local resources and fluids.`,
    ],
  })
}
// endregion quality/practical.ts

// region quality/vulcanus.ts
const CURATED_PRODUCERS = new Map<string, string>([
  ["steam", "acid-neutralisation"],
  ["water", "steam-condensation"],
  ["heavy-oil", "simple-coal-liquefaction"],
  ["light-oil", "heavy-oil-cracking"],
  ["petroleum-gas", "light-oil-cracking"],
  ["molten-iron", "molten-iron-from-lava"],
  ["molten-copper", "molten-copper-from-lava"],
  ["iron-plate", "casting-iron"],
  ["copper-plate", "casting-copper"],
  ["steel-plate", "casting-steel"],
  ["iron-gear-wheel", "casting-iron-gear-wheel"],
  ["iron-stick", "casting-iron-stick"],
  ["copper-cable", "casting-copper-cable"],
  ["pipe", "casting-pipe"],
  ["pipe-to-ground", "casting-pipe-to-ground"],
  ["low-density-structure", "casting-low-density-structure"],
])

export function planVulcanusQualityTarget(options: {
  readonly specification: FactorySpecification
  readonly item: Item
  readonly recipe: Recipe
  readonly requested: Rational
  readonly qualityLevel: number
}): QualityTargetPlan {
  const vulcanus = options.specification.planets?.get("vulcanus")
  if (vulcanus === undefined) throw new Error("Vulcanus quality planning requires a Space Age dataset with Vulcanus.")
  return planPracticalQualityTarget({
    ...options,
    planet: vulcanus,
    profile: "vulcanus",
    curatedProducers: CURATED_PRODUCERS,
    profileWarnings: [
      "Vulcanus practical mode starts local metals at lava and molten-metal casting instead of importing Normal plates.",
    ],
  })
}
// endregion quality/vulcanus.ts

// region factory.ts
// Calculator defaults

export const DEFAULT_ITEM_KEY = "advanced-circuit"
export const DEFAULT_PLANET = "nauvis"
export const DEFAULT_BELT = "transport-belt"
export const DEFAULT_FUEL = "coal"
export const DEFAULT_QUALITY_PLANNER_MODULE_KEY = "quality-module-2"
export const DEFAULT_QUALITY_PLANNER_MODULE_QUALITY_KEY = "legendary"
export const DEFAULT_QUALITY_PLANNER_PRODUCTIVITY_MODULE_KEY = "productivity-module-3"
export const DEFAULT_QUALITY_PLANNER_PRODUCTIVITY_MODULE_QUALITY_KEY = "legendary"
export const DEFAULT_BUILDING_KEYS = new Set([
  "assembling-machine-1",
  "chemical-plant",
  "stone-furnace",
  "electric-mining-drill",
])

// Factory application contracts

export type FactoryRecipe = Recipe | DisabledRecipe
export type TargetBasis = "machines" | "rate" | "belts"
export type BeltStackPolicy = "auto" | "stacked" | "unstacked"

export function isBeltStackPolicy(value: string): value is BeltStackPolicy {
  return value === "auto" || value === "stacked" || value === "unstacked"
}

export interface FactoryBuildTarget {
  index: number
  itemKey: string
  item: Item
  recipe: Recipe | null
  readonly changedBuilding: boolean
  basis: TargetBasis
  buildings: Rational
  rate: Rational
  belts: Rational
  qualityLevel: number
  qualityStrategy: QualityStrategy
  readonly defaultRecipe: Recipe | null
  getRate(): Rational
  getBuildingCountInput(): string
  getBeltCountInput(): string
  setBuildings(value: string, recipe: Recipe | null): void
  setRate(value: string): void
  setBelts(value: string): void
  setQuality(level: number | string): void
  setQualityStrategy(strategy: QualityStrategy, preservedRate?: Rational | null): void
  displayRecipes(): void
  rateChanged(): void
  invalidateQualityUndo?(recipe: Recipe): void
}

export interface RecipeConfigurationSnapshot {
  readonly hasBuildingOverride: boolean
  readonly buildingOverride: Building | null
  readonly buildingOverrideSource: ConfigurationSource
  readonly revision: number
  readonly machineQualityOverride: Quality | null
  readonly moduleSpec: {
    readonly object: ModuleSpec
    readonly building: Building | null
    readonly modules: readonly (Module | null)[]
    readonly moduleQualities: readonly Quality[]
    readonly moduleQualityOverrides: readonly number[]
    readonly moduleSource: ConfigurationSource
    readonly beaconModules: readonly (Module | null)[]
    readonly beaconModuleQualities: readonly Quality[]
    readonly beaconModuleQualityOverrides: readonly number[]
    readonly beaconQuality: Quality
    readonly beaconQualityOverride: boolean
    readonly beaconCount: Rational
  } | null
}

// Factory rendering port

/**
 * Browser-facing operations required by the calculator application model.
 *
 * The application layer depends on this port, not on D3 or concrete DOM
 * renderers. Headless tests omit the port entirely.
 */
export interface FactoryViewPort {
  createBuildTarget(index: number, itemKey: string, item: Item, itemGroups: ItemGroups): FactoryBuildTarget
  mountBuildTarget(target: FactoryBuildTarget): void
  removeBuildTarget(target: FactoryBuildTarget): void
  renderSolution(specification: FactorySpecification, totals: Totals): void
  renderCalculationError(specification: FactorySpecification, error: unknown): void
  persistUrlState(): void
}

// Building groups

export interface CategoryOwner {
  readonly categories?: Iterable<string> | string
  readonly category?: string | null
}

export function getCategories(value: CategoryOwner): string[] {
  const categories = value.categories ?? value.category
  if (categories === undefined || categories === null) return []
  return typeof categories === "string" ? [categories] : [...categories]
}

export function buildingCanCraft(building: Building, recipe: Recipe): boolean {
  return getCategories(recipe).some((category) => building.categories.has(category))
}

class BuildingSet {
  readonly categories = new Set<string>()
  readonly buildings = new Set<Building>()

  constructor(building: Building | null = null) {
    if (building !== null) {
      for (const category of building.categories) this.categories.add(category)
      this.buildings.add(building)
    }
  }

  merge(other: BuildingSet): void {
    for (const category of other.categories) this.categories.add(category)
    for (const building of other.buildings) this.buildings.add(building)
  }

  overlaps(other: BuildingSet): boolean {
    return [...this.categories].some((category) => other.categories.has(category))
  }
}

export function buildingSort(buildings: Building[]): void {
  buildings.sort((a, b) => (a.less(b) ? -1 : b.less(a) ? 1 : 0))
}

export class BuildingGroup {
  readonly buildings: Building[]
  building: Building
  selectedBuildings: Set<Building>

  constructor(buildingSet: Iterable<Building>) {
    this.buildings = [...buildingSet]
    buildingSort(this.buildings)
    const defaultBuildings = this.getDefaults()
    const defaultBuilding = defaultBuildings[0]
    if (defaultBuilding === undefined) throw new Error("Building group cannot be empty")
    this.building = defaultBuilding
    this.selectedBuildings = new Set(defaultBuildings)
  }

  getDefaults(): Building[] {
    const defaults = this.buildings.filter((building) => DEFAULT_BUILDING_KEYS.has(building.key))
    if (defaults.length > 0) return defaults
    const fallback = this.buildings.at(-1)
    return fallback === undefined ? [] : [fallback]
  }

  getDefault(): Building | null {
    return this.getDefaults()[0] ?? null
  }

  getBuilding(recipe: Recipe, available: (building: Building) => boolean = () => true): Building | null {
    let fallback: Building | null = null
    let selected: Building | null = null
    for (const building of this.buildings) {
      if (buildingCanCraft(building, recipe) && available(building)) {
        fallback = building
        if (this.selectedBuildings.has(building)) selected = building
      }
    }
    return selected ?? fallback
  }
}

function mergeBuildingSet(sets: Set<BuildingSet>, buildingSet: BuildingSet): void {
  for (const other of [...sets]) {
    if (buildingSet.overlaps(other)) {
      buildingSet.merge(other)
      sets.delete(other)
    }
  }
  sets.add(buildingSet)
}

export function getBuildingGroups(
  buildings: readonly Building[],
  recipes: Iterable<Recipe>,
): Map<string, BuildingGroup> {
  const sets = new Set<BuildingSet>()
  for (const building of buildings) mergeBuildingSet(sets, new BuildingSet(building))

  for (const recipe of recipes) {
    const categories = getCategories(recipe)
    if (categories.length < 2) continue
    const set = new BuildingSet()
    for (const category of categories) set.categories.add(category)
    mergeBuildingSet(sets, set)
  }

  const groups = new Map<string, BuildingGroup>()
  for (const { categories, buildings: groupBuildings } of sets) {
    if (groupBuildings.size === 0) continue
    const group = new BuildingGroup(groupBuildings)
    for (const category of categories) groups.set(category, group)
  }
  return groups
}

// Location policy

export function syncLocationDisabledRecipes(specification: FactorySpecification): void {
  const selected = [...specification.selectedPlanets]
  const first = selected[0]
  const unavailable =
    first === undefined
      ? new Set<Recipe>()
      : selected
          .slice(1)
          .reduce(
            (intersection, location) => new Set([...intersection].filter((recipe) => location.disable.has(recipe))),
            new Set(first.disable),
          )

  specification.planetaryBaseline = unavailable
  for (let recipe of [...specification.disable]) {
    if (!unavailable.has(recipe)) {
      specification.setEnable(recipe)
    }
  }
  for (let recipe of unavailable) {
    if (!specification.disable.has(recipe)) {
      specification.setDisable(recipe)
    }
  }
}

export function isDefaultLocationSelection(specification: FactorySpecification): boolean {
  if (!specification.planets || specification.planets.size === 1) {
    return true
  }
  const selected = [...specification.selectedPlanets]
  return selected.length === 1 && selected[0]?.key === DEFAULT_PLANET
}

export function getUserRecipeOverrides(specification: FactorySpecification): {
  disable: Set<Recipe>
  enable: Set<Recipe>
} {
  if (!specification.planetaryBaseline) {
    return { disable: specification.disable, enable: new Set<Recipe>() }
  }
  const baseline = specification.planetaryBaseline
  return {
    disable: new Set([...specification.disable].filter((recipe) => !baseline.has(recipe))),
    enable: new Set([...baseline].filter((recipe) => !specification.disable.has(recipe))),
  }
}

export function selectOnlyLocation(specification: FactorySpecification, location: Planet): void {
  specification.selectedPlanets.clear()
  specification.selectedPlanets.add(location)
  syncLocationDisabledRecipes(specification)
}

export function selectLocation(specification: FactorySpecification, location: Planet): void {
  specification.selectedPlanets.add(location)
  syncLocationDisabledRecipes(specification)
}

export function unselectLocation(specification: FactorySpecification, location: Planet): void {
  specification.selectedPlanets.delete(location)
  syncLocationDisabledRecipes(specification)
}

export function getRecipeLocations(
  specification: FactorySpecification,
  recipe: Recipe,
  building: Building | null = null,
): Planet[] {
  if (!specification.selectedPlanets || specification.selectedPlanets.size === 0) {
    return []
  }

  const result: Planet[] = []
  for (let location of specification.selectedPlanets) {
    if (!location.allowsRecipe(recipe)) {
      continue
    }
    if (building !== null && !location.allowsBuilding(building)) {
      continue
    }
    result.push(location)
  }
  result.sort((a, b) => a.order.localeCompare(b.order))
  return result
}

// Recipe selection commands

export function getItemProductionRecipes(item: Item): Recipe[] {
  return item.recipes.filter((recipe) => !recipe.isDisable() && recipe.isReal() && recipe.isNetProducer(item))
}

export function setRecipeEnabled(specification: FactorySpecification, recipe: Recipe, enabled: boolean): void {
  if (enabled) {
    specification.setEnable(recipe)
  } else {
    specification.setDisable(recipe)
  }
}

// Factory specification

function replaceMap<TKey, TValue>(target: Map<TKey, TValue>, source: ReadonlyMap<TKey, TValue>): void {
  target.clear()
  for (const [key, value] of source) target.set(key, value)
}

export class FactorySpecification {
  view: FactoryViewPort | null
  readonly items = new Map<string, Item>()
  readonly recipes = new Map<string, Recipe>()
  readonly modules = new Map<string, Module>()
  readonly qualities = new Map<string, Quality>()
  readonly qualityTiers: Quality[] = []
  planets: Map<string, Planet> | null = null
  readonly buildings = new Map<string, BuildingGroup>()
  readonly buildingKeys = new Map<string, Building>()
  readonly buildingOverrides = new Map<Recipe, Building>()
  readonly buildingOverrideSources = new Map<Recipe, ConfigurationSource>()
  readonly machineQualityOverrides = new Map<Recipe, Quality>()
  readonly recipeConfigurationRevisions = new Map<Recipe, number>()
  readonly belts = new Map<string, Belt>()
  fuels: FuelCollection | null = null
  itemGroups: ItemGroups = []
  readonly buildTargets: FactoryBuildTarget[] = []
  readonly spec = new Map<Recipe, ModuleSpec>()
  defaultModule: Module | null = null
  secondaryDefaultModule: Module | null = null
  defaultMachineQuality: Quality = normalQuality
  defaultModuleQuality: Quality = normalQuality
  defaultBeaconQuality: Quality = normalQuality
  qualityPlannerModule: Module | null = null
  qualityPlannerModuleQuality: Quality = normalQuality
  qualityPlannerProductivityModule: Module | null = null
  qualityPlannerProductivityModuleQuality: Quality = normalQuality
  qualityPlannerObjective: QualityPlannerObjective = "practical"
  readonly defaultBeacon: (Module | null)[] = [null, null]
  defaultBeaconCount = zero
  belt: Belt | null = null
  fuel: Fuel | null = null
  miningProd = zero
  recipeProductivityResearch = new Map<string, RecipeProductivityResearch>()
  readonly recipeProductivityLevels = new Map<string, number>()
  readonly recipeProductivityEffects = new Map<Recipe, { researchKey: string; change: Rational }[]>()
  readonly minerSettings = new Map<Recipe, { miner: Miner; purity: Rational }>()
  readonly ignore = new Set<Item>()
  readonly disable = new Set<Recipe>()
  readonly selectedPlanets = new Set<Planet>()
  planetaryBaseline: Set<Recipe> | null = null
  priority = new PriorityList()
  defaultPriority: Map<PrioritizedRecipe, Rational>[] = []
  beltStackSize = one
  beltStackDefaultPolicy: BeltStackPolicy = "auto"
  readonly beltStackOverrides = new Map<Item, BeltStackPolicy>()
  bufferMinutes = one
  freshnessDelayMinutes = zero
  readonly resourceYields = new Map<Recipe, Rational>()
  readonly asteroidLimits = new Map<string, Rational>()
  readonly recipeLocations = new Map<Recipe, Planet>()
  beaconPower = zero
  maxQualityLevel = 4
  readonly format = new Formatter()
  lastTotals: Totals | null = null
  lastError: unknown = null
  readonly qualityPlans: QualityTargetPlan[] = []
  private qualityGraphOptimizer: QualityGraphOptimizer | null = null
  private qualityGraphOptimizerLoader: (() => Promise<QualityGraphOptimizer>) | null = null
  private qualityGraphOptimizerPromise: Promise<void> | null = null
  private qualityGraphOptimizerLoadGeneration = 0
  private readonly stateListeners = new Set<() => void>()
  private stateRevision = 0

  constructor(view: FactoryViewPort | null = null) {
    this.view = view
  }
  setQualityGraphOptimizer(optimizer: QualityGraphOptimizer | null): void {
    this.qualityGraphOptimizer = optimizer
  }
  setQualityGraphOptimizerLoader(loader: (() => Promise<QualityGraphOptimizer>) | null): void {
    this.qualityGraphOptimizerLoader = loader
    this.qualityGraphOptimizerLoadGeneration++
  }
  getQualityGraphOptimizer(): QualityGraphOptimizer | null {
    return this.qualityGraphOptimizer
  }
  private deferForQualityGraphOptimizer(): boolean {
    const needsOptimizer = this.buildTargets.some(
      (target) => target.qualityLevel > 0 && target.qualityStrategy === "auto",
    )
    if (!needsOptimizer || this.qualityGraphOptimizer !== null || this.qualityGraphOptimizerLoader === null) {
      return false
    }
    if (this.qualityGraphOptimizerPromise === null) {
      const generation = this.qualityGraphOptimizerLoadGeneration
      this.qualityGraphOptimizerPromise = this.qualityGraphOptimizerLoader()
        .then((optimizer) => {
          if (generation === this.qualityGraphOptimizerLoadGeneration) this.qualityGraphOptimizer = optimizer
        })
        .catch(() => {
          // This loader is an optimization only. If the optional WASM asset
          // is unavailable, preserve the exact simplex calculation path.
          if (generation === this.qualityGraphOptimizerLoadGeneration) this.qualityGraphOptimizerLoader = null
        })
        .finally(() => {
          if (generation !== this.qualityGraphOptimizerLoadGeneration) return
          this.qualityGraphOptimizerPromise = null
          this.updateSolution()
        })
    }
    return true
  }
  get revision(): number {
    return this.stateRevision
  }
  subscribe(listener: () => void): () => void {
    this.stateListeners.add(listener)
    return () => this.stateListeners.delete(listener)
  }
  notifyStateChanged(): void {
    this.stateRevision++
    for (const listener of this.stateListeners) listener()
  }
  setData(
    items: ReadonlyMap<string, Item>,
    recipes: ReadonlyMap<string, Recipe>,
    planets: Map<string, Planet> | null,
    modules: ReadonlyMap<string, Module>,
    buildings: readonly Building[],
    belts: ReadonlyMap<string, Belt>,
    fuels: FuelCollection,
    itemGroups: ItemGroups,
    recipeProductivityResearch: Map<string, RecipeProductivityResearch> = new Map(),
    beaconPower: Rational = zero,
    qualities: ReadonlyMap<string, Quality> = new Map([[normalQuality.key, normalQuality]]),
  ): void {
    replaceMap(this.items, items)
    replaceMap(this.recipes, recipes)
    this.planets = planets
    replaceMap(this.modules, modules)
    replaceMap(this.qualities, qualities)
    this.qualityTiers.splice(
      0,
      this.qualityTiers.length,
      ...[...qualities.values()].sort((a, b) => a.order.localeCompare(b.order)),
    )
    const normal = this.qualities.get("normal") ?? this.qualityTiers[0] ?? normalQuality
    this.defaultMachineQuality = normal
    this.defaultModuleQuality = normal
    this.defaultBeaconQuality = normal
    const qualityPlannerModule = this.modules.get(DEFAULT_QUALITY_PLANNER_MODULE_KEY)
    this.qualityPlannerModule = qualityPlannerModule?.hasQualityEffect() ? qualityPlannerModule : null
    this.qualityPlannerModuleQuality = this.qualities.get(DEFAULT_QUALITY_PLANNER_MODULE_QUALITY_KEY) ?? normal
    const qualityPlannerProductivityModule = this.modules.get(DEFAULT_QUALITY_PLANNER_PRODUCTIVITY_MODULE_KEY)
    this.qualityPlannerProductivityModule = qualityPlannerProductivityModule?.hasProdEffect()
      ? qualityPlannerProductivityModule
      : null
    this.qualityPlannerProductivityModuleQuality =
      this.qualities.get(DEFAULT_QUALITY_PLANNER_PRODUCTIVITY_MODULE_QUALITY_KEY) ?? normal
    this.qualityPlannerObjective = "practical"
    this.machineQualityOverrides.clear()
    replaceMap(this.buildings, getBuildingGroups(buildings, recipes.values()))
    this.buildingKeys.clear()
    for (const building of buildings) this.buildingKeys.set(building.key, building)
    replaceMap(this.belts, belts)
    this.belt = this.belts.get(DEFAULT_BELT) ?? null
    this.fuels = fuels
    this.fuel = fuels.get(DEFAULT_FUEL) ?? null
    this.miningProd = zero
    this.recipeProductivityResearch = recipeProductivityResearch
    this.recipeProductivityLevels.clear()
    this.recipeProductivityEffects.clear()
    for (let research of recipeProductivityResearch.values()) {
      for (let [recipe, change] of research.effects) {
        let effects = this.recipeProductivityEffects.get(recipe)
        if (effects === undefined) {
          effects = []
          this.recipeProductivityEffects.set(recipe, effects)
        }
        effects.push({ researchKey: research.key, change })
      }
    }
    this.itemGroups = itemGroups
    this.beaconPower = beaconPower
    this.defaultPriority = this.getDefaultPriorityArray()
    this.priority = new PriorityList()
    this.notifyStateChanged()
  }
  setDefaultDisable(): void {
    this.disable.clear()
  }
  setDisable(recipe: Recipe): void {
    disableRecipe(this, recipe)
  }
  setEnable(recipe: Recipe): void {
    enableRecipe(this, recipe)
  }
  isDefaultPlanet(): boolean {
    return isDefaultLocationSelection(this)
  }
  getNetDisable(): { disable: Set<Recipe>; enable: Set<Recipe> } {
    return getUserRecipeOverrides(this)
  }
  selectOnePlanet(planet: Planet): void {
    selectOnlyLocation(this, planet)
  }
  selectPlanet(planet: Planet): void {
    selectLocation(this, planet)
  }
  unselectPlanet(planet: Planet): void {
    unselectLocation(this, planet)
  }
  getDefaultPriorityArray(): Map<PrioritizedRecipe, Rational>[] {
    return buildDefaultPriorityArray(this)
  }
  setDefaultPriority(): void {
    restoreDefaultPriorities(this)
  }
  isValidPriorityKey(key: string): boolean {
    return isValidPriorityKey(this, key)
  }
  setPriorities(tiers: readonly (readonly (readonly [string, Rational])[])[]): void {
    applyPriorities(this, tiers)
  }
  isDefaultPriority(): boolean {
    return this.priority.equalArray(this.defaultPriority)
  }
  getUses(item: Item): Recipe[] {
    return getEnabledUses(this, item)
  }
  isItemDisabled(item: Item): boolean {
    return isItemDisabled(this, item)
  }
  getRecipes(item: Item): FactoryRecipe[] {
    return getEnabledRecipes(this, item)
  }
  getRecipeGraph(items: ReadonlyMap<Item, Rational>): Set<FactoryRecipe> {
    return getRecipeGraph(this, items)
  }
  isFactoryTarget(recipe: Recipe): boolean {
    return isFactoryTarget(this, recipe)
  }
  isBuildingAvailable(building: Building, recipe: Recipe): boolean {
    if (!this.selectedPlanets || this.selectedPlanets.size === 0) {
      return true
    }
    for (let location of this.selectedPlanets) {
      if (location.allowsRecipe(recipe) && location.allowsBuilding(building)) {
        return true
      }
    }
    return false
  }
  getCompatibleBuildings(recipe: Recipe, availableOnly = true): Building[] {
    for (let category of getCategories(recipe)) {
      let group = this.buildings.get(category)
      if (group !== undefined) {
        return group.buildings.filter(
          (building) =>
            buildingCanCraft(building, recipe) && (!availableOnly || this.isBuildingAvailable(building, recipe)),
        )
      }
    }
    return []
  }
  getAutomaticBuilding(recipe: Recipe): Building | null {
    for (let category of getCategories(recipe)) {
      let group = this.buildings.get(category)
      if (group !== undefined) {
        return group.getBuilding(recipe, (building) => this.isBuildingAvailable(building, recipe))
      }
    }
    return null
  }
  getBuildingOverride(recipe: Recipe): Building | null {
    return this.buildingOverrides.get(recipe) ?? null
  }
  getBuildingOverrideSource(recipe: Recipe): ConfigurationSource {
    if (!this.buildingOverrides.has(recipe)) return "default"
    return this.buildingOverrideSources.get(recipe) ?? "user"
  }
  getBuilding(recipe: Recipe): Building | null {
    return this.getBuildingOverride(recipe) ?? this.getAutomaticBuilding(recipe)
  }
  getNormalQuality(): Quality {
    return this.qualities.get("normal") ?? this.qualityTiers[0] ?? normalQuality
  }
  getQualityIndex(quality: Quality): number {
    return Math.max(0, this.qualityTiers.indexOf(quality))
  }
  getAvailableQualities(): readonly Quality[] {
    return this.qualityTiers.slice(0, this.maxQualityLevel + 1)
  }
  setMaxQualityLevel(level: number): void {
    const maximum = Math.max(0, this.qualityTiers.length - 1)
    this.maxQualityLevel = Number.isFinite(level) ? Math.min(maximum, Math.max(0, Math.floor(level))) : maximum
    const normal = this.getNormalQuality()
    const available = new Set(this.getAvailableQualities())
    if (!available.has(this.defaultMachineQuality)) this.defaultMachineQuality = normal
    if (!available.has(this.defaultModuleQuality)) this.defaultModuleQuality = normal
    if (!available.has(this.defaultBeaconQuality)) this.defaultBeaconQuality = normal
    if (!available.has(this.qualityPlannerModuleQuality)) this.qualityPlannerModuleQuality = normal
    if (!available.has(this.qualityPlannerProductivityModuleQuality)) {
      this.qualityPlannerProductivityModuleQuality = normal
    }
    for (const [recipe, quality] of this.machineQualityOverrides) {
      if (!available.has(quality)) this.machineQualityOverrides.delete(recipe)
    }
    for (const moduleSpec of this.spec.values()) {
      for (let index = 0; index < moduleSpec.moduleQualities.length; index++) {
        if (!available.has(moduleSpec.moduleQualities[index] ?? normal)) {
          moduleSpec.moduleQualities[index] = normal
          moduleSpec.moduleQualityOverrides.delete(index)
        }
      }
      for (let index = 0; index < moduleSpec.beaconModuleQualities.length; index++) {
        if (!available.has(moduleSpec.beaconModuleQualities[index] ?? normal)) {
          moduleSpec.beaconModuleQualities[index] = normal
          moduleSpec.beaconModuleQualityOverrides.delete(index)
        }
      }
      if (!available.has(moduleSpec.beaconQuality)) {
        moduleSpec.beaconQuality = normal
        moduleSpec.beaconQualityOverride = false
      }
    }
  }
  private getMachineQualityRecipe(recipe: Recipe): Recipe {
    return recipe.key === "rocket-launch" ? (this.recipes.get("rocket-part") ?? recipe) : recipe
  }
  getMachineQuality(recipe: Recipe): Quality {
    return this.machineQualityOverrides.get(this.getMachineQualityRecipe(recipe)) ?? this.defaultMachineQuality
  }
  setMachineQuality(recipe: Recipe, quality: Quality, source: ConfigurationSource = "user"): void {
    const qualityRecipe = this.getMachineQualityRecipe(recipe)
    if (quality === this.defaultMachineQuality) this.machineQualityOverrides.delete(qualityRecipe)
    else this.machineQualityOverrides.set(qualityRecipe, quality)
    if (source === "user") this.notifyRecipeConfigurationChanged(recipe)
    else this.recordRecipeConfigurationChange(recipe)
    if (qualityRecipe !== recipe) this.recordRecipeConfigurationChange(qualityRecipe)
  }
  setDefaultMachineQuality(quality: Quality): void {
    this.defaultMachineQuality = quality
    this.notifyStateChanged()
  }
  setDefaultModuleQuality(quality: Quality): void {
    for (const moduleSpec of this.spec.values()) {
      for (let index = 0; index < moduleSpec.moduleQualities.length; index++) {
        if (!moduleSpec.moduleQualityOverrides.has(index)) moduleSpec.moduleQualities[index] = quality
      }
      for (let index = 0; index < moduleSpec.beaconModuleQualities.length; index++) {
        if (!moduleSpec.beaconModuleQualityOverrides.has(index)) moduleSpec.beaconModuleQualities[index] = quality
      }
    }
    this.defaultModuleQuality = quality
    this.notifyStateChanged()
  }
  setDefaultBeaconQuality(quality: Quality): void {
    for (const moduleSpec of this.spec.values()) {
      if (!moduleSpec.beaconQualityOverride) moduleSpec.beaconQuality = quality
    }
    this.defaultBeaconQuality = quality
    this.notifyStateChanged()
  }
  applyFullLegendaryQuality(): boolean {
    const legendary = this.qualities.get("legendary")
    if (legendary === undefined) return false

    const qualityLevel = this.getQualityIndex(legendary)
    this.setMaxQualityLevel(qualityLevel)
    this.defaultMachineQuality = legendary
    this.defaultModuleQuality = legendary
    this.defaultBeaconQuality = legendary
    this.qualityPlannerModuleQuality = legendary
    this.qualityPlannerProductivityModuleQuality = legendary
    this.machineQualityOverrides.clear()

    for (const target of this.buildTargets) {
      const currentRate = target.getRate()
      target.setQuality(qualityLevel)
      target.setQualityStrategy("auto", currentRate)
    }

    for (const moduleSpec of this.spec.values()) {
      moduleSpec.moduleQualities.fill(legendary)
      moduleSpec.moduleQualityOverrides.clear()
      moduleSpec.beaconModuleQualities.fill(legendary)
      moduleSpec.beaconModuleQualityOverrides.clear()
      moduleSpec.beaconQuality = legendary
      moduleSpec.beaconQualityOverride = false
    }
    return true
  }
  setBuildingOverride(recipe: Recipe, building: Building | null, source: ConfigurationSource = "user"): boolean {
    if (building !== null && (!buildingCanCraft(building, recipe) || !this.isBuildingAvailable(building, recipe))) {
      return false
    }

    if (building === null) {
      this.buildingOverrides.delete(recipe)
      this.buildingOverrideSources.delete(recipe)
    } else {
      this.buildingOverrides.set(recipe, building)
      this.buildingOverrideSources.set(recipe, source)
    }

    let moduleSpec = this.spec.get(recipe)
    let selectedBuilding = this.getBuilding(recipe)
    if (moduleSpec !== undefined && selectedBuilding !== null && moduleSpec.building !== selectedBuilding) {
      moduleSpec.setBuilding(selectedBuilding, this)
    }
    if (source === "user") this.notifyRecipeConfigurationChanged(recipe)
    else this.recordRecipeConfigurationChange(recipe)
    return true
  }
  recordRecipeConfigurationChange(recipe: Recipe): void {
    this.recipeConfigurationRevisions.set(recipe, (this.recipeConfigurationRevisions.get(recipe) ?? 0) + 1)
  }
  notifyRecipeConfigurationChanged(recipe: Recipe): void {
    this.recordRecipeConfigurationChange(recipe)
    for (const target of this.buildTargets) {
      if (target.recipe === recipe) {
        target.invalidateQualityUndo?.(recipe)
      }
    }
  }
  captureRecipeConfiguration(recipe: Recipe): RecipeConfigurationSnapshot {
    const moduleSpec = this.spec.get(recipe)
    return {
      hasBuildingOverride: this.buildingOverrides.has(recipe),
      buildingOverride: this.buildingOverrides.get(recipe) ?? null,
      buildingOverrideSource: this.getBuildingOverrideSource(recipe),
      machineQualityOverride: this.machineQualityOverrides.get(this.getMachineQualityRecipe(recipe)) ?? null,
      revision: this.getRecipeConfigurationRevision(recipe),
      moduleSpec:
        moduleSpec === undefined
          ? null
          : {
              object: moduleSpec,
              building: moduleSpec.building,
              modules: [...moduleSpec.modules],
              moduleQualities: [...moduleSpec.moduleQualities],
              moduleQualityOverrides: [...moduleSpec.moduleQualityOverrides],
              moduleSource: moduleSpec.moduleSource,
              beaconModules: [...moduleSpec.beaconModules],
              beaconModuleQualities: [...moduleSpec.beaconModuleQualities],
              beaconModuleQualityOverrides: [...moduleSpec.beaconModuleQualityOverrides],
              beaconQuality: moduleSpec.beaconQuality,
              beaconQualityOverride: moduleSpec.beaconQualityOverride,
              beaconCount: moduleSpec.beaconCount,
            },
    }
  }
  restoreRecipeConfiguration(recipe: Recipe, snapshot: RecipeConfigurationSnapshot): void {
    const qualityRecipe = this.getMachineQualityRecipe(recipe)
    if (snapshot.machineQualityOverride === null) this.machineQualityOverrides.delete(qualityRecipe)
    else this.machineQualityOverrides.set(qualityRecipe, snapshot.machineQualityOverride)
    if (snapshot.hasBuildingOverride) {
      if (snapshot.buildingOverride === null) throw new Error("Invalid building override snapshot")
      this.buildingOverrides.set(recipe, snapshot.buildingOverride)
      this.buildingOverrideSources.set(recipe, snapshot.buildingOverrideSource)
    } else {
      this.buildingOverrides.delete(recipe)
      this.buildingOverrideSources.delete(recipe)
    }

    if (snapshot.moduleSpec === null) {
      this.spec.delete(recipe)
      return
    }

    const moduleSpec = snapshot.moduleSpec.object
    moduleSpec.building = snapshot.moduleSpec.building
    moduleSpec.modules.splice(0, moduleSpec.modules.length, ...snapshot.moduleSpec.modules)
    moduleSpec.moduleQualities.splice(0, moduleSpec.moduleQualities.length, ...snapshot.moduleSpec.moduleQualities)
    moduleSpec.moduleQualityOverrides.clear()
    for (const index of snapshot.moduleSpec.moduleQualityOverrides) moduleSpec.moduleQualityOverrides.add(index)
    moduleSpec.moduleSource = snapshot.moduleSpec.moduleSource
    moduleSpec.beaconModules.splice(0, moduleSpec.beaconModules.length, ...snapshot.moduleSpec.beaconModules)
    moduleSpec.beaconModuleQualities.splice(
      0,
      moduleSpec.beaconModuleQualities.length,
      ...snapshot.moduleSpec.beaconModuleQualities,
    )
    moduleSpec.beaconModuleQualityOverrides.clear()
    for (const index of snapshot.moduleSpec.beaconModuleQualityOverrides) {
      moduleSpec.beaconModuleQualityOverrides.add(index)
    }
    moduleSpec.beaconQuality = snapshot.moduleSpec.beaconQuality
    moduleSpec.beaconQualityOverride = snapshot.moduleSpec.beaconQualityOverride
    moduleSpec.beaconCount = snapshot.moduleSpec.beaconCount
    this.spec.set(recipe, moduleSpec)
  }
  getRecipeConfigurationFingerprint(recipe: Recipe): string {
    const moduleSpec = this.spec.get(recipe)
    const moduleKey = (module: Module | Building | null | undefined): string | null =>
      module === null || module === undefined ? null : module.key
    return JSON.stringify({
      buildingOverride: this.buildingOverrides.has(recipe) ? (this.buildingOverrides.get(recipe)?.key ?? null) : null,
      buildingOverrideSource: this.getBuildingOverrideSource(recipe),
      machineQuality: this.getMachineQuality(recipe).key,
      moduleBuilding: moduleKey(moduleSpec?.building),
      modules: moduleSpec?.modules?.map(moduleKey) ?? null,
      moduleQualities: moduleSpec?.moduleQualities.map((quality) => quality.key) ?? null,
      moduleQualityOverrides:
        moduleSpec === undefined ? null : [...moduleSpec.moduleQualityOverrides].sort((a, b) => a - b),
      moduleSource: moduleSpec?.moduleSource ?? "default",
      beaconModules: moduleSpec?.beaconModules?.map(moduleKey) ?? null,
      beaconModuleQualities: moduleSpec?.beaconModuleQualities.map((quality) => quality.key) ?? null,
      beaconModuleQualityOverrides:
        moduleSpec === undefined ? null : [...moduleSpec.beaconModuleQualityOverrides].sort((a, b) => a - b),
      beaconQuality: moduleSpec?.beaconQuality.key ?? null,
      beaconQualityOverride: moduleSpec?.beaconQualityOverride ?? false,
      beaconCount: moduleSpec?.beaconCount?.toString() ?? null,
    })
  }
  getRecipeConfigurationRevision(recipe: Recipe): number {
    return this.recipeConfigurationRevisions.get(recipe) ?? 0
  }
  applyQualityTargetConfiguration(recipe: Recipe, recommendation: QualityTargetFeasibility): boolean {
    if (recommendation?.status !== "auto-configurable") return false
    const { building, module, slotCount } = recommendation
    if (!this.setBuildingOverride(recipe, building, "automatic-quality")) return false
    const moduleSpec = this.getModuleSpec(recipe)
    if (moduleSpec === null || moduleSpec.building !== building || !module.canUse(recipe, building)) return false
    for (let index = 0; index < slotCount; index++) {
      if (!moduleSpec.setModule(index, module, "automatic-quality")) {
        // setModule returns false when an effect-neutral module is selected;
        // the assignment is still valid, so only reject an unavailable slot.
        if (moduleSpec.getModule(index) !== module) return false
      }
    }
    moduleSpec.moduleSource = "automatic-quality"
    return true
  }
  getBuildingGroup(building: Building): BuildingGroup {
    const category = building.categories.values().next().value
    const group = category === undefined ? undefined : this.buildings.get(category)
    if (group === undefined) throw new Error(`No building group found for ${building.key}`)
    return group
  }
  setMinimumBuilding(building: Building): void {
    let group = this.getBuildingGroup(building)
    group.building = building
    group.selectedBuildings = new Set([building])
    this.updateBuildingGroup(group)
  }
  setAutomaticBuildingPreferences(buildings: readonly Building[]): void {
    const selections = new Map<BuildingGroup, Building[]>()
    for (let building of buildings) {
      let group = this.getBuildingGroup(building)
      let selected = selections.get(group)
      if (selected === undefined) {
        selected = []
        selections.set(group, selected)
      }
      selected.push(building)
    }

    for (const group of new Set<BuildingGroup>(this.buildings.values())) {
      const selected = selections.get(group) ?? group.getDefaults()
      const minimum = selected[0]
      if (minimum === undefined) continue
      this.setMinimumBuilding(minimum)
      for (let building of selected.slice(1)) {
        this.setAutomaticBuildingEnabled(building, true)
      }
    }
  }
  resetAutomaticBuildingPreferences(): void {
    this.setAutomaticBuildingPreferences([])
  }
  clearBuildingOverrides(): void {
    for (let recipe of [...this.buildingOverrides.keys()]) {
      this.setBuildingOverride(recipe, null)
    }
  }
  setAutomaticBuildingEnabled(building: Building, enabled: boolean): boolean {
    let group = this.getBuildingGroup(building)
    if (enabled) {
      group.selectedBuildings.add(building)
    } else if (group.selectedBuildings.size === 1) {
      return false
    } else {
      group.selectedBuildings.delete(building)
    }
    this.updateBuildingGroup(group)
    return true
  }
  isAutomaticBuildingEnabled(building: Building): boolean {
    return this.getBuildingGroup(building).selectedBuildings.has(building)
  }
  updateBuildingGroup(group: BuildingGroup): void {
    for (let [recipe, moduleSpec] of this.spec) {
      let g = null
      for (let category of getCategories(recipe)) {
        g = this.buildings.get(category)
        if (g !== undefined) {
          break
        }
      }
      if (group === g && !this.buildingOverrides.has(recipe)) {
        let b = this.getBuilding(recipe)
        if (b !== null) {
          moduleSpec.setBuilding(b, this)
        }
      }
    }
  }
  initModuleSpec(recipe: Recipe, building: Building | null): ModuleSpec | null {
    if (!this.spec.has(recipe) && building !== null && building.canBeacon()) {
      const moduleSpec = new ModuleSpec(recipe, this)
      moduleSpec.setBuilding(building, this)
      this.spec.set(recipe, moduleSpec)
      return moduleSpec
    }
    return null
  }
  populateModuleSpec(totals: Totals): void {
    for (const recipe of totals.rates.keys()) {
      if (!(recipe instanceof Recipe)) continue
      const building = this.getBuilding(recipe)
      this.initModuleSpec(recipe, building)
    }
  }
  getModuleSpec(recipe: Recipe): ModuleSpec | null {
    let building = this.getBuilding(recipe)
    let m = this.spec.get(recipe)
    if (m === undefined) {
      return this.initModuleSpec(recipe, building)
    }
    if (building !== null && m.building !== building) {
      m.setBuilding(building, this)
    }
    return m
  }
  getProdEffect(recipe: Recipe): Rational {
    let m = this.getModuleSpec(recipe)
    const effect = m === null ? one : m.prodEffect(this)
    let bonus = effect.sub(one).add(this.getRecipeProductivityBonus(recipe))
    if (recipe.maximumProductivity != null) {
      bonus = Rational.min(bonus, recipe.maximumProductivity)
    }
    return one.add(bonus)
  }
  getRecipeProductivityLevel(researchKey: string): number {
    return this.recipeProductivityLevels.get(researchKey) ?? 0
  }
  setRecipeProductivityLevel(researchKey: string, level: number): boolean {
    if (!this.recipeProductivityResearch.has(researchKey)) {
      return false
    }
    let normalizedLevel = Number.isFinite(level) ? Math.max(0, level) : 0
    if (normalizedLevel === 0) {
      this.recipeProductivityLevels.delete(researchKey)
    } else {
      this.recipeProductivityLevels.set(researchKey, normalizedLevel)
    }
    return true
  }
  getRecipeProductivityBonus(recipe: Recipe): Rational {
    let bonus = zero
    for (let effect of this.recipeProductivityEffects.get(recipe) ?? []) {
      let level = this.getRecipeProductivityLevel(effect.researchKey)
      bonus = bonus.add(effect.change.mul(Rational.from_float_approximate(level)))
    }
    return bonus
  }
  setDefaultModule(module: Module | null): void {
    for (let [recipe, moduleSpec] of this.spec) {
      if (moduleSpec.moduleSource !== "default") continue
      let changed = false
      for (let i = 0; i < moduleSpec.modules.length; i++) {
        if (moduleSpec.modules[i] !== this.defaultModule) {
          continue
        }
        if (module === null || module.canUse(recipe, moduleSpec.building)) {
          moduleSpec.modules[i] = module
          changed = true
        } else if (
          this.secondaryDefaultModule === null ||
          this.secondaryDefaultModule.canUse(recipe, moduleSpec.building)
        ) {
          moduleSpec.modules[i] = this.secondaryDefaultModule
          changed = true
        } else {
          moduleSpec.modules[i] = null
          changed = true
        }
      }
      if (changed) this.notifyRecipeConfigurationChanged(recipe)
    }
    this.defaultModule = module
  }
  setSecondaryDefaultModule(module: Module | null): void {
    if (this.secondaryDefaultModule !== this.defaultModule) {
      for (let [recipe, moduleSpec] of this.spec) {
        if (moduleSpec.moduleSource !== "default") continue
        let changed = false
        for (let i = 0; i < moduleSpec.modules.length; i++) {
          let m = moduleSpec.modules[i]
          if (m === this.secondaryDefaultModule) {
            moduleSpec.modules[i] = !module || module.canUse(recipe, moduleSpec.building) ? module : null
            changed = true
          }
        }
        if (changed) this.notifyRecipeConfigurationChanged(recipe)
      }
    }
    this.secondaryDefaultModule = module
  }
  // Gets the default module for this recipe, given the current
  // default/secondary settings.
  getDefaultModule(recipe: Recipe, building: Building | null = this.getBuilding(recipe)): Module | null {
    if (this.defaultModule === null || this.defaultModule.canUse(recipe, building)) {
      return this.defaultModule
    }
    if (this.secondaryDefaultModule === null || this.secondaryDefaultModule.canUse(recipe, building)) {
      return this.secondaryDefaultModule
    }
    return null
  }
  isDefaultDefaultBeacon(): boolean {
    return this.defaultBeacon[0] === null && this.defaultBeacon[1] === null
  }
  setDefaultBeacon(module: Module | null, i: number): void {
    let compatibleModule = module === null || module.canBeacon() ? module : null
    for (let moduleSpec of this.spec.values()) {
      let currentModule = moduleSpec.beaconModules[i]
      if (currentModule === this.defaultBeacon[i]) {
        moduleSpec.beaconModules[i] =
          compatibleModule === null || compatibleModule.canUse(moduleSpec.recipe, moduleSpec.building)
            ? compatibleModule
            : null
      }
    }
    this.defaultBeacon[i] = compatibleModule
  }
  setDefaultBeaconCount(count: Rational): void {
    for (let [recipe, moduleSpec] of this.spec) {
      if (moduleSpec.beaconCount.equal(this.defaultBeaconCount)) {
        moduleSpec.beaconCount = count
      }
    }
    this.defaultBeaconCount = count
  }
  // Returns the recipe-rate at which a single building can produce a recipe.
  // Returns null for recipes that do not have a building.
  getRecipeRate(recipe: Recipe): Rational | null {
    let building = this.getBuilding(recipe)
    if (building === null) {
      return null
    }
    return building.getRecipeRate(this, recipe)
  }
  setMiner(recipe: Recipe, miner: Miner, purity: Rational): void {
    this.minerSettings.set(recipe, { miner, purity })
  }
  getCount(recipe: Recipe, rate: Rational): Rational {
    let building = this.getBuilding(recipe)
    if (building === null) {
      return zero
    }
    return building.getCount(this, recipe, rate)
  }
  getResourceYield(recipe: Recipe): Rational {
    return this.resourceYields.get(recipe) ?? one
  }
  setResourceYield(recipe: Recipe, value: Rational): void {
    this.resourceYields.set(recipe, Rational.max(Rational.from_floats(1, 100), value))
  }
  setRecipeLocation(recipe: Recipe, location: Planet | null): void {
    if (location === null) this.recipeLocations.delete(recipe)
    else this.recipeLocations.set(recipe, location)
  }
  getBeltStackPolicy(item: Item): BeltStackPolicy {
    return this.beltStackOverrides.get(item) ?? this.beltStackDefaultPolicy
  }
  getBeltStackPolicySource(item: Item): "default" | "override" {
    return this.beltStackOverrides.has(item) ? "override" : "default"
  }
  setBeltStackOverride(item: Item, policy: BeltStackPolicy | null): void {
    if (policy === null) this.beltStackOverrides.delete(item)
    else this.beltStackOverrides.set(item, policy)
  }
  isItemAutomaticallyBeltStacked(item: Item, recipe: Recipe | null = null): boolean {
    if (recipe !== null) return this.getBuilding(recipe)?.dropsFullBeltStacks ?? false
    const producers = this.lastTotals?.producers.get(item)
    if (producers === undefined || producers.size === 0) return false
    for (const producer of producers.keys()) {
      if (!(producer instanceof Recipe) || !(this.getBuilding(producer)?.dropsFullBeltStacks ?? false)) return false
    }
    return true
  }
  getEffectiveBeltStackSize(item: Item, recipe: Recipe | null = null): Rational {
    const policy = this.getBeltStackPolicy(item)
    if (policy === "stacked" || (policy === "auto" && this.isItemAutomaticallyBeltStacked(item, recipe))) {
      return this.beltStackSize
    }
    return one
  }
  getBeltCount(item: Item, rate: Rational, recipe: Recipe | null = null): Rational {
    if (this.belt === null) throw new Error("No transport belt is selected")
    return rate.div(this.belt.rate.mul(this.getEffectiveBeltStackSize(item, recipe)))
  }
  getRateForBeltCount(item: Item, beltCount: Rational, recipe: Recipe | null = null): Rational {
    if (this.belt === null) throw new Error("No transport belt is selected")
    return this.belt.rate.mul(this.getEffectiveBeltStackSize(item, recipe)).mul(beltCount)
  }
  getFuelForBuilding(building: Building | null): Fuel | null {
    if (building === null || building.fuel === null || this.fuels === null) {
      return null
    }
    let fuel = this.fuels.getForCategory(building.fuel, this.fuel)
    if (fuel === null) {
      throw new Error(`No fuel item is available for the ${building.fuel} fuel category`)
    }
    return fuel
  }
  getFuelForRecipe(recipe: Recipe): Fuel | null {
    return this.getFuelForBuilding(this.getBuilding(recipe))
  }
  getPowerUsage(recipe: Recipe, rate: Rational): { fuel: string | null; power: Rational } {
    let building = this.getBuilding(recipe)
    if (building === null) {
      return { fuel: null, power: zero }
    }
    let count = this.getCount(recipe, rate)
    let modules = this.getModuleSpec(recipe)
    let powerEffect
    if (modules) {
      powerEffect = modules.powerEffect(this)
    } else {
      powerEffect = one
    }
    const quality = this.getMachineQuality(recipe)
    let power = building.powerForQuality(quality).mul(count).mul(powerEffect)
    if (building.fuel !== null) {
      return { fuel: building.fuel, power }
    }
    power = power.add(building.drainForQuality(quality).mul(count.ceil()))
    return { fuel: "electric", power: power }
  }
  addTarget(itemKey = DEFAULT_ITEM_KEY): FactoryBuildTarget {
    const item = this.items.get(itemKey)
    if (item === undefined) throw new Error(`Unknown target item: ${itemKey}`)
    if (this.view === null) {
      throw new Error("Build targets require a configured FactoryViewPort")
    }
    let target = this.view.createBuildTarget(this.buildTargets.length, itemKey, item, this.itemGroups)
    this.buildTargets.push(target)
    this.view.mountBuildTarget(target)
    return target
  }
  removeTarget(target: FactoryBuildTarget): void {
    this.buildTargets.splice(target.index, 1)
    for (let i = target.index; i < this.buildTargets.length; i++) {
      const current = this.buildTargets[i]
      if (current !== undefined) current.index--
    }
    this.view?.removeBuildTarget(target)
  }
  toggleIgnore(item: Item): void {
    let updateTargets = false
    if (this.ignore.has(item)) {
      this.ignore.delete(item)
      if (!this.isItemDisabled(item)) {
        this.priority.removeRecipe(item.disableRecipe)
        updateTargets = true
      }
    } else {
      this.ignore.add(item)
      if (!this.isItemDisabled(item)) {
        let level = this.priority.getFirstLevel()
        let makeNew = level === null
        for (const r of level ?? []) {
          if (r.recipe.isDisable()) {
            makeNew = false
            break
          }
        }
        if (makeNew || level === null) level = this.priority.addPriorityBefore(level)
        const hundred = Rational.from_float(100)
        this.priority.addRecipe(item.disableRecipe, hundred, level)
        updateTargets = true
      }
    }
    if (updateTargets) {
      // Update build targets.
      for (let target of this.buildTargets) {
        if (target.item === item) {
          target.displayRecipes()
          target.rateChanged()
        }
      }
    }
  }
  private createSolverSpec(): SolverSpec {
    const owner = this
    const targets: SolverTarget[] = this.buildTargets.map((target) => ({
      item: target.item,
      recipe: target.recipe,
      changedBuilding: target.changedBuilding,
    }))
    return {
      ignore: new Set<SolverItem>(this.ignore),
      buildTargets: targets,
      priority: this.priority,
      getRecipes(item: SolverItem): SolverRecipe[] {
        if (!(item instanceof Item)) throw new Error("Solver received an unknown item model")
        return [...owner.getRecipes(item)]
      },
      getRecipeGraph(items: Map<SolverItem, Rational>): Set<SolverRecipe> {
        const domainItems = new Map<Item, Rational>()
        for (const [item, rate] of items) {
          if (!(item instanceof Item)) throw new Error("Solver graph contains an unknown item model")
          domainItems.set(item, rate)
        }
        return new Set<SolverRecipe>(owner.getRecipeGraph(domainItems))
      },
      getProdEffect(recipe: SolverRecipe): Rational {
        return recipe instanceof Recipe ? owner.getProdEffect(recipe) : one
      },
      getBuilding(recipe: SolverRecipe) {
        return recipe instanceof Recipe ? owner.getBuilding(recipe) : null
      },
      getFuelForRecipe(recipe: SolverRecipe) {
        return recipe instanceof Recipe ? owner.getFuelForRecipe(recipe) : null
      },
    }
  }

  solve(): Totals {
    const outputs: SolverOutput[] = []
    this.qualityPlans.splice(0, this.qualityPlans.length)
    for (const target of this.buildTargets) {
      const item = target.item
      let rate = target.getRate()
      let recipe: Recipe | null = target.changedBuilding ? target.recipe : null
      if (target.qualityLevel > 0) {
        const qualityRecipe =
          target.recipe ?? this.getRecipes(item).find((candidate) => candidate instanceof Recipe) ?? null
        if (qualityRecipe === null) {
          throw new Error(`No recipe is available to produce ${item.name} at the selected quality.`)
        }
        const vulcanus = this.planets?.get("vulcanus") ?? null
        const onlySelectedPlanet = this.selectedPlanets.size === 1 ? ([...this.selectedPlanets][0] ?? null) : null
        const automaticPlanet =
          onlySelectedPlanet ??
          this.recipeLocations.get(qualityRecipe) ??
          (vulcanus !== null && this.selectedPlanets.has(vulcanus) ? vulcanus : null)
        if (target.qualityStrategy === "direct") {
          rate = rate.mul(getQualityTargetMultiplier(this, qualityRecipe, target.qualityLevel))
          recipe = qualityRecipe
        } else {
          if (automaticPlanet === null) {
            throw new Error(
              `Automatic quality planning for ${item.name} requires one selected planet or an assigned recipe location.`,
            )
          }
          const plan =
            automaticPlanet.key === "vulcanus"
              ? planVulcanusQualityTarget({
                  specification: this,
                  item,
                  recipe: qualityRecipe,
                  requested: rate,
                  qualityLevel: target.qualityLevel,
                })
              : planPlanetQualityTarget({
                  specification: this,
                  planet: automaticPlanet,
                  item,
                  recipe: qualityRecipe,
                  requested: rate,
                  qualityLevel: target.qualityLevel,
                })
          this.qualityPlans.push(plan)
          continue
        }
      }
      outputs.push({ item, rate, recipe })
    }

    const dedupedOutputs: SolverOutput[] = []
    outer: for (const output of outputs) {
      for (let index = 0; index < dedupedOutputs.length; index++) {
        const existing = dedupedOutputs[index]
        if (existing !== undefined && existing.recipe === output.recipe && existing.item === output.item) {
          dedupedOutputs[index] = { ...existing, rate: existing.rate.add(output.rate) }
          continue outer
        }
      }
      dedupedOutputs.push(output)
    }
    const solverSpec = this.createSolverSpec()
    return dedupedOutputs.length === 0
      ? new Totals(solverSpec, new Map(), new Map(), new Map(), new Map())
      : solve(solverSpec, dedupedOutputs)
  }
  persistUrlState(): void {
    this.view?.persistUrlState()
  }
  // Backward-compatible name used by existing event handlers.
  setHash(): void {
    this.persistUrlState()
  }
  // The top-level calculation function. Called whenever the solution
  // requires recalculation.
  updateSolution(): void {
    if (this.deferForQualityGraphOptimizer()) return
    try {
      this.lastTotals = this.solve()
      this.lastError = null
      this.populateModuleSpec(this.lastTotals)
      this.display()
    } catch (error) {
      this.lastTotals = null
      this.lastError = error
      this.view?.renderCalculationError(this, error)
      this.persistUrlState()
      this.notifyStateChanged()
    }
  }
  // Re-renders the current solution, without re-computing it.
  //
  // This is useful for when settings can be applied without altering the
  // solution. In general, if something would alter recipe-rate ratios, then
  // it requires a new solution. If it only alters building counts (e.g.
  // from changing the speed of a building), then we need merely re-display
  // the existing solution.
  display(): void {
    // Update build target text boxes, if needed.
    for (let target of this.buildTargets) {
      target.getRate()
    }
    if (this.lastTotals === null) {
      if (this.lastError !== null) {
        this.view?.renderCalculationError(this, this.lastError)
      }
    } else {
      this.view?.renderSolution(this, this.lastTotals)
    }
    this.persistUrlState()

    this.notifyStateChanged()
  }
}

// Factory store

let configuredView: FactoryViewPort | null = null

export let spec = new FactorySpecification()

export function configureFactoryView(view: FactoryViewPort) {
  configuredView = view
  spec.view = view
}

export function resetSpec() {
  spec = new FactorySpecification(configuredView)
  return spec
}
// endregion factory.ts

// region application/contracts.ts
export type CalculatorTab = "totals" | "graph" | "settings" | "resources" | "help"
export type FactoryDensity = "comfortable" | "compact"
export type ProgressionPreset = "early" | "pre-rocket" | "first-planets" | "late-space-age"
export type QualityPreset = "full-legendary"

const PROGRESSION_PRESET_VALUES: ReadonlySet<string> = new Set([
  "early",
  "pre-rocket",
  "first-planets",
  "late-space-age",
])

export function isProgressionPreset(value: string): value is ProgressionPreset {
  return PROGRESSION_PRESET_VALUES.has(value)
}

export function isQualityPreset(value: string): value is QualityPreset {
  return value === "full-legendary"
}
export type CalculationStatus = "loading" | "ready" | "error"

export interface PlanningSettingValue {
  readonly id: string
  readonly value: string
  readonly resourceKey: string | undefined
  readonly itemKey: string | undefined
}

export interface TargetSnapshot {
  readonly index: number
  readonly itemKey: string
  readonly itemName: string
  readonly recipeKey: string | null
  readonly recipeName: string | null
  readonly buildings: string
  readonly rate: string
  readonly qualityLevel: number
  readonly qualityStrategy: QualityStrategy
}

export interface CalculatorSettingsSnapshot {
  readonly displayRate: DisplayRate
  readonly ratePrecision: number
  readonly countPrecision: number
  readonly displayFormat: DisplayFormat
  readonly miningProductivityPercent: string
  readonly beltStackSize: string
  readonly beltStackDefaultPolicy: "auto" | "stacked" | "unstacked"
  readonly bufferMinutes: string
  readonly freshnessDelayMinutes: string
  readonly maxQualityLevel: number
  readonly equipmentQualityAvailable: boolean
  readonly qualityPlannerObjective: QualityPlannerObjective
  readonly visualizationType: string
  readonly visualizationRender: string
  readonly visualizationDirection: string
}

export interface CalculatorSnapshot {
  readonly revision: number
  readonly datasetKey: string
  readonly activeTab: CalculatorTab
  readonly factoryDensity: FactoryDensity
  readonly title: string
  readonly status: CalculationStatus
  readonly errorMessage: string | null
  readonly targets: readonly TargetSnapshot[]
  readonly settings: CalculatorSettingsSnapshot
}

export interface CalculatorCommands {
  addTarget(itemKey?: string): void
  removeTarget(index: number): void
  selectTab(tab: CalculatorTab): void
  openVisualization(): void
  copyShareLink(): Promise<void>
  applyProgressionPreset(value: ProgressionPreset): void
  applyQualityPreset(value: QualityPreset): void
  setFactoryDensity(value: FactoryDensity): void
  setTitle(value: string): void
  setRatePrecision(value: number): void
  setCountPrecision(value: number): void
  setDisplayFormat(value: DisplayFormat): void
  setMiningProductivityPercent(value: string): void
  setPlanningSetting(input: PlanningSettingValue): void
  setVisualizationType(value: string): void
  setVisualizationRender(value: string): void
  setVisualizationDirection(value: string): void
  recalculate(): void
}

export interface CalculatorBrowserPort {
  readDatasetKey(): string
  readTitle(): string
}

export interface CalculatorStore {
  getSnapshot(): CalculatorSnapshot
  subscribe(listener: () => void): () => void
  start(): void
  dispose(): void
  readonly commands: CalculatorCommands
}
// endregion application/contracts.ts

// region state.ts
// Document title

export const DEFAULT_TITLE = "Factorio Calculator"

export function setTitle(title: string) {
  document.title = title === "" ? DEFAULT_TITLE : title
}

const FACTORY_DENSITY_STORAGE_KEY = "factorio-calculator-factory-density"
const DEFAULT_FACTORY_DENSITY: FactoryDensity = "compact"

export let factoryDensity: FactoryDensity = DEFAULT_FACTORY_DENSITY

function isFactoryDensity(value: string | null): value is FactoryDensity {
  return value === "comfortable" || value === "compact"
}

export function setFactoryDensity(value: FactoryDensity): void {
  factoryDensity = value
  document.documentElement.dataset.factoryDensity = value
  document.querySelectorAll<HTMLInputElement>('input[name="factory_density"]').forEach((input) => {
    input.checked = input.value === value
  })
  try {
    window.localStorage.setItem(FACTORY_DENSITY_STORAGE_KEY, value)
  } catch {
    // Storage may be disabled. The selected density still applies immediately.
  }
}

export function initializeFactoryDensity() {
  let storedDensity: string | null = null
  try {
    storedDensity = window.localStorage.getItem(FACTORY_DENSITY_STORAGE_KEY)
  } catch {
    // Storage may be disabled. The control still works for the current page.
  }
  setFactoryDensity(isFactoryDensity(storedDensity) ? storedDensity : DEFAULT_FACTORY_DENSITY)
}

export function changeFactoryDensity(event: Event) {
  let input = event.target
  if (!(input instanceof HTMLInputElement) || !isFactoryDensity(input.value)) {
    return
  }
  setFactoryDensity(input.value)
}

type PresetDefinition = {
  miningProductivity: number
  recipeProductivityLevel: number
  belt: string
  beltStackSize: number
  maxQualityLevel: number
  defaultMachines: string[]
}

const RECIPE_PRODUCTIVITY_RESEARCH_KEYS = [
  "asteroid-productivity",
  "low-density-structure-productivity",
  "plastic-bar-productivity",
  "processing-unit-productivity",
  "rocket-fuel-productivity",
  "rocket-part-productivity",
  "scrap-recycling-productivity",
  "steel-plate-productivity",
] as const

const PROGRESSION_PRESETS: Record<ProgressionPreset, PresetDefinition> = {
  early: {
    miningProductivity: 0,
    recipeProductivityLevel: 0,
    belt: "transport-belt",
    beltStackSize: 1,
    maxQualityLevel: 0,
    defaultMachines: ["assembling-machine-1", "chemical-plant", "stone-furnace", "electric-mining-drill"],
  },
  "pre-rocket": {
    miningProductivity: 20,
    recipeProductivityLevel: 0,
    belt: "fast-transport-belt",
    beltStackSize: 1,
    maxQualityLevel: 2,
    defaultMachines: ["assembling-machine-2", "chemical-plant", "steel-furnace", "electric-mining-drill"],
  },
  "first-planets": {
    miningProductivity: 30,
    recipeProductivityLevel: 0,
    belt: "express-transport-belt",
    beltStackSize: 1,
    maxQualityLevel: 2,
    defaultMachines: ["assembling-machine-3", "chemical-plant", "electric-furnace", "electric-mining-drill"],
  },
  "late-space-age": {
    miningProductivity: 100,
    recipeProductivityLevel: 10,
    belt: "express-transport-belt",
    beltStackSize: 4,
    maxQualityLevel: 4,
    defaultMachines: [
      "assembling-machine-3",
      "chemical-plant",
      "foundry",
      "electromagnetic-plant",
      "biochamber",
      "cryogenic-plant",
      "electric-furnace",
      "big-mining-drill",
    ],
  },
}

function getByKey<TKey, TValue>(collection: ReadonlyMap<TKey, TValue> | null, key: TKey | null): TValue | null {
  if (collection === null || key === null) return null
  return collection.get(key) ?? null
}

function getBoundDatum(element: Element): unknown {
  return (element as Element & { readonly __data__?: unknown }).__data__
}

function getEventInput(event: Event): HTMLInputElement | null {
  return event.target instanceof HTMLInputElement ? event.target : null
}

function getEventSelect(event: Event): HTMLSelectElement | null {
  return event.target instanceof HTMLSelectElement ? event.target : null
}

function getEventControl(event: Event): HTMLInputElement | HTMLSelectElement | null {
  return event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement ? event.target : null
}

function syncPresetControls(): void {
  document.querySelectorAll<HTMLInputElement>('#belt_selector input[type="radio"]').forEach((input) => {
    input.checked = input.value === spec.belt?.key
  })

  let beltStack = document.getElementById("belt_stack_size") as HTMLSelectElement | null
  if (beltStack !== null) beltStack.value = spec.beltStackSize.toString()
  let beltStackPolicy = document.getElementById("belt_stack_default_policy") as HTMLSelectElement | null
  if (beltStackPolicy !== null) beltStackPolicy.value = spec.beltStackDefaultPolicy
  let maxQuality = document.getElementById("max_quality") as HTMLSelectElement | null
  if (maxQuality !== null) maxQuality.value = String(spec.maxQualityLevel)
  const qualityDefaults = [
    ["default_machine_quality", spec.defaultMachineQuality],
    ["default_module_quality", spec.defaultModuleQuality],
    ["default_beacon_quality", spec.defaultBeaconQuality],
    ["quality_planner_module_quality", spec.qualityPlannerModuleQuality],
    ["quality_planner_productivity_module_quality", spec.qualityPlannerProductivityModuleQuality],
  ] as const
  for (const [containerId, selected] of qualityDefaults) {
    const input = document.querySelector<HTMLSelectElement>(`#${containerId} select`)
    if (input === null) continue
    input.replaceChildren(
      ...spec
        .getAvailableQualities()
        .map((quality) => new Option(quality.name, quality.key, false, quality === selected)),
    )
  }

  document.querySelectorAll<HTMLInputElement>('#building_selector input[type="checkbox"]').forEach((input) => {
    const building = getBoundDatum(input)
    input.checked = building instanceof Building && spec.isAutomaticBuildingEnabled(building)
  })

  document
    .querySelectorAll<HTMLInputElement>("#recipe_productivity_settings input[data-research-key]")
    .forEach((input) => {
      const researchKey = input.dataset.researchKey
      if (researchKey === undefined) return
      const percentPerLevel = Number(input.dataset.percentPerLevel)
      if (!Number.isFinite(percentPerLevel)) return
      input.value = String(spec.getRecipeProductivityLevel(researchKey) * percentPerLevel)
    })
}

export function applyProgressionPresetValue(value: ProgressionPreset): void {
  const preset = PROGRESSION_PRESETS[value]

  spec.miningProd = Rational.from_float(preset.miningProductivity / 100)
  spec.recipeProductivityLevels.clear()
  for (const researchKey of RECIPE_PRODUCTIVITY_RESEARCH_KEYS) {
    if (spec.recipeProductivityResearch.has(researchKey)) {
      spec.setRecipeProductivityLevel(researchKey, preset.recipeProductivityLevel)
    }
  }
  let belt = getByKey(spec.belts, preset.belt)
  if (belt !== null) spec.belt = belt
  spec.beltStackSize = Rational.from_float(preset.beltStackSize)
  spec.beltStackDefaultPolicy = "auto"
  spec.beltStackOverrides.clear()
  spec.setMaxQualityLevel(preset.maxQualityLevel)
  for (let target of spec.buildTargets) {
    target.setQuality(target.qualityLevel)
  }

  spec.clearBuildingOverrides()
  spec.setAutomaticBuildingPreferences(
    preset.defaultMachines.map((key) => getByKey(spec.buildingKeys, key)).filter((building) => building !== null),
  )

  syncMiningProductivityControls()
  syncPresetControls()
  spec.updateSolution()
}

export function applyQualityPresetValue(value: QualityPreset): void {
  if (value !== "full-legendary" || !spec.applyFullLegendaryQuality()) return
  syncPresetControls()
  spec.updateSolution()
}

export function applyProgressionPreset(event: Event): void {
  const select = event.target
  if (!(select instanceof HTMLSelectElement) || !isProgressionPreset(select.value)) return
  applyProgressionPresetValue(select.value)
}

export function applyQualityPreset(event: Event): void {
  const select = event.target
  if (!(select instanceof HTMLSelectElement) || !isQualityPreset(select.value)) return
  applyQualityPresetValue(select.value)
}

export function setPlanningSetting(input: PlanningSettingValue): void {
  switch (input.id) {
    case "belt_stack_size":
      spec.beltStackSize = Rational.from_string(input.value)
      break
    case "belt_stack_default_policy":
      if (!isBeltStackPolicy(input.value)) return
      spec.beltStackDefaultPolicy = input.value
      break
    case "buffer_minutes":
      spec.bufferMinutes = Rational.max(Rational.from_float(0), Rational.from_string(input.value || "0"))
      break
    case "freshness_delay":
      spec.freshnessDelayMinutes = Rational.max(Rational.from_float(0), Rational.from_string(input.value || "0"))
      break
    case "max_quality":
      spec.setMaxQualityLevel(Number(input.value))
      for (let target of spec.buildTargets) {
        target.setQuality(target.qualityLevel)
      }
      break
    case "quality_planner_objective":
      if (!isQualityPlannerObjective(input.value)) return
      spec.qualityPlannerObjective = input.value
      break
    default: {
      const resourceKey = input.resourceKey
      if (resourceKey) {
        let recipe = spec.recipes.get(resourceKey)
        if (recipe)
          spec.setResourceYield(recipe, Rational.from_string(input.value || "100").div(Rational.from_float(100)))
        break
      }
      const itemKey = input.itemKey
      if (!itemKey) return
      if (input.value === "") spec.asteroidLimits.delete(itemKey)
      else spec.asteroidLimits.set(itemKey, Rational.from_string(input.value).div(spec.format.rateFactor))
    }
  }
  spec.updateSolution()
}

export function changePlanningSetting(event: Event): void {
  const input = getEventControl(event)
  if (input === null) return
  setPlanningSetting({
    id: input.id,
    value: input.value,
    resourceKey: input.dataset.resourceKey,
    itemKey: input.dataset.itemKey,
  })
}

// UI actions

// build target events

export function plusHandler(): void {
  spec.addTarget()
  spec.updateSolution()
}

let shareStatusTimer: ReturnType<typeof setTimeout> | null = null

function setShareStatus(message: string): void {
  let status = document.getElementById("share_status")
  if (status === null) {
    return
  }
  status.textContent = message
  if (shareStatusTimer !== null) {
    clearTimeout(shareStatusTimer)
  }
  shareStatusTimer = setTimeout(() => {
    status.textContent = ""
    shareStatusTimer = null
  }, 2500)
}

function fallbackCopyText(text: string): void {
  let input = document.createElement("textarea")
  input.value = text
  input.setAttribute("readonly", "")
  input.style.position = "fixed"
  input.style.opacity = "0"
  document.body.appendChild(input)
  input.select()
  let copied = document.execCommand("copy")
  input.remove()
  if (!copied) {
    throw new Error("The browser did not allow clipboard access.")
  }
}

export async function copyShareLink(): Promise<void> {
  spec.persistUrlState()
  let url = window.location.href
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
    } else {
      fallbackCopyText(url)
    }
    setShareStatus("Plan link copied.")
  } catch {
    setShareStatus("Could not copy automatically. Copy the URL from the address bar.")
  }
}

export const DEFAULT_TAB: CalculatorTab = "totals"

export let currentTab: CalculatorTab = DEFAULT_TAB

function isCalculatorTab(value: string): value is CalculatorTab {
  return value === "totals" || value === "graph" || value === "settings" || value === "resources" || value === "help"
}

let onDeferredTabOpened: (tabName: string) => void = () => undefined

export function configureDeferredTabHandler(handler: (tabName: string) => void): void {
  onDeferredTabOpened = handler
}

export function clickTab(requestedTab: string): void {
  const candidate =
    requestedTab === "about" || requestedTab === "faq" || requestedTab === "changelog" ? "help" : requestedTab
  const tabName: CalculatorTab =
    isCalculatorTab(candidate) && document.getElementById(candidate + "_tab") !== null ? candidate : DEFAULT_TAB
  currentTab = tabName
  selectAll(".tab").style("display", "none")
  selectAll(".tab_button, .toolbar-tab-button").classed("active", false)
  select("#" + tabName + "_tab").style("display", "block")
  select("#" + tabName + "_button").classed("active", true)
  document.getElementById("factory_tab_tools")?.toggleAttribute("hidden", tabName !== "totals")
  if (tabName === "settings" || tabName === "resources") {
    onDeferredTabOpened(tabName)
  }
  spec.setHash()
  spec.notifyStateChanged()
}

export function clickVisualize(): void {
  clickTab("graph")
  spec.display()
}

// shared events

export function toggleIgnoreHandler(_event: Event, datum: { readonly item: Item }): void {
  spec.toggleIgnore(datum.item)
  spec.updateSolution()
}

// setting events

export function setCalculatorTitle(value: string): void {
  setTitle(value)
  spec.setHash()
  spec.notifyStateChanged()
}

export function changeTitle(event: Event): void {
  const input = getEventInput(event)
  if (input !== null) setCalculatorTitle(input.value)
}

export function setRatePrecision(value: number): void {
  if (!Number.isInteger(value) || value < 0) return
  spec.format.ratePrecision = value
  spec.display()
}

export function changeRatePrecision(event: Event): void {
  const input = getEventControl(event)
  if (input !== null) setRatePrecision(Number(input.value))
}

export function setCountPrecision(value: number): void {
  if (!Number.isInteger(value) || value < 0) return
  spec.format.countPrecision = value
  spec.display()
}

export function changeCountPrecision(event: Event): void {
  const input = getEventControl(event)
  if (input !== null) setCountPrecision(Number(input.value))
}

export function setDisplayFormat(value: DisplayFormat): void {
  spec.format.displayFormat = value
  spec.display()
}

export function changeFormat(event: Event): void {
  const input = getEventControl(event)
  if (input === null || (input.value !== "decimal" && input.value !== "rational")) return
  setDisplayFormat(input.value)
}

export function setMiningProductivityPercent(value: string): void {
  spec.miningProd = Rational.from_string(value).div(Rational.from_float(100))
  syncMiningProductivityControls()
  spec.updateSolution()
}

export function changeMprod(event: Event): void {
  const input = getEventInput(event)
  if (input !== null) setMiningProductivityPercent(input.value)
}

export function syncMiningProductivityControls(): void {
  let value = spec.miningProd.mul(Rational.from_integer(100)).toDecimal()
  let input = document.getElementById("mprod") as HTMLInputElement | null
  if (input !== null) input.value = value
}

// visualizer events

export function changeVisualizationType(value: string): void {
  setVisualizerType(value)
  const direction = getDefaultVisualizerDirection()
  setVisualizerDirection(direction)
  select(`#${direction}_direction`).property("checked", true)
  spec.display()
}

export function changeVisType(event: Event): void {
  const input = getEventControl(event)
  if (input !== null) changeVisualizationType(input.value)
}

export function changeVisualizationRender(value: string): void {
  setVisualizerRender(value)
  spec.display()
}

export function changeVisRender(event: Event): void {
  const input = getEventControl(event)
  if (input !== null) changeVisualizationRender(input.value)
}

export function changeVisualizationDirection(value: string): void {
  setVisualizerDirection(value)
  spec.display()
}

export function changeVisDir(event: Event): void {
  const input = getEventControl(event)
  if (input !== null) changeVisualizationDirection(input.value)
}

// Dataset selection

class Modification {
  constructor(
    readonly name: string,
    readonly filename: string,
    readonly legacy: boolean,
  ) {}
}

export const MODIFICATIONS = new Map([
  // 2.1.14 has no calculator-relevant prototype changes, so it intentionally reuses the 2.1.13 export and URL key.
  ["space-age-2-1-13", new Modification("Space Age 2.1.14 (EXPERIMENTAL)", "space-age-2.1.13.json", false)],
  ["2-0-55", new Modification("Vanilla 2.0.55", "vanilla-2.0.55.json", false)],
  ["1-1-110", new Modification("Vanilla 1.1.110", "vanilla-1.1.110.json", true)],
  ["1-1-110x", new Modification("Vanilla 1.1.110 - Expensive", "vanilla-1.1.110-expensive.json", true)],
  ["space-age-2-0-55", new Modification("Space Age 2.0.55", "space-age-2.0.55.json", false)],
])

const DEFAULT_MODIFICATION = "space-age-2-1-13"
const modificationUpdates = new Map([
  ["space-age-2-1-12", "space-age-2-1-13"],
  ["2-0-6", "2-0-55"],
  ["2-0-7", "2-0-55"],
  ["2-0-10", "2-0-55"],
  ["1-1-19", "1-1-110"],
  ["1-1-19x", "1-1-110x"],
  ["space-age-2-0-10", "space-age-2-0-55"],
  ["space-age-2-0-11", "space-age-2-0-55"],
])

let onModificationChanged: () => void = () => {
  throw new Error("Dataset change handler has not been configured")
}

export function configureDatasetChangeHandler(handler: () => void): void {
  onModificationChanged = handler
}

function normalizeDataSetName(name: string | undefined): string {
  const updatedName = name === undefined ? undefined : (modificationUpdates.get(name) ?? name)
  return updatedName !== undefined && MODIFICATIONS.has(updatedName) ? updatedName : DEFAULT_MODIFICATION
}

export function renderDataSetOptions(settings: Map<string, string>): void {
  const selector = document.getElementById("data_set") as HTMLSelectElement
  select(selector).on("change", () => onModificationChanged())
  const configuredModification = normalizeDataSetName(settings.get("data"))
  selector.replaceChildren()
  for (const [key, modification] of MODIFICATIONS) {
    const option = document.createElement("option")
    option.textContent = modification.name
    option.value = key
    option.selected = key === configuredModification
    selector.appendChild(option)
  }
}

export function currentMod(): string {
  return (document.getElementById("data_set") as HTMLSelectElement).value
}

// Visualization state

export const DEFAULT_VISUALIZER = "sankey"
export const DEFAULT_RENDER = "zoom"

export let visualizerType = DEFAULT_VISUALIZER
export let visualizerRender = DEFAULT_RENDER
export let visualizerDirection = getDefaultVisualizerDirection()

export function setVisualizerType(value: string): void {
  visualizerType = value
}

export function setVisualizerRender(value: string): void {
  visualizerRender = value
}

export function setVisualizerDirection(value: string): void {
  visualizerDirection = value
}

export function getDefaultVisualizerDirection(): string {
  return visualizerType === "sankey" ? "right" : "down"
}

export function isDefaultVisualizerDirection(): boolean {
  return visualizerDirection === getDefaultVisualizerDirection()
}

// Calculation mode

let legacyCalculation = false

export function setLegacyCalculation(value: boolean): void {
  legacyCalculation = value
}

export function usesLegacyCalculation(): boolean {
  return legacyCalculation
}
// endregion state.ts

// region application/store.ts
const INITIAL_SNAPSHOT: CalculatorSnapshot = {
  revision: 0,
  datasetKey: "",
  activeTab: "totals",
  factoryDensity: "compact",
  title: "Factorio Calculator",
  status: "loading",
  errorMessage: null,
  targets: [],
  settings: {
    displayRate: "m",
    ratePrecision: 3,
    countPrecision: 1,
    displayFormat: "decimal",
    miningProductivityPercent: "0",
    beltStackSize: "1",
    beltStackDefaultPolicy: "auto",
    bufferMinutes: "1",
    freshnessDelayMinutes: "0",
    maxQualityLevel: 4,
    equipmentQualityAvailable: false,
    qualityPlannerObjective: "practical",
    visualizationType: "sankey",
    visualizationRender: "zoom",
    visualizationDirection: "right",
  },
}

export const browserCalculatorPort: CalculatorBrowserPort = {
  readDatasetKey() {
    const selector = document.getElementById("data_set")
    return selector instanceof HTMLSelectElement ? selector.value : ""
  },
  readTitle() {
    return document.title
  },
}

function getCalculationStatus(specification: FactorySpecification): CalculationStatus {
  if (specification.lastError !== null) return "error"
  if (specification.items.size === 0 || specification.lastTotals === null) return "loading"
  return "ready"
}

function getErrorMessage(error: unknown): string | null {
  if (error === null) return null
  if (error instanceof Error) return error.message
  return String(error)
}

function createSnapshot(
  specification: FactorySpecification,
  revision: number,
  browser: CalculatorBrowserPort,
): CalculatorSnapshot {
  return {
    revision,
    datasetKey: browser.readDatasetKey(),
    activeTab: currentTab,
    factoryDensity,
    title: browser.readTitle(),
    status: getCalculationStatus(specification),
    errorMessage: getErrorMessage(specification.lastError),
    targets: specification.buildTargets.map((target) => ({
      index: target.index,
      itemKey: target.itemKey,
      itemName: target.item.name,
      recipeKey: target.recipe?.key ?? null,
      recipeName: target.recipe?.name ?? null,
      buildings: target.buildings.toString(),
      rate: target.rate.toString(),
      qualityLevel: target.qualityLevel,
      qualityStrategy: target.qualityStrategy,
    })),
    settings: {
      displayRate: specification.format.rateName,
      ratePrecision: specification.format.ratePrecision,
      countPrecision: specification.format.countPrecision,
      displayFormat: specification.format.displayFormat,
      miningProductivityPercent: specification.miningProd.mul(Rational.from_integer(100)).toDecimal(),
      beltStackSize: specification.beltStackSize.toString(),
      beltStackDefaultPolicy: specification.beltStackDefaultPolicy,
      bufferMinutes: specification.bufferMinutes.toString(),
      freshnessDelayMinutes: specification.freshnessDelayMinutes.toString(),
      maxQualityLevel: specification.maxQualityLevel,
      equipmentQualityAvailable: specification.qualityTiers.length > 1,
      qualityPlannerObjective: specification.qualityPlannerObjective,
      visualizationType: visualizerType,
      visualizationRender: visualizerRender,
      visualizationDirection: visualizerDirection,
    },
  }
}

export class BrowserCalculatorStore implements CalculatorStore {
  private readonly listeners = new Set<() => void>()
  private specification: FactorySpecification = spec
  private unsubscribeSpecification: (() => void) | null = null
  private snapshot: CalculatorSnapshot = INITIAL_SNAPSHOT
  private revision = 0
  private started = false

  constructor(private readonly browser: CalculatorBrowserPort = browserCalculatorPort) {}

  readonly getSnapshot = (): CalculatorSnapshot => this.snapshot

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly commands: CalculatorCommands = {
    addTarget: (itemKey?: string) => {
      if (this.snapshot.status !== "ready") return
      this.specification.addTarget(itemKey)
      this.specification.updateSolution()
    },
    removeTarget: (index: number) => {
      const target = this.specification.buildTargets[index]
      if (target === undefined) return
      this.specification.removeTarget(target)
      this.specification.updateSolution()
    },
    selectTab: (tab) => {
      clickTab(tab)
      this.refresh()
    },
    openVisualization: () => {
      clickVisualize()
      this.refresh()
    },
    copyShareLink,
    applyProgressionPreset: (value: ProgressionPreset) => {
      applyProgressionPresetValue(value)
    },
    applyQualityPreset: (value: QualityPreset) => {
      applyQualityPresetValue(value)
    },
    setFactoryDensity: (value: FactoryDensity) => {
      setFactoryDensity(value)
      this.refresh()
    },
    setTitle: (value: string) => {
      setCalculatorTitle(value)
    },
    setRatePrecision: (value: number) => {
      setRatePrecision(value)
    },
    setCountPrecision: (value: number) => {
      setCountPrecision(value)
    },
    setDisplayFormat: (value: DisplayFormat) => {
      setDisplayFormat(value)
    },
    setMiningProductivityPercent: (value: string) => {
      setMiningProductivityPercent(value)
    },
    setPlanningSetting: (input: PlanningSettingValue) => {
      setPlanningSetting(input)
    },
    setVisualizationType: (value: string) => {
      changeVisualizationType(value)
    },
    setVisualizationRender: (value: string) => {
      changeVisualizationRender(value)
    },
    setVisualizationDirection: (value: string) => {
      changeVisualizationDirection(value)
    },
    recalculate: () => {
      this.specification.updateSolution()
    },
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.bindSpecification(spec)
  }

  dispose(): void {
    this.started = false
    this.unsubscribeSpecification?.()
    this.unsubscribeSpecification = null
  }

  bindSpecification(specification: FactorySpecification): void {
    this.unsubscribeSpecification?.()
    this.specification = specification
    this.unsubscribeSpecification = specification.subscribe(this.refresh)
    this.refresh()
  }

  private readonly refresh = (): void => {
    this.revision++
    this.snapshot = createSnapshot(this.specification, this.revision, this.browser)
    for (const listener of this.listeners) listener()
  }
}

export const calculatorStore = new BrowserCalculatorStore()

export function bindCalculatorSpecification(specification: FactorySpecification): void {
  calculatorStore.bindSpecification(specification)
}
// endregion application/store.ts

// region color-schemes.ts
export class ColorScheme {
  constructor(
    readonly name: string,
    readonly key: string,
    readonly scheme: ReadonlyMap<string, string>,
  ) {}

  apply(): void {
    const html = document.documentElement
    for (const [name, value] of this.scheme) {
      html.style.setProperty(name, value)
    }
  }
}

export const colorSchemes = [
  new ColorScheme(
    "Default",
    "default",
    new Map([
      ["--dark", "#171717"],
      ["--dark-overlay", "rgba(23, 23, 23, 0.8)"],
      ["--medium", "#212427"],
      ["--main", "#272b30"],
      ["--light", "#3a3f44"],
      ["--foreground", "#c8c8c8"],
      ["--accent", "#ff7200"],
      ["--bright", "#f1fff2"],
    ]),
  ),
  new ColorScheme(
    "Printer-friendly",
    "printer",
    new Map([
      ["--dark", "#f0f0f0"],
      ["--dark-overlay", "#ffffff"],
      ["--medium", "#ffffff"],
      ["--main", "#ffffff"],
      ["--light", "#dddddd"],
      ["--foreground", "#000000"],
      ["--accent", "#222222"],
      ["--bright", "#111111"],
    ]),
  ),
] as const
// endregion color-schemes.ts

// region settings/productivity-research.ts
export const MAX_RECIPE_PRODUCTIVITY_PERCENT = 300

export function recipeProductivityPercentPerLevel(research: RecipeProductivityResearch): number {
  const change = research.effects.values().next().value
  return change === undefined ? 0 : Number(change.mul(Rational.from_integer(100)).toDecimal())
}

export function recipeProductivityPercent(research: RecipeProductivityResearch, level: number): string | null {
  const bonuses = new Set<string>()
  for (const change of research.effects.values()) {
    bonuses.add(change.mul(Rational.from_float_approximate(level)).mul(Rational.from_integer(100)).toDecimal())
  }
  if (bonuses.size !== 1) return null

  const onlyBonus = bonuses.values().next().value
  if (onlyBonus === undefined) return null
  const percent = Rational.from_string(onlyBonus)
  return Rational.min(percent, Rational.from_integer(MAX_RECIPE_PRODUCTIVITY_PERCENT)).toDecimal()
}

export function recipeProductivityLevelFromPercent(research: RecipeProductivityResearch, value: string): number {
  const percent = Number(value)
  const percentPerLevel = recipeProductivityPercentPerLevel(research)
  if (!Number.isFinite(percent) || percentPerLevel <= 0) return 0
  return Math.min(MAX_RECIPE_PRODUCTIVITY_PERCENT, Math.max(0, percent)) / percentPerLevel
}
// endregion settings/productivity-research.ts

// region url/codec.ts
const MAX_COMPRESSED_FRAGMENT_DEPTH = 3

export interface Base64Codec {
  encode(binary: string): string
  decode(encoded: string): string
}

export type TargetSettingMode = "f" | "r" | "b"
export type BeltStackSettingPolicy = "auto" | "stacked" | "unstacked"

export interface BeltStackItemSetting {
  readonly itemKey: string
  readonly policy: BeltStackSettingPolicy
}

export interface TargetSetting {
  readonly itemKey: string
  readonly mode: TargetSettingMode
  readonly value: string
  readonly recipeKey: string | null
  readonly qualityLevel: number
  readonly qualityStrategy: QualityStrategy
}

export function formatTargetSetting(target: TargetSetting): string {
  let setting = `${target.itemKey}:${target.mode}:${target.value}`
  if (target.mode === "f" && target.recipeKey !== null) setting += `:${target.recipeKey}`
  if (target.qualityLevel > 0) setting += `:q${target.qualityLevel}`
  if (target.qualityStrategy !== "direct") setting += `:qs-${target.qualityStrategy}`
  return setting
}

export function parseTargetSetting(setting: string): TargetSetting | null {
  const parts = setting.split(":")
  const itemKey = parts[0]
  const mode = parts[1]
  const value = parts[2]
  if (itemKey === undefined || itemKey === "" || value === undefined || value === "") return null
  if (mode !== "f" && mode !== "r" && mode !== "b") return null

  let recipeKey: string | null = null
  let qualityLevel = 0
  let qualityStrategy: QualityStrategy = "direct"
  let seenQuality = false
  let seenStrategy = false

  for (const part of parts.slice(3)) {
    if (/^q\d+$/.test(part)) {
      if (seenQuality) return null
      qualityLevel = Number(part.slice(1))
      seenQuality = true
      continue
    }
    if (part.startsWith("qs-")) {
      const strategy = part.slice(3)
      if (seenStrategy || !isQualityStrategy(strategy)) return null
      qualityStrategy = strategy
      seenStrategy = true
      continue
    }
    if (mode !== "f" || recipeKey !== null || part === "") return null
    recipeKey = part
  }

  if (qualityLevel === 0 && qualityStrategy !== "direct") return null

  return {
    itemKey,
    mode,
    value,
    recipeKey,
    qualityLevel,
    qualityStrategy,
  }
}

export function parseBeltStackSettingPolicy(value: string): BeltStackSettingPolicy | null {
  return value === "auto" || value === "stacked" || value === "unstacked" ? value : null
}

export function formatBeltStackItemSettings(settings: readonly BeltStackItemSetting[]): string {
  return settings.map((setting) => `${setting.itemKey}:${setting.policy}`).join(",")
}

export function parseBeltStackItemSettings(value: string): BeltStackItemSetting[] | null {
  if (value === "") return []
  const settings: BeltStackItemSetting[] = []
  const seen = new Set<string>()
  for (const part of value.split(",")) {
    const separator = part.lastIndexOf(":")
    if (separator <= 0) return null
    const itemKey = part.slice(0, separator)
    const policy = parseBeltStackSettingPolicy(part.slice(separator + 1))
    if (policy === null || seen.has(itemKey)) return null
    seen.add(itemKey)
    settings.push({ itemKey, policy })
  }
  return settings
}

export function bytesToBinaryString(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let result = ""
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return result
}

export function binaryStringToBytes(binary: string): Uint8Array {
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export function parseSettingsParameters(value: string): Map<string, string> {
  const settings = new Map<string, string>()
  for (const pair of value.split("&")) {
    const separator = pair.indexOf("=")
    if (separator === -1) continue
    settings.set(pair.slice(0, separator), pair.slice(separator + 1))
  }
  return settings
}

export function parseCalculatorFragment(fragment: string, base64: Base64Codec): Map<string, string> {
  return parseCalculatorFragmentAtDepth(fragment, base64, 0)
}

function parseCalculatorFragmentAtDepth(
  fragment: string,
  base64: Base64Codec,
  compressedDepth: number,
): Map<string, string> {
  const value = fragment.startsWith("#") ? fragment.slice(1) : fragment
  const settings = parseSettingsParameters(value)
  const compressed = settings.get("zip")
  if (compressed === undefined) return settings
  if (compressedDepth >= MAX_COMPRESSED_FRAGMENT_DEPTH) return new Map()

  try {
    const binary = base64.decode(compressed)
    const unzipped = new TextDecoder().decode(inflateRaw(binaryStringToBytes(binary)))
    return parseCalculatorFragmentAtDepth(unzipped, base64, compressedDepth + 1)
  } catch {
    return new Map()
  }
}

export function compressCalculatorSettings(settings: string, base64: Base64Codec): string {
  const compressed = `zip=${base64.encode(bytesToBinaryString(deflateRaw(settings)))}`
  return compressed.length < settings.length ? compressed : settings
}
// endregion url/codec.ts

// region settings.ts
type SettingsMap = ReadonlyMap<string, string>
type RadioOption = Belt | Fuel

function requireSettingsPlanets(): Map<string, Planet> {
  if (spec.planets === null) throw new Error("Planet data has not been loaded")
  return spec.planets
}

function requireFuels() {
  if (spec.fuels === null) throw new Error("Fuel data has not been loaded")
  return spec.fuels
}

function requireSettingsElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) throw new Error(`Missing #${id}`)
  return element as TElement
}

// Recipe browser

let searchText = ""
let showUnavailable = false
let showChangedOnly = false
let recipeSettingsRendered = false
let resourcePrioritiesRendered = false

function recipeCategoryId(category: string): string {
  return `recipe-category-${category.replace(/[^a-z0-9_-]+/gi, "-")}`
}

function updateRecipeToggleState(
  specification: FactorySpecification,
  element: HTMLButtonElement,
  recipe: Recipe,
): void {
  const unavailable = isRecipeUnavailable(specification, recipe)
  const enabled = !specification.disable.has(recipe)

  element.classList.toggle("selected", enabled && !unavailable)
  element.classList.toggle("disabled-recipe", !enabled && !unavailable)
  element.classList.toggle("unavailable", unavailable)
  element.disabled = unavailable

  if (unavailable) {
    const status = "unavailable on the selected planets or compatible machines"
    element.setAttribute("data-tooltip", `${recipe.name} (${status})`)
    element.setAttribute("aria-label", `${recipe.name}: ${status}.`)
    element.setAttribute("aria-disabled", "true")
    element.removeAttribute("aria-pressed")
    return
  }

  const status = enabled ? "enabled" : "disabled"
  element.setAttribute("data-tooltip", `${recipe.name} (${status})`)
  element.setAttribute("aria-label", `${recipe.name}: ${status}. Click to ${enabled ? "disable" : "enable"}.`)
  element.setAttribute("aria-disabled", "false")
  element.setAttribute("aria-pressed", String(enabled))
}

function makeRecipeToggles<GElement extends BaseType, TDatum, PElement extends BaseType, PDatum>(
  container: Selection<GElement, TDatum, PElement, PDatum>,
  recipes: readonly Recipe[],
  specification: FactorySpecification,
): void {
  const toggles = container
    .selectAll("button.recipe-setting-toggle")
    .data(recipes)
    .join("button")
    .attr("type", "button")
    .classed("toggle recipe recipe-setting-toggle", true)
    .on("click", function (event: Event, recipe: Recipe) {
      event.preventDefault()
      if (isRecipeUnavailable(specification, recipe)) {
        return
      }
      setRecipeEnabled(specification, recipe, specification.disable.has(recipe))
      specification.updateSolution()
    })

  toggles.each(function (recipe: Recipe) {
    updateRecipeToggleState(specification, this as HTMLButtonElement, recipe)
  })
  toggles.selectAll("*").remove()
  toggles.append((recipe: Recipe) => recipe.icon.make(32))
}

function makeRecipeGroups<GElement extends BaseType, TDatum, PElement extends BaseType, PDatum>(
  container: Selection<GElement, TDatum, PElement, PDatum>,
  groups: readonly RecipeSettingsGroup[],
  specification: FactorySpecification,
): void {
  const group = container
    .selectAll<HTMLDetailsElement, RecipeSettingsGroup>("details.recipe-settings-category")
    .data(groups, (entry: RecipeSettingsGroup) => entry.category)
    .join("details")
    .classed("recipe-settings-category", true)
    .property("open", true)
    .attr("id", (entry: RecipeSettingsGroup) => recipeCategoryId(entry.category))
    .attr("data-category", (entry: RecipeSettingsGroup) => entry.category)

  group
    .selectAll<HTMLElement, RecipeSettingsGroup>("summary")
    .data((entry: RecipeSettingsGroup) => [entry])
    .join("summary")
    .text((entry: RecipeSettingsGroup) => entry.name)
  group
    .selectAll("div.recipe-settings-toggle-row")
    .data((entry: RecipeSettingsGroup) => [entry])
    .join("div")
    .classed("toggle-list recipe-settings-toggle-row", true)
    .each(function (entry: RecipeSettingsGroup) {
      makeRecipeToggles(select(this as HTMLDivElement), entry.recipes, specification)
    })
}

function disableAllRecycling(specification: FactorySpecification, recyclingRecipes: readonly Recipe[]): void {
  let changed = false
  for (const recipe of recyclingRecipes) {
    if (!specification.disable.has(recipe)) {
      specification.setDisable(recipe)
      changed = true
    }
  }
  if (changed) {
    specification.updateSolution()
  } else {
    refreshRecipeSettings(specification)
  }
}

function resetRecipeChanges(specification: FactorySpecification): void {
  const overrides = specification.getNetDisable()
  for (const recipe of overrides.disable) {
    specification.setEnable(recipe)
  }
  for (const recipe of overrides.enable) {
    specification.setDisable(recipe)
  }
  specification.updateSolution()
}

export function renderRecipeSettings(specification: FactorySpecification): void {
  searchText = ""
  showUnavailable = false
  showChangedOnly = false

  const recipes = getConfigurableRecipes(specification)
  const productionRecipes = recipes.filter((recipe) => !isRecyclingRecipe(recipe))
  const recyclingRecipes = recipes.filter(isRecyclingRecipe)
  const productionGroups = groupRecipesForSettings(productionRecipes)
  const root = select("#recipe_toggles")
  root.selectAll("*").remove()
  root.classed("recipe-settings-browser", true)

  const toolbar = root.append("div").classed("recipe-settings-toolbar", true)
  toolbar
    .append("input")
    .attr("id", "recipe_search")
    .attr("type", "search")
    .attr("placeholder", "Search recipes, items, ingredients, or machines")
    .attr("aria-label", "Search recipes")
    .on("input", function () {
      searchText = (this as HTMLInputElement).value
      refreshRecipeSettings(specification)
    })

  const unavailableLabel = toolbar.append("label").classed("recipe-settings-unavailable", true)
  unavailableLabel
    .append("input")
    .attr("type", "checkbox")
    .on("change", function () {
      showUnavailable = (this as HTMLInputElement).checked
      refreshRecipeSettings(specification)
    })
  unavailableLabel
    .attr("data-tooltip", "Show recipes blocked by the selected planets or compatible machines.")
    .append("span")
    .text("Show unavailable recipes")

  const changedLabel = toolbar.append("label").classed("recipe-settings-changed", true)
  changedLabel
    .append("input")
    .attr("type", "checkbox")
    .on("change", function (this: HTMLInputElement) {
      showChangedOnly = this.checked
      refreshRecipeSettings(specification)
    })
  changedLabel.append("span").text("Changed only")

  toolbar
    .append("button")
    .attr("type", "button")
    .classed("ui reset-recipe-changes", true)
    .text("Reset recipe changes")
    .on("click", () => resetRecipeChanges(specification))

  root.append("div").attr("id", "recipe_settings_help").classed("recipe-settings-help", true)
  root.append("div").classed("recipe-settings-summary", true).attr("aria-live", "polite")

  const production = root.append("section").classed("recipe-settings-section production-recipes", true)
  production.append("h4").text("Production recipes")
  makeRecipeGroups(production.append("div").classed("recipe-settings-groups", true), productionGroups, specification)

  const recycling = root.append("details").classed("recipe-settings-section recycling-recipes", true)
  recycling.append("summary").append("span").classed("recycling-recipes-title", true).text("Recycling recipes")
  const recyclingBody = recycling.append("div").classed("recycling-recipes-body", true)
  recyclingBody
    .append("button")
    .attr("type", "button")
    .classed("ui disable-recycling-recipes", true)
    .text("Disable all recycling recipes")
    .on("click", (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      disableAllRecycling(specification, recyclingRecipes)
    })
  makeRecipeToggles(
    recyclingBody.append("div").classed("toggle-list recipe-settings-toggle-row", true),
    recyclingRecipes,
    specification,
  )

  root.append("div").classed("recipe-settings-empty", true).text("No recipes match your search.")
  refreshRecipeSettings(specification)
}

export function refreshRecipeSettings(specification: FactorySpecification): void {
  if (!recipeSettingsRendered) {
    return
  }
  const root = select("#recipe_toggles")
  if (root.empty()) {
    return
  }

  const normalizedSearch = normalizeSearchText(searchText)
  const overrides = specification.getNetDisable()
  const changedRecipes = new Set([...overrides.disable, ...overrides.enable])
  let visibleCount = 0

  root.selectAll<HTMLButtonElement, Recipe>("button.recipe-setting-toggle").each(function (recipe: Recipe) {
    const visible =
      recipeVisibleInSettings(specification, recipe, {
        searchText,
        showUnavailable,
      }) &&
      (!showChangedOnly || changedRecipes.has(recipe))
    const element = this as HTMLButtonElement
    element.hidden = !visible
    visibleCount += Number(visible)
    updateRecipeToggleState(specification, element, recipe)
  })

  root.selectAll<HTMLDetailsElement, unknown>("details.recipe-settings-category").each(function () {
    const element = this as HTMLDetailsElement
    element.hidden = element.querySelector("button.recipe-setting-toggle:not([hidden])") === null
    if (normalizedSearch !== "" && !element.hidden) element.open = true
  })

  const production = root.select(".production-recipes")
  production.property("hidden", production.select("button.recipe-setting-toggle:not([hidden])").empty())
  const recycling = root.select("details.recycling-recipes")
  const visibleRecyclingCount = recycling.selectAll("button.recipe-setting-toggle:not([hidden])").size()
  recycling.property("hidden", visibleRecyclingCount === 0)
  if (normalizedSearch !== "" && visibleRecyclingCount > 0) {
    recycling.property("open", true)
  }
  recycling
    .select(".recycling-recipes-title")
    .text(`Recycling recipes${visibleRecyclingCount > 0 ? ` (${visibleRecyclingCount})` : ""}`)

  const recyclingRecipes = recycling.selectAll<HTMLButtonElement, Recipe>("button.recipe-setting-toggle").data()
  recycling
    .select("button.disable-recycling-recipes")
    .property(
      "disabled",
      recyclingRecipes.length === 0 || recyclingRecipes.every((recipe) => specification.disable.has(recipe)),
    )

  let helpText = "Orange: enabled · Dimmed: disabled · Click to toggle"
  if (showUnavailable) {
    helpText += " Locked recipes are unavailable on the selected planets or machines."
  }
  root.select(".recipe-settings-help").text(helpText)

  root
    .select(".recipe-settings-summary")
    .text(
      normalizedSearch === ""
        ? `${visibleCount} recipe${visibleCount === 1 ? "" : "s"}`
        : `${visibleCount} matching recipe${visibleCount === 1 ? "" : "s"}`,
    )
  root.select("button.reset-recipe-changes").property("disabled", changedRecipes.size === 0)
  root.select(".recipe-settings-empty").property("hidden", visibleCount !== 0)
}

// Recipe and location panel

function applyLocationSettings(settings: SettingsMap): boolean {
  const planets = requireSettingsPlanets()
  const hasMultipleLocations = planets.size > 1
  select("#location_toolbar").property("hidden", !hasMultipleLocations)
  if (!hasMultipleLocations) {
    return false
  }

  let keys = settings.has("planet") ? (settings.get("planet") ?? "").split(",").filter(Boolean) : [DEFAULT_PLANET]
  for (let key of keys) {
    const location = planets.get(key)
    if (location !== undefined) {
      spec.selectPlanet(location)
    }
  }
  return true
}

function applyRecipeOverrides(settings: SettingsMap, hasMultipleLocations: boolean): void {
  if (!settings.has("disable") && !settings.has("enable")) {
    if (!hasMultipleLocations) {
      spec.setDefaultDisable()
    }
    return
  }

  for (let key of settings.get("disable")?.split(",") ?? []) {
    let recipe = spec.recipes.get(key)
    if (recipe !== undefined) {
      spec.setDisable(recipe)
    }
  }
  for (let key of settings.get("enable")?.split(",") ?? []) {
    let recipe = spec.recipes.get(key)
    if (recipe !== undefined) {
      spec.setEnable(recipe)
    }
  }
}

function renderLocationSelector(hasMultipleLocations: boolean): void {
  let selector = select("#planet_selector").classed("toggle-list", true)
  selector.selectAll("*").remove()
  if (!hasMultipleLocations) {
    return
  }

  let toggles = selector
    .selectAll("button")
    .data(sorted(requireSettingsPlanets().values(), (location: Planet) => location.order))
    .join("button")
    .attr("type", "button")
    .classed("toggle location-toggle", true)
    .classed("selected", (location: Planet) => spec.selectedPlanets.has(location))
    .attr("aria-pressed", (location: Planet) => String(spec.selectedPlanets.has(location)))
    .attr("data-tooltip", (location: Planet) => location.name)
    .on("click", function (event: MouseEvent, location: Planet) {
      if (event.shiftKey) {
        event.preventDefault()
        if (spec.selectedPlanets.has(location)) {
          spec.unselectPlanet(location)
        } else {
          spec.selectPlanet(location)
        }
      } else {
        spec.selectOnePlanet(location)
      }
      selectAll<HTMLButtonElement, Planet>("#planet_selector .toggle")
        .classed("selected", (candidate: Planet) => spec.selectedPlanets.has(candidate))
        .attr("aria-pressed", (candidate: Planet) => String(spec.selectedPlanets.has(candidate)))
      refreshRecipeSettings(spec)
      spec.updateSolution()
    })

  toggles.selectAll("*").remove()
  toggles.append((location: Planet) => location.icon.make(24))
  toggles
    .append("span")
    .classed("location-name", true)
    .text((location: Planet) => location.name)
}

export function renderRecipeAndLocationSettings(settings: SettingsMap): void {
  let hasMultipleLocations = applyLocationSettings(settings)
  applyRecipeOverrides(settings, hasMultipleLocations)
  renderLocationSelector(hasMultipleLocations)
  recipeSettingsRendered = false
  document.getElementById("recipe_toggles")?.replaceChildren()
}

// Settings form

// There are several things going on with this control flow. Settings should
// work like this:
// 1) Settings are parsed from the URL fragment into the settings Map.
// 2) Each setting's `render` function is called.
// 3) If the setting is not present in the map, a default value is used.
// 4) The setting is applied.
// 5) The setting's GUI is placed into a consistent state.
// Remember to add the setting to fragment.js, too!

// tab

function renderTab(settings: SettingsMap) {
  let tabName: string = DEFAULT_TAB
  if (settings.has("tab")) {
    tabName = settings.get("tab") ?? DEFAULT_TAB
  }
  clickTab(tabName)
}

// build targets

function renderTargets(settings: SettingsMap) {
  spec.buildTargets.splice(0, spec.buildTargets.length)
  selectAll("#targets li.target").remove()

  let targetSetting = settings.get("items")
  if (targetSetting !== undefined && targetSetting !== "") {
    let targets = targetSetting.split(",")
    for (let targetString of targets) {
      const parsed = parseTargetSetting(targetString)
      if (parsed === null) {
        console.log("invalid target:", targetString)
        continue
      }
      if (!spec.items.has(parsed.itemKey)) {
        console.log("unknown item:", parsed.itemKey)
        continue
      }

      let recipe = null
      if (parsed.recipeKey !== null) {
        if (!spec.recipes.has(parsed.recipeKey)) {
          console.log("unknown recipe:", parsed.recipeKey)
          continue
        }
        recipe = spec.recipes.get(parsed.recipeKey) ?? null
      }

      const target = spec.addTarget(parsed.itemKey)
      if (parsed.mode === "f") {
        target.setBuildings(parsed.value, recipe)
        target.displayRecipes()
      } else if (parsed.mode === "r") {
        target.setRate(parsed.value)
      } else {
        target.setBelts(parsed.value)
      }
      target.setQuality(parsed.qualityLevel)
      target.setQualityStrategy(parsed.qualityStrategy)
    }
  } else {
    spec.addTarget()
  }
}

// modules

function getModule(moduleKey: string): Module | null {
  let module
  if (spec.modules.has(moduleKey)) {
    module = spec.modules.get(moduleKey)
  } else if (shortModules.has(moduleKey)) {
    module = shortModules.get(moduleKey)
  } else if (moduleKey === "null") {
    module = null
  }
  if (module === undefined) {
    console.log("unknown module:", moduleKey)
    return null
  }
  return module
}

function getAvailableQuality(qualityKey: string | undefined): Quality | null {
  if (qualityKey === undefined) return null
  const quality = spec.qualities.get(qualityKey)
  if (quality === undefined || spec.getQualityIndex(quality) > spec.maxQualityLevel) return null
  return quality
}

function getQuality(qualityKey: string | undefined): Quality {
  return getAvailableQuality(qualityKey) ?? spec.getNormalQuality()
}

function renderQualitySelect(
  containerId: string,
  label: string,
  selected: Quality,
  choose: (quality: Quality) => void,
): void {
  const container = select<HTMLElement, unknown>(`#${containerId}`)
  container.selectAll("*").remove()
  const input = container.append("select").attr("aria-label", label).classed("equipment-quality-select", true)
  input
    .selectAll("option")
    .data(spec.getAvailableQualities())
    .join("option")
    .attr("value", (quality) => quality.key)
    .text((quality) => quality.name)
  input.property("value", selected.key).on("change", (event: Event) => {
    const target = event.target
    if (!(target instanceof HTMLSelectElement)) return
    choose(getQuality(target.value))
    spec.updateSolution()
  })
}

function renderQualityPlannerModuleSelect(options: {
  readonly containerId: string
  readonly label: string
  readonly modules: readonly Module[]
  readonly selected: Module | null
  readonly automaticLabel: string
  readonly choose: (module: Module | null) => void
}): void {
  const container = select<HTMLElement, unknown>(`#${options.containerId}`)
  container.selectAll("*").remove()
  const input = container
    .append("select")
    .attr("aria-label", options.label)
    .classed("quality-planner-module-select", true)
  input
    .selectAll("option")
    .data<Module | null>([null, ...options.modules])
    .join("option")
    .attr("value", (module) => module?.key ?? "")
    .text((module) => module?.name ?? options.automaticLabel)
  input.property("value", options.selected?.key ?? "").on("change", (event: Event) => {
    const target = event.target
    if (!(target instanceof HTMLSelectElement)) return
    options.choose(target.value === "" ? null : (spec.modules.get(target.value) ?? null))
    spec.updateSolution()
  })
}

function renderEquipmentQualityDefaults(settings: SettingsMap): void {
  spec.setDefaultMachineQuality(getQuality(settings.get("dmachq")))
  spec.setDefaultModuleQuality(getQuality(settings.get("dmq")))
  spec.setDefaultBeaconQuality(getQuality(settings.get("dbq")))
  renderQualitySelect("default_machine_quality", "Default machine quality", spec.defaultMachineQuality, (quality) =>
    spec.setDefaultMachineQuality(quality),
  )
  renderQualitySelect("default_module_quality", "Default module quality", spec.defaultModuleQuality, (quality) =>
    spec.setDefaultModuleQuality(quality),
  )
  renderQualitySelect("default_beacon_quality", "Default beacon quality", spec.defaultBeaconQuality, (quality) =>
    spec.setDefaultBeaconQuality(quality),
  )
}

function renderQualityPlanner(settings: SettingsMap): void {
  const configuredQualityModule = settings.has("qpm")
    ? getModule(settings.get("qpm") ?? "null")
    : (spec.modules.get(DEFAULT_QUALITY_PLANNER_MODULE_KEY) ?? null)
  spec.qualityPlannerModule = configuredQualityModule?.hasQualityEffect() ? configuredQualityModule : null
  spec.qualityPlannerModuleQuality = settings.has("qpmq")
    ? getQuality(settings.get("qpmq"))
    : (getAvailableQuality(DEFAULT_QUALITY_PLANNER_MODULE_QUALITY_KEY) ?? spec.getNormalQuality())
  const configuredProductivityModule = settings.has("qppm")
    ? getModule(settings.get("qppm") ?? "null")
    : (spec.modules.get(DEFAULT_QUALITY_PLANNER_PRODUCTIVITY_MODULE_KEY) ?? null)
  spec.qualityPlannerProductivityModule = configuredProductivityModule?.hasProdEffect()
    ? configuredProductivityModule
    : null
  spec.qualityPlannerProductivityModuleQuality = settings.has("qppmq")
    ? getQuality(settings.get("qppmq"))
    : (getAvailableQuality(DEFAULT_QUALITY_PLANNER_PRODUCTIVITY_MODULE_QUALITY_KEY) ?? spec.getNormalQuality())
  const objective = settings.get("qpo")
  spec.qualityPlannerObjective =
    objective !== undefined && isQualityPlannerObjective(objective) ? objective : "practical"

  const qualityModules = sorted(
    [...spec.modules.values()].filter((module) => module.hasQualityEffect()),
    (module) => module.order,
  )
  renderQualityPlannerModuleSelect({
    containerId: "quality_planner_module",
    label: "Quality factory quality module",
    modules: qualityModules,
    selected: spec.qualityPlannerModule,
    automaticLabel: "Best compatible quality module",
    choose(module) {
      spec.qualityPlannerModule = module?.hasQualityEffect() ? module : null
    },
  })
  renderQualitySelect(
    "quality_planner_module_quality",
    "Quality factory quality module quality",
    spec.qualityPlannerModuleQuality,
    (quality) => {
      spec.qualityPlannerModuleQuality = quality
    },
  )

  const productivityModules = sorted(
    [...spec.modules.values()].filter((module) => module.hasProdEffect()),
    (module) => module.order,
  )
  renderQualityPlannerModuleSelect({
    containerId: "quality_planner_productivity_module",
    label: "Quality factory productivity module",
    modules: productivityModules,
    selected: spec.qualityPlannerProductivityModule,
    automaticLabel: "Best compatible productivity module",
    choose(module) {
      spec.qualityPlannerProductivityModule = module?.hasProdEffect() ? module : null
    },
  })
  renderQualitySelect(
    "quality_planner_productivity_module_quality",
    "Quality factory productivity module quality",
    spec.qualityPlannerProductivityModuleQuality,
    (quality) => {
      spec.qualityPlannerProductivityModuleQuality = quality
    },
  )
}

function renderEquipmentQualityOverrides(settings: SettingsMap): void {
  for (const entry of (settings.get("machineq") ?? "").split(",")) {
    if (!entry) continue
    const separator = entry.lastIndexOf(":")
    if (separator < 0) continue
    const recipe = spec.recipes.get(entry.slice(0, separator))
    if (recipe) spec.setMachineQuality(recipe, getQuality(entry.slice(separator + 1)), "default")
  }
  for (const entry of (settings.get("moduleq") ?? "").split(",")) {
    if (!entry) continue
    const [machinePart, beaconModulePart = "", beaconQualityKey = ""] = entry.split(";")
    if (machinePart === undefined) continue
    const [recipeKey, ...moduleQualityKeys] = machinePart.split(":")
    if (recipeKey === undefined) continue
    const recipe = spec.recipes.get(recipeKey)
    if (!recipe) continue
    const moduleSpec = spec.getModuleSpec(recipe)
    if (!moduleSpec) continue
    moduleQualityKeys.forEach((key, index) => {
      const quality = getAvailableQuality(key)
      if (quality) moduleSpec.restoreModuleQualityOverride(index, quality)
    })
    beaconModulePart.split(":").forEach((key, index) => {
      const quality = getAvailableQuality(key)
      if (quality) moduleSpec.restoreBeaconModuleQualityOverride(quality, index)
    })
    const beaconQuality = getAvailableQuality(beaconQualityKey)
    if (beaconQuality) moduleSpec.restoreBeaconQualityOverride(beaconQuality)
  }
}

// NOTE: Buildings must be configured before modules!
function renderModules(settings: SettingsMap) {
  let two = Rational.from_float(2)
  let moduleString = settings.get("modules")
  if (moduleString !== undefined && moduleString !== "") {
    for (let recipeSetting of moduleString.split(",")) {
      const [buildingModuleSettings, beaconSettings] = recipeSetting.split(";")
      if (buildingModuleSettings === undefined) continue
      const [recipeKey, ...moduleKeyList] = buildingModuleSettings.split(":")
      if (recipeKey === undefined) continue
      const recipe = spec.recipes.get(recipeKey)
      if (recipe === undefined) {
        console.log("unknown recipe:", recipeKey)
        continue
      }
      const moduleSpec = spec.getModuleSpec(recipe)
      if (moduleSpec === null) {
        console.log("recipe has no module-capable building:", recipeKey)
        continue
      }
      for (let i = 0; i < moduleKeyList.length; i++) {
        const moduleKey = moduleKeyList[i]
        if (moduleKey === undefined || moduleKey === "") {
          continue
        }
        let module = getModule(moduleKey)
        if (module !== undefined) {
          moduleSpec.setModule(i, module)
        }
      }
      if (beaconSettings !== undefined) {
        let beaconParts = beaconSettings.split(":")
        // The legacy beacon config was simply in the form
        // "module:module count". If the count is even, then it is
        // adapted to the new format by dividing it by two and placing
        // the specified module in both slots. Otherwise, a single slot
        // is filled and the count is used as the beacon count.
        let module1
        let module2
        let count
        if (beaconParts.length === 2) {
          const firstBeaconKey = beaconParts[0]
          const countValue = beaconParts[1]
          if (firstBeaconKey === undefined || countValue === undefined) continue
          const module = getModule(firstBeaconKey)
          count = Rational.from_string(countValue)
          let divmod = count.divmod(two)
          if (divmod.remainder.isZero()) {
            module1 = module
            module2 = module
            count = divmod.quotient
          } else {
            module1 = module
            module2 = null
          }
        } else {
          const firstBeaconKey = beaconParts[0]
          const secondBeaconKey = beaconParts[1]
          const countValue = beaconParts[2]
          if (firstBeaconKey === undefined || secondBeaconKey === undefined || countValue === undefined) continue
          module1 = getModule(firstBeaconKey)
          module2 = getModule(secondBeaconKey)
          count = Rational.from_string(countValue)
        }
        moduleSpec.setBeaconModule(module1, 0)
        moduleSpec.setBeaconModule(module2, 1)
        moduleSpec.setBeaconCount(count)
      }
    }
  }
}

// ignore

function renderIgnore(settings: SettingsMap) {
  spec.ignore.clear()
  // UI will be rendered later, as part of the solution.
  let ignoreSetting = settings.get("ignore")
  if (ignoreSetting !== undefined && ignoreSetting !== "") {
    let ignore = ignoreSetting.split(",")
    for (let itemKey of ignore) {
      let item = spec.items.get(itemKey)
      if (item === undefined) {
        console.log("unknown item:", itemKey)
        continue
      }
      spec.ignore.add(item)
    }
  }
}

// title

function renderTitle(settings: SettingsMap) {
  const input = requireSettingsElement<HTMLInputElement>("title_setting")
  let title = ""
  if (settings.has("title")) {
    title = decodeURIComponent(settings.get("title") ?? "")
  }
  input.value = title
  setTitle(title)
}

// display rate

function rateHandler(this: HTMLInputElement) {
  spec.format.setDisplayRate(this.value as DisplayRate)
  spec.display()
}

function renderRateOptions(settings: SettingsMap) {
  let rateName = DEFAULT_RATE
  if (settings.has("rate")) {
    rateName = settings.get("rate") ?? DEFAULT_RATE
  }
  spec.format.setDisplayRate(rateName as DisplayRate)
  const rates: { rateName: DisplayRate; longRateName: string }[] = []
  for (let [rateName, longRateName] of longRateNames) {
    rates.push({ rateName, longRateName })
  }
  let form = select("#display_rate")
  form.selectAll("*").remove()
  let rateOption = form.selectAll("span").data(rates).join("span")
  rateOption
    .append("input")
    .attr("id", (d: { rateName: DisplayRate; longRateName: string }) => d.rateName + "_rate")
    .attr("type", "radio")
    .attr("name", "rate")
    .attr("value", (d: { rateName: DisplayRate; longRateName: string }) => d.rateName)
    .property("checked", (d: { rateName: DisplayRate; longRateName: string }) => d.rateName === rateName)
    .on("change", function () {
      rateHandler.call(this as HTMLInputElement)
    })
  rateOption
    .append("label")
    .attr("for", (d: { rateName: DisplayRate; longRateName: string }) => d.rateName + "_rate")
    .text((d: { rateName: DisplayRate; longRateName: string }) => "items/" + d.longRateName)
  rateOption.append("br")
}

// precisions

function renderPrecisions(settings: SettingsMap) {
  spec.format.ratePrecision = DEFAULT_RATE_PRECISION
  if (settings.has("rp")) {
    spec.format.ratePrecision = Number(settings.get("rp") ?? DEFAULT_RATE_PRECISION)
  }
  select("#rprec").attr("value", spec.format.ratePrecision)
  spec.format.countPrecision = DEFAULT_COUNT_PRECISION
  if (settings.has("cp")) {
    spec.format.countPrecision = Number(settings.get("cp") ?? DEFAULT_COUNT_PRECISION)
  }
  select("#cprec").attr("value", spec.format.countPrecision)
}

// value format

let displayFormats = new Map<string, DisplayFormat>([
  ["d", "decimal"],
  ["r", "rational"],
])

function renderValueFormat(settings: SettingsMap) {
  spec.format.displayFormat = DEFAULT_FORMAT
  if (settings.has("vf")) {
    spec.format.displayFormat = displayFormats.get(settings.get("vf") ?? "") ?? DEFAULT_FORMAT
  }
  let input = document.getElementById(spec.format.displayFormat + "_format") as HTMLInputElement
  input.checked = true
}

// mining productivity

function renderMiningProd(settings: SettingsMap) {
  let mprod = "0"
  if (settings.has("mprod")) {
    mprod = settings.get("mprod") ?? "0"
  }
  spec.miningProd = Rational.from_string(mprod).div(Rational.from_float(100))
  syncMiningProductivityControls()
}

function renderRecipeProductivityResearch(settings: SettingsMap) {
  spec.recipeProductivityLevels.clear()
  if (settings.has("rprod")) {
    for (let entry of (settings.get("rprod") ?? "").split(",")) {
      let separator = entry.lastIndexOf(":")
      if (separator === -1) continue
      let researchKey = entry.slice(0, separator)
      let level = Number(entry.slice(separator + 1))
      if (Number.isFinite(level) && level >= 0) {
        spec.setRecipeProductivityLevel(researchKey, level)
      }
    }
  }

  const research = sorted(spec.recipeProductivityResearch.values(), (entry: RecipeProductivityResearch) => entry.name)
  let container = select("#recipe_productivity_settings")
  let miner = spec.items.get("electric-mining-drill") ?? spec.items.get("burner-mining-drill")
  let miningIcon = container.select(".mining-productivity-icon")
  miningIcon.selectAll("*").remove()
  if (miner !== undefined) {
    miningIcon.append(() => miner.icon.make(24, true))
  }
  container.selectAll("label.recipe-productivity-research-setting").remove()
  let settingsRows = container
    .selectAll("label.recipe-productivity-research-setting")
    .data(research)
    .join("label")
    .classed("recipe-productivity-setting", true)
    .classed("recipe-productivity-research-setting", true)
  settingsRows
    .append((entry: RecipeProductivityResearch) => entry.icon.make(24, true))
    .classed("recipe-productivity-icon", true)
  settingsRows.append("span").text((entry: RecipeProductivityResearch) => entry.name)
  let percentageInputs = settingsRows.append("span").classed("recipe-productivity-percentage", true)
  percentageInputs
    .append("input")
    .attr("type", "number")
    .attr("min", 0)
    .attr("max", 300)
    .attr("step", (entry: RecipeProductivityResearch) => recipeProductivityPercentPerLevel(entry))
    .attr("data-research-key", (entry: RecipeProductivityResearch) => entry.key)
    .attr("data-percent-per-level", (entry: RecipeProductivityResearch) => recipeProductivityPercentPerLevel(entry))
    .attr("aria-label", (entry: RecipeProductivityResearch) => `${entry.name} bonus percentage`)
    .property(
      "value",
      (entry: RecipeProductivityResearch) =>
        recipeProductivityPercent(entry, spec.getRecipeProductivityLevel(entry.key)) ?? 0,
    )
    .on("change", function (_event: Event, entry: RecipeProductivityResearch) {
      const input = this as HTMLInputElement
      spec.setRecipeProductivityLevel(entry.key, recipeProductivityLevelFromPercent(entry, input.value))
      const level = spec.getRecipeProductivityLevel(entry.key)
      input.value = recipeProductivityPercent(entry, level) ?? "0"
      spec.updateSolution()
    })
  percentageInputs.append("span").attr("aria-hidden", "true").text("%")
}

// color scheme
export const DEFAULT_COLOR_SCHEME = "default"

export let colorScheme: ColorScheme = colorSchemes[0]

function renderColorScheme(settings: SettingsMap) {
  let color = DEFAULT_COLOR_SCHEME
  if (settings.has("c")) {
    color = settings.get("c") ?? DEFAULT_COLOR_SCHEME
  }
  setColorScheme(color)
  select("#color_scheme")
    .on("change", function (event: Event) {
      const target = event.target
      if (!(target instanceof HTMLSelectElement)) return
      setColorScheme(target.value)
      spec.display()
    })
    .selectAll("option")
    .data(colorSchemes)
    .join("option")
    .attr("value", (d: ColorScheme) => d.key)
    .property("selected", (d: ColorScheme) => d.key === color)
    .text((d: ColorScheme) => d.name)
}

function setColorScheme(schemeKey: string): void {
  for (let scheme of colorSchemes) {
    if (scheme.key === schemeKey) {
      colorScheme = scheme
      colorScheme.apply()
      return
    }
  }
}

// buildings

function renderBuildings(settings: SettingsMap) {
  const groupSet = new Set<BuildingGroup>()
  for (let [cat, group] of spec.buildings) {
    if (group.buildings.length > 1) {
      groupSet.add(group)
    }
  }
  spec.resetAutomaticBuildingPreferences()
  if (settings.has("buildings")) {
    let buildingKeys = (settings.get("buildings") ?? "").split(",")
    const selections = new Map<BuildingGroup, Building[]>()
    for (let key of buildingKeys) {
      let building = spec.buildingKeys.get(key)
      if (building === undefined) {
        console.log("unknown building:", key)
        continue
      }
      let group = spec.getBuildingGroup(building)
      if (!selections.has(group)) {
        selections.set(group, [])
      }
      selections.get(group)?.push(building)
    }
    for (let selectedBuildings of selections.values()) {
      const minimum = selectedBuildings[0]
      if (minimum === undefined) continue
      spec.setMinimumBuilding(minimum)
      for (let building of selectedBuildings.slice(1)) {
        spec.setAutomaticBuildingEnabled(building, true)
      }
    }
  }

  // It doesn't really matter how we order these, but pick something just to
  // make it consistent.
  const groups = sorted(groupSet, (g: BuildingGroup) => g.getDefault()?.name ?? "")
  const groupIndex = new Map<Building, number>()
  for (let [i, g] of groups.entries()) {
    for (let building of g.buildings) {
      groupIndex.set(building, i)
    }
  }
  let div = select("#building_selector")
  div.selectAll("*").remove()
  let set = div.selectAll("div").data(groups).join("div").classed("machine-setting", true)
  let options = set
    .selectAll("span")
    .data((group: BuildingGroup) => group.buildings)
    .join("span")
  options
    .append("input")
    .attr("id", (building: Building) => `building-input-${groupIndex.get(building)}-${building.key}`)
    .attr("type", "checkbox")
    .property("checked", (building: Building) => spec.isAutomaticBuildingEnabled(building))
    .on("change", function (event: Event, building: Building) {
      const input = this as HTMLInputElement
      if (!spec.setAutomaticBuildingEnabled(building, input.checked)) {
        select(input).property("checked", true)
        return
      }
      spec.updateSolution()
    })
  options
    .append("label")
    .attr("for", (building: Building) => `building-input-${groupIndex.get(building)}-${building.key}`)
    .append((building: Building) => building.icon.make(32))
}

function renderBuildingOverrides(settings: SettingsMap) {
  for (let recipe of [...spec.buildingOverrides.keys()]) {
    spec.setBuildingOverride(recipe, null)
  }

  let machineString = settings.get("machines")
  if (machineString === undefined || machineString === "") {
    return
  }

  for (let machineSetting of machineString.split(",")) {
    const [recipeKey, buildingKey] = machineSetting.split(":")
    if (recipeKey === undefined || buildingKey === undefined) continue
    const recipe = spec.recipes.get(recipeKey)
    const building = spec.buildingKeys.get(buildingKey)
    if (recipe === undefined || building === undefined || !spec.setBuildingOverride(recipe, building)) {
      console.log("unknown or unavailable recipe machine:", machineSetting)
    }
  }
}

// belt

function beltHandler(_event: Event, belt: Belt): void {
  spec.belt = belt
  if (spec.buildTargets.some((target) => target.basis === "belts")) spec.updateSolution()
  else spec.display()
}

let radioInput = 0
let radioLabel = 0

interface RadioSettingOption {
  readonly key: string
  readonly icon: Icon
}

function radioSetting<
  TOption extends RadioSettingOption,
  GElement extends BaseType,
  TDatum,
  PElement extends BaseType,
  PDatum,
>(
  form: Selection<GElement, TDatum, PElement, PDatum>,
  name: string,
  data: readonly TOption[],
  checked: (option: TOption) => boolean,
  onChange: (event: Event, option: TOption) => void,
): void {
  const option = form.selectAll<HTMLSpanElement, TOption>("span").data(data).join("span")
  option
    .append("input")
    .attr("id", () => `radio-input-${radioInput++}`)
    .attr("type", "radio")
    .attr("name", name)
    .attr("value", (datum: TOption) => datum.key)
    .property("checked", (datum: TOption) => checked(datum))
    .on("change", (event: Event, datum: TOption) => onChange(event, datum))
  option
    .append("label")
    .attr("for", () => `radio-input-${radioLabel++}`)
    .append((datum: TOption) => datum.icon.make(32))
}

function renderBelts(settings: SettingsMap) {
  let beltKey = DEFAULT_BELT
  if (settings.has("belt")) {
    const b = settings.get("belt")
    if (b !== undefined && spec.belts.has(b)) {
      beltKey = b
    } else {
      console.log("unknown belt:", b)
    }
  }
  spec.belt = spec.belts.get(beltKey) ?? null

  const belts = Array.from(spec.belts.values())
  let form = select("#belt_selector")
  form.selectAll("*").remove()
  radioSetting(form, "belt", belts, (belt: Belt) => belt === spec.belt, beltHandler)
}

// fuel

function fuelHandler(_event: Event, fuel: Fuel): void {
  spec.fuel = fuel
  spec.updateSolution()
}

function renderFuel(settings: SettingsMap) {
  let fuelKey = DEFAULT_FUEL
  if (settings.has("fuel")) {
    const f = settings.get("fuel")
    if (f !== undefined && requireFuels().has(f)) {
      fuelKey = f
    } else {
      console.log("unknown fuel:", f)
    }
  }
  spec.fuel = requireFuels().get(fuelKey) ?? null

  const fuels = Array.from(requireFuels().values())
  let form = select("#fuel_selector")
  form.selectAll("*").remove()
  radioSetting(form, "fuel", fuels, (fuel: Fuel) => fuel === spec.fuel, fuelHandler)
}

// visualizer

function renderVisualizer(settings: SettingsMap) {
  if (settings.has("vt")) {
    setVisualizerType(settings.get("vt") ?? DEFAULT_VISUALIZER)
  } else {
    setVisualizerType(DEFAULT_VISUALIZER)
  }
  select(`#${visualizerType}_type`).property("checked", true)
  if (settings.has("vr")) {
    setVisualizerRender(settings.get("vr") ?? DEFAULT_RENDER)
  } else {
    setVisualizerRender(DEFAULT_RENDER)
  }
  select(`#${visualizerRender}_render`).property("checked", true)
  if (settings.has("vd")) {
    setVisualizerDirection(settings.get("vd") ?? getDefaultVisualizerDirection())
  } else {
    setVisualizerDirection(getDefaultVisualizerDirection())
  }
  select(`#${visualizerDirection}_direction`).property("checked", true)
}

// default module

class DefaultModuleInput implements ModuleDropdownOption {
  constructor(
    readonly cell: DefaultModuleCell,
    readonly module: Module | null,
  ) {}

  checked(): boolean {
    return this.module === spec.defaultModule
  }

  choose(): void {
    spec.setDefaultModule(this.module)
    spec.updateSolution()
  }
}

class DefaultModuleCell implements ModuleDropdownCell {
  readonly name = "default_module_dropdown"
  readonly inputRows: readonly (readonly DefaultModuleInput[])[]

  constructor() {
    this.inputRows = moduleRows.map((row) => row.map((module) => new DefaultModuleInput(this, module)))
  }
}

class SecondaryModuleInput implements ModuleDropdownOption {
  constructor(
    readonly cell: SecondaryModuleCell,
    readonly module: Module | null,
  ) {}

  checked(): boolean {
    return this.module === spec.secondaryDefaultModule
  }

  choose(): void {
    spec.setSecondaryDefaultModule(this.module)
    spec.updateSolution()
  }
}

class SecondaryModuleCell implements ModuleDropdownCell {
  readonly name = "secondary_module_dropdown"
  readonly inputRows: readonly (readonly SecondaryModuleInput[])[]

  constructor() {
    this.inputRows = moduleRows.map((row) => row.map((module) => new SecondaryModuleInput(this, module)))
  }
}

function renderDefaultModule(settings: SettingsMap): void {
  const defaultModule = settings.has("dm") ? getModule(settings.get("dm") ?? "null") : null
  spec.setDefaultModule(defaultModule)
  const secondaryModule = settings.has("dm2") ? getModule(settings.get("dm2") ?? "null") : null
  spec.setSecondaryDefaultModule(secondaryModule)

  const defaultCell = new DefaultModuleCell()
  const defaultSelector = select<HTMLElement, unknown>("#default_module")
  defaultSelector.selectAll("*").remove()
  moduleDropdown(defaultSelector, [defaultCell])

  const secondaryCell = new SecondaryModuleCell()
  const secondarySelector = select<HTMLElement, unknown>("#secondary_module")
  secondarySelector.selectAll("*").remove()
  moduleDropdown(secondarySelector, [secondaryCell])
}

class DefaultBeaconInput implements ModuleDropdownOption {
  constructor(
    readonly cell: DefaultBeaconCell,
    readonly module: Module | null,
  ) {}

  checked(): boolean {
    return this.module === spec.defaultBeacon[this.cell.index]
  }

  choose(): void {
    const oldModule = spec.defaultBeacon[this.cell.index] ?? null
    spec.setDefaultBeacon(this.module, this.cell.index)
    if (this.cell.index === 0 && oldModule === spec.defaultBeacon[1]) {
      spec.setDefaultBeacon(this.module, 1)
      selectAll<HTMLInputElement, ModuleDropdownOption>(
        "#default_beacon span.module-wrapper:nth-child(2) input",
      ).property("checked", (datum: ModuleDropdownOption) => this.module === datum.module)
    }
    spec.updateSolution()
  }
}

class DefaultBeaconCell implements ModuleDropdownCell {
  readonly name: string
  readonly inputRows: readonly (readonly DefaultBeaconInput[])[]

  constructor(readonly index: number) {
    this.name = `default_beacon_dropdown_${index}`
    this.inputRows = moduleRows.map((row) =>
      row
        .filter((module) => module === null || module.canBeacon())
        .map((module) => new DefaultBeaconInput(this, module)),
    )
  }
}

function renderDefaultBeacon(settings: SettingsMap): void {
  let defaultBeacon: [Module | null, Module | null] = [null, null]
  let defaultCount = zero
  let legacy = false
  if (settings.has("db")) {
    const keys = (settings.get("db") ?? "").split(":")
    legacy = keys.length === 1
    defaultBeacon = [getModule(keys[0] ?? "null"), getModule(keys[1] ?? "null")]
  }
  if (settings.has("dbc")) defaultCount = Rational.from_string(settings.get("dbc") ?? "0")
  if (legacy) {
    const divmod = defaultCount.divmod(Rational.from_float(2))
    if (divmod.remainder.isZero()) {
      defaultBeacon = [defaultBeacon[0], defaultBeacon[0]]
      defaultCount = divmod.quotient
    }
  }
  defaultBeacon.forEach((module, index) => spec.setDefaultBeacon(module, index))
  spec.setDefaultBeaconCount(defaultCount)

  const cells: readonly ModuleDropdownCell[] = [new DefaultBeaconCell(0), new DefaultBeaconCell(1)]
  const selector = select<HTMLElement, unknown>("#default_beacon")
  selector.selectAll("*").remove()
  moduleDropdown(selector, cells)
  select("#default_beacon_count")
    .attr("value", formatCanadianNumber(defaultCount.toDecimal()))
    .on("change", (event: Event) => {
      const target = event.target
      if (!(target instanceof HTMLInputElement)) return
      spec.setDefaultBeaconCount(Rational.from_string(target.value))
      spec.updateSolution()
    })
}

// Recipe and production-location settings are rendered by the panel above.

// resource priority

function renderResourcePriorities(settings: SettingsMap) {
  spec.setDefaultPriority()
  if (settings.has("priority")) {
    let tiers: [string, Rational][][] | null = []
    let keys = (settings.get("priority") ?? "").split(";")
    outer: for (let tierStr of keys) {
      const tier: [string, Rational][] = []
      for (let pair of tierStr.split(",")) {
        // Backward compatibility: If this is using the old format,
        // ignore the whole thing and bail.
        if (pair.indexOf("=") === -1) {
          console.log("bailing:", pair)
          tiers = null
          break outer
        }
        const [key, weightStr] = pair.split("=")
        if (key === undefined || weightStr === undefined) continue
        if (!spec.isValidPriorityKey(key)) {
          console.log("invalid priority key:", key)
          continue
        }
        tier.push([key, Rational.from_string(weightStr)])
      }
      tiers?.push(tier)
    }
    if (tiers !== null) {
      spec.setPriorities(tiers)
    }
  }
  resourcePrioritiesRendered = false
  unmountResourcePriorityEditor()
}

export function ensureDeferredSettingsRendered(): void {
  if (!recipeSettingsRendered) {
    recipeSettingsRendered = true
    renderRecipeSettings(spec)
  }
}

export function ensureDeferredResourcesRendered(): void {
  if (!resourcePrioritiesRendered) {
    resourcePrioritiesRendered = true
    renderResourcePriorityEditor(spec.priority, () => spec.updateSolution())
  }
}

function renderPlanningSettings(settings: SettingsMap) {
  spec.beltStackSize = Rational.from_string(settings.get("bstack") ?? "1")
  const serializedStackPolicy = settings.get("bstackmode")
  spec.beltStackDefaultPolicy =
    serializedStackPolicy === undefined
      ? settings.has("bstack")
        ? "stacked"
        : "auto"
      : (parseBeltStackSettingPolicy(serializedStackPolicy) ?? "auto")
  spec.beltStackOverrides.clear()
  const stackItemSettings = parseBeltStackItemSettings(settings.get("bstackitems") ?? "")
  if (stackItemSettings !== null) {
    for (const entry of stackItemSettings) {
      const item = spec.items.get(entry.itemKey)
      if (item?.phase === "solid") spec.setBeltStackOverride(item, entry.policy)
    }
  }
  spec.bufferMinutes = Rational.from_string(settings.get("buffer") ?? "1")
  spec.freshnessDelayMinutes = Rational.from_string(settings.get("fresh") ?? "0")
  spec.setMaxQualityLevel(Number(settings.get("maxq") ?? "4"))

  spec.resourceYields.clear()
  let resourceYields = settings.get("ryield")
  if (resourceYields) {
    for (let entry of resourceYields.split(",")) {
      let split = entry.lastIndexOf(":")
      let recipe = spec.recipes.get(entry.slice(0, split))
      if (recipe && split > 0)
        spec.setResourceYield(recipe, Rational.from_string(entry.slice(split + 1)).div(Rational.from_float(100)))
    }
  }
  spec.asteroidLimits.clear()
  let caps = settings.get("astcap")
  if (caps) {
    for (let entry of caps.split(",")) {
      let split = entry.lastIndexOf(":")
      if (split > 0)
        spec.asteroidLimits.set(
          entry.slice(0, split),
          Rational.from_string(entry.slice(split + 1)).div(spec.format.rateFactor),
        )
    }
  }

  spec.recipeLocations.clear()
  let locations = settings.get("rloc")
  if (locations) {
    for (let entry of locations.split(",")) {
      const [recipeKey, locationKey] = entry.split(":")
      if (recipeKey === undefined || locationKey === undefined) continue
      const recipe = spec.recipes.get(recipeKey)
      const location = requireSettingsPlanets().get(locationKey)
      if (recipe && location) spec.setRecipeLocation(recipe, location)
    }
  }

  ;(document.getElementById("belt_stack_size") as HTMLSelectElement).value = spec.beltStackSize.toString()
  ;(document.getElementById("belt_stack_default_policy") as HTMLSelectElement).value = spec.beltStackDefaultPolicy
  ;(document.getElementById("buffer_minutes") as HTMLInputElement).value = spec.bufferMinutes.toDecimal()
  ;(document.getElementById("freshness_delay") as HTMLInputElement).value = spec.freshnessDelayMinutes.toDecimal()
  ;(document.getElementById("max_quality") as HTMLSelectElement).value = String(spec.maxQualityLevel)
  document.querySelectorAll<HTMLInputElement>("[data-resource-key]").forEach((input) => {
    let recipe = spec.recipes.get(input.dataset.resourceKey ?? "")
    let value = recipe ? spec.getResourceYield(recipe) : one
    input.value = value.mul(Rational.from_float(100)).toDecimal()
  })
  document.querySelectorAll<HTMLInputElement>("[data-item-key]").forEach((input) => {
    let value = spec.asteroidLimits.get(input.dataset.itemKey ?? "")
    input.value = value ? value.mul(spec.format.rateFactor).toDecimal() : ""
  })
}

export function renderSettings(settings: SettingsMap) {
  renderTitle(settings)
  renderIgnore(settings)
  renderRateOptions(settings)
  renderPrecisions(settings)
  renderValueFormat(settings)
  renderMiningProd(settings)
  renderRecipeProductivityResearch(settings)
  renderColorScheme(settings)
  renderBuildings(settings)
  renderBelts(settings)
  renderPlanningSettings(settings)
  renderFuel(settings)
  renderVisualizer(settings)
  renderEquipmentQualityDefaults(settings)
  renderDefaultModule(settings)
  renderQualityPlanner(settings)
  renderDefaultBeacon(settings)
  renderResourcePriorities(settings)
  renderRecipeAndLocationSettings(settings)
  renderBuildingOverrides(settings)
  renderTargets(settings)
  renderModules(settings)
  renderEquipmentQualityOverrides(settings)
  renderTab(settings)
}
// endregion settings.ts

// region url/history.ts
export interface UrlHistoryPort {
  readonly hash: string
  readonly pathname: string
  readonly search: string
  replace(url: string): void
}

export class CalculatorUrlHistory {
  private suppressWrites = false

  constructor(private readonly port: UrlHistoryPort) {}

  initialize(): void {
    this.suppressWrites = this.port.hash === ""
  }

  finishInitialization(): void {
    this.suppressWrites = false
  }

  clearHash(): void {
    this.port.replace(`${this.port.pathname}${this.port.search}`)
  }

  sync(settings: string): void {
    if (this.suppressWrites) return
    const nextHash = `#${settings}`
    if (this.port.hash !== nextHash) this.port.replace(nextHash)
  }
}
// endregion url/history.ts

// region url-state.ts
// Browser URL history

const browserHistory = new CalculatorUrlHistory({
  get hash() {
    return window.location.hash
  },
  get pathname() {
    return window.location.pathname
  },
  get search() {
    return window.location.search
  },
  replace(url: string) {
    window.history.replaceState(null, "", url)
  },
})

export function initializeUrlState(): void {
  browserHistory.initialize()
}

export function finishUrlInitialization(): void {
  browserHistory.finishInitialization()
}

export function clearUrlHash(): void {
  browserHistory.clearHash()
}

export function syncUrlHash(settings: string): void {
  browserHistory.sync(settings)
}

// Calculator fragment format

function getModuleKey(module: Module | null): string {
  let moduleKey
  if (module === null) {
    moduleKey = "null"
  } else {
    moduleKey = module.shortName()
  }
  return moduleKey
}

/**
 * Serialize recipe-specific modules without losing their slot positions.
 *
 * Empty placeholders are significant: a customized second slot must remain
 * the second slot after loading even when the first slot still uses the
 * current default module. Trailing default slots are omitted to keep links
 * compact.
 */
export function serializeModuleSettings(factorySpec: FactorySpecification): string[] {
  let settings = []
  for (let [recipe, moduleSpec] of factorySpec.spec) {
    let defaultModule = factorySpec.getDefaultModule(recipe, moduleSpec.building)
    let modules = moduleSpec.modules.map((module) => (module === defaultModule ? "" : getModuleKey(module)))
    while (modules.at(-1) === "") {
      modules.pop()
    }

    let beacon = ""
    let beaconChanged =
      moduleSpec.beaconModules[0] !== factorySpec.defaultBeacon[0] ||
      moduleSpec.beaconModules[1] !== factorySpec.defaultBeacon[1] ||
      !moduleSpec.beaconCount.equal(factorySpec.defaultBeaconCount)
    if (beaconChanged) {
      let beaconKeys = moduleSpec.beaconModules.map(getModuleKey)
      beacon = beaconKeys.join(":") + ":" + moduleSpec.beaconCount.toString()
    }

    if (modules.length > 0 || beaconChanged) {
      let setting = recipe.key + ":" + modules.join(":")
      if (beacon !== "") {
        setting += ";" + beacon
      }
      settings.push(setting)
    }
  }
  return settings.sort()
}

export function serializeBuildingOverrides(factorySpec: FactorySpecification): string[] {
  return [...factorySpec.buildingOverrides].map(([recipe, building]) => `${recipe.key}:${building.key}`).sort()
}

export function serializeMachineQualities(factorySpec: FactorySpecification): string[] {
  return [...factorySpec.machineQualityOverrides].map(([recipe, quality]) => `${recipe.key}:${quality.key}`).sort()
}

export function serializeModuleQualitySettings(factorySpec: FactorySpecification): string[] {
  const settings: string[] = []
  for (const [recipe, moduleSpec] of factorySpec.spec) {
    const moduleQualities = moduleSpec.moduleQualities.map((quality, index) =>
      moduleSpec.moduleQualityOverrides.has(index) ? quality.key : "",
    )
    while (moduleQualities.at(-1) === "") moduleQualities.pop()
    const beaconModuleQualities = moduleSpec.beaconModuleQualities.map((quality, index) =>
      moduleSpec.beaconModuleQualityOverrides.has(index) ? quality.key : "",
    )
    while (beaconModuleQualities.at(-1) === "") beaconModuleQualities.pop()
    const beaconQuality = moduleSpec.beaconQualityOverride ? moduleSpec.beaconQuality.key : ""
    if (moduleQualities.length || beaconModuleQualities.length || beaconQuality) {
      settings.push(`${recipe.key}:${moduleQualities.join(":")};${beaconModuleQualities.join(":")};${beaconQuality}`)
    }
  }
  return settings.sort()
}

export function serializeAutomaticBuildings(factorySpec: FactorySpecification): string[] {
  const buildings: string[] = []
  const groupSet = new Set(factorySpec.buildings.values())
  for (let group of groupSet) {
    const defaultBuildings = group.getDefaults()
    if (
      defaultBuildings.length !== group.selectedBuildings.size ||
      defaultBuildings.some((building) => !group.selectedBuildings.has(building))
    ) {
      for (let building of group.buildings) {
        if (group.selectedBuildings.has(building)) {
          buildings.push(building.key)
        }
      }
    }
  }
  return buildings
}

export function serializeRecipeProductivityLevels(factorySpec: FactorySpecification): string[] {
  return [...factorySpec.recipeProductivityLevels.entries()]
    .filter(([researchKey, level]) => level > 0 && factorySpec.recipeProductivityResearch.has(researchKey))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([researchKey, level]) => `${researchKey}:${level}`)
}

export function serializeBeltStackOverrides(factorySpec: FactorySpecification): string {
  return formatBeltStackItemSettings(
    [...factorySpec.beltStackOverrides]
      .sort(([a], [b]) => a.key.localeCompare(b.key))
      .map(([item, policy]) => ({ itemKey: item.key, policy })),
  )
}

export function formatSettings(
  excludeTitle = false,
  overrideTab: CalculatorTab | null = null,
  targets: Iterable<readonly [Item, Rational]> | null = null,
): string {
  let settings = ""
  if (!excludeTitle && document.title !== DEFAULT_TITLE) {
    settings += "title=" + encodeURIComponent(document.title) + "&"
  }
  settings += "data=" + currentMod() + "&"
  let tab = currentTab
  if (overrideTab) {
    tab = overrideTab
  }
  if (tab !== DEFAULT_TAB) {
    settings += "tab=" + tab + "&"
  }
  if (colorScheme.key !== DEFAULT_COLOR_SCHEME) {
    settings += "c=" + colorScheme.key + "&"
  }
  if (spec.format.rateName !== DEFAULT_RATE) {
    settings += "rate=" + spec.format.rateName + "&"
  }
  if (spec.format.ratePrecision !== DEFAULT_RATE_PRECISION) {
    settings += "rp=" + spec.format.ratePrecision + "&"
  }
  if (spec.format.countPrecision !== DEFAULT_COUNT_PRECISION) {
    settings += "cp=" + spec.format.countPrecision + "&"
  }
  if (spec.format.displayFormat !== DEFAULT_FORMAT) {
    settings += "vf=" + spec.format.displayFormat[0] + "&"
  }
  if (!spec.miningProd.isZero()) {
    let hundred = Rational.from_float(100)
    let mprod = spec.miningProd.mul(hundred).toString()
    settings += "mprod=" + mprod + "&"
  }
  let recipeProductivityLevels = serializeRecipeProductivityLevels(spec)
  if (recipeProductivityLevels.length > 0) {
    settings += "rprod=" + recipeProductivityLevels.join(",") + "&"
  }
  let buildings = serializeAutomaticBuildings(spec)
  if (buildings.length > 0) {
    settings += "buildings=" + buildings.join(",") + "&"
  }
  let machineSettings = serializeBuildingOverrides(spec)
  if (machineSettings.length > 0) {
    settings += "machines=" + machineSettings.join(",") + "&"
  }
  const machineQualities = serializeMachineQualities(spec)
  if (machineQualities.length > 0) settings += "machineq=" + machineQualities.join(",") + "&"
  if (spec.belt !== null && spec.belt.key !== DEFAULT_BELT) {
    settings += "belt=" + spec.belt.key + "&"
  }
  if (!spec.beltStackSize.equal(Rational.from_float(1))) settings += "bstack=" + spec.beltStackSize.toString() + "&"
  const beltStackOverrides = serializeBeltStackOverrides(spec)
  if (
    !spec.beltStackSize.equal(Rational.from_float(1)) ||
    spec.beltStackDefaultPolicy !== "auto" ||
    beltStackOverrides !== ""
  ) {
    settings += "bstackmode=" + spec.beltStackDefaultPolicy + "&"
  }
  if (beltStackOverrides !== "") settings += "bstackitems=" + beltStackOverrides + "&"
  if (!spec.bufferMinutes.equal(Rational.from_float(1))) settings += "buffer=" + spec.bufferMinutes.toString() + "&"
  if (!spec.freshnessDelayMinutes.isZero()) settings += "fresh=" + spec.freshnessDelayMinutes.toString() + "&"
  let resourceYields = [...spec.resourceYields]
    .filter(([recipe, value]) => recipe.categories?.has("basic-fluid") && !value.equal(Rational.from_float(1)))
    .sort(([a], [b]) => a.key.localeCompare(b.key))
    .map(([recipe, value]) => `${recipe.key}:${value.mul(Rational.from_float(100)).toString()}`)
  if (resourceYields.length > 0) settings += "ryield=" + resourceYields.join(",") + "&"
  if (spec.maxQualityLevel !== 4) settings += "maxq=" + spec.maxQualityLevel + "&"
  if (spec.asteroidLimits.size > 0) {
    settings +=
      "astcap=" +
      [...spec.asteroidLimits]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}:${value.mul(spec.format.rateFactor).toString()}`)
        .join(",") +
      "&"
  }
  if (spec.recipeLocations.size > 0) {
    settings +=
      "rloc=" +
      [...spec.recipeLocations]
        .sort(([a], [b]) => a.key.localeCompare(b.key))
        .map(([recipe, location]) => `${recipe.key}:${location.key}`)
        .join(",") +
      "&"
  }
  if (spec.fuel !== null && spec.fuel.key !== DEFAULT_FUEL) {
    settings += "fuel=" + spec.fuel.key + "&"
  }
  if (spec.defaultModule !== null) {
    settings += "dm=" + spec.defaultModule.shortName() + "&"
  }
  if (spec.defaultMachineQuality.key !== "normal") settings += "dmachq=" + spec.defaultMachineQuality.key + "&"
  if (spec.defaultModuleQuality.key !== "normal") settings += "dmq=" + spec.defaultModuleQuality.key + "&"
  if (spec.defaultBeaconQuality.key !== "normal") settings += "dbq=" + spec.defaultBeaconQuality.key + "&"
  const defaultQualityPlannerModule = spec.modules.get(DEFAULT_QUALITY_PLANNER_MODULE_KEY) ?? null
  if (spec.qualityPlannerModule !== defaultQualityPlannerModule) {
    settings += "qpm=" + getModuleKey(spec.qualityPlannerModule) + "&"
  }
  if (spec.qualityPlannerModuleQuality.key !== DEFAULT_QUALITY_PLANNER_MODULE_QUALITY_KEY) {
    settings += "qpmq=" + spec.qualityPlannerModuleQuality.key + "&"
  }
  const defaultQualityPlannerProductivityModule =
    spec.modules.get(DEFAULT_QUALITY_PLANNER_PRODUCTIVITY_MODULE_KEY) ?? null
  if (spec.qualityPlannerProductivityModule !== defaultQualityPlannerProductivityModule) {
    settings += "qppm=" + getModuleKey(spec.qualityPlannerProductivityModule) + "&"
  }
  if (spec.qualityPlannerProductivityModuleQuality.key !== DEFAULT_QUALITY_PLANNER_PRODUCTIVITY_MODULE_QUALITY_KEY) {
    settings += "qppmq=" + spec.qualityPlannerProductivityModuleQuality.key + "&"
  }
  if (spec.qualityPlannerObjective !== "practical") settings += "qpo=" + spec.qualityPlannerObjective + "&"
  if (spec.secondaryDefaultModule !== null) {
    settings += "dm2=" + spec.secondaryDefaultModule.shortName() + "&"
  }
  if (!spec.isDefaultDefaultBeacon()) {
    let parts = []
    for (let module of spec.defaultBeacon) {
      if (module === null) {
        parts.push("null")
      } else {
        parts.push(module.shortName())
      }
    }
    settings += "db=" + parts.join(":") + "&"
  }
  if (!spec.defaultBeaconCount.isZero()) {
    settings += "dbc=" + spec.defaultBeaconCount.toDecimal(0) + "&"
  }
  if (visualizerType !== DEFAULT_VISUALIZER) {
    settings += "vt=" + visualizerType + "&"
  }
  if (visualizerRender !== DEFAULT_RENDER) {
    settings += "vr=" + visualizerRender + "&"
  }
  if (!isDefaultVisualizerDirection()) {
    settings += "vd=" + visualizerDirection + "&"
  }

  settings += "items="
  const targetStrings: string[] = []
  if (targets) {
    for (let [item, rate] of targets) {
      targetStrings.push(`${item.key}:r:${rate.mul(spec.format.rateFactor).toString()}`)
    }
  } else {
    for (let target of spec.buildTargets) {
      let mode: "f" | "r" | "b"
      let value: string
      if (target.changedBuilding) {
        mode = "f"
        value = target.getBuildingCountInput()
      } else if (target.basis === "belts") {
        mode = "b"
        value = target.getBeltCountInput()
      } else {
        mode = "r"
        value = target.rate.mul(spec.format.rateFactor).toString()
      }
      targetStrings.push(
        formatTargetSetting({
          itemKey: target.itemKey,
          mode,
          value,
          recipeKey:
            mode === "f" && target.recipe !== null && target.recipe !== target.defaultRecipe ? target.recipe.key : null,
          qualityLevel: target.qualityLevel,
          qualityStrategy: target.qualityStrategy,
        }),
      )
    }
  }
  settings += targetStrings.join(",")

  let ignore = []
  for (let item of spec.ignore) {
    ignore.push(item.key)
  }
  if (ignore.length > 0) {
    settings += "&ignore=" + ignore.sort().join(",")
  }

  if (!spec.isDefaultPlanet()) {
    let planets = []
    for (let p of sorted(spec.selectedPlanets, (p) => p.order)) {
      planets.push(p.key)
    }
    settings += "&planet=" + planets.join(",")
  }
  let { disable, enable } = spec.getNetDisable()
  if (disable.size !== 0) {
    let parts = []
    for (let d of disable) {
      parts.push(d.key)
    }
    settings += "&disable=" + parts.sort().join(",")
  }
  if (enable.size !== 0) {
    let parts = []
    for (const d of enable) {
      parts.push(d.key)
    }
    settings += "&enable=" + parts.sort().join(",")
  }

  let moduleSettings = serializeModuleSettings(spec)
  if (moduleSettings.length > 0) {
    settings += "&modules=" + moduleSettings.join(",")
  }
  const moduleQualitySettings = serializeModuleQualitySettings(spec)
  if (moduleQualitySettings.length > 0) settings += "&moduleq=" + moduleQualitySettings.join(",")

  if (!spec.isDefaultPriority()) {
    let priority = []
    for (let level of spec.priority) {
      let keys = []
      for (let { recipe, weight } of level) {
        keys.push(`${recipe.key}=${weight.toString()}`)
      }
      priority.push(keys.join(","))
    }
    settings += "&priority=" + priority.join(";")
  }

  return compressCalculatorSettings(settings, {
    encode: (binary) => window.btoa(binary),
    decode: (encoded) => window.atob(encoded),
  })
}

export function loadSettings(fragment: string): Map<string, string> {
  return parseCalculatorFragment(fragment, {
    encode: (binary) => window.btoa(binary),
    decode: (encoded) => window.atob(encoded),
  })
}
// endregion url-state.ts

// region results/grouping.ts
export type RecipeGroup = Set<FactoryRecipe>
type RecipeGroupMap = Map<FactoryRecipe, RecipeGroup>

export function isFactoryRecipe(recipe: SolverRecipe): recipe is FactoryRecipe {
  return recipe instanceof Recipe || recipe instanceof DisabledRecipe
}

export function isItem(item: SolverItem): item is Item {
  return item instanceof Item
}

function neighbors(groupMap: RecipeGroupMap, group: RecipeGroup): Set<RecipeGroup> {
  const result = new Set<RecipeGroup>()
  for (const recipe of group) {
    const ingredients = [...recipe.getIngredients()].reverse()
    for (const ingredient of ingredients) {
      if (!isItem(ingredient.item)) continue
      for (const subRecipe of ingredient.item.allRecipes()) {
        const neighbor = groupMap.get(subRecipe)
        if (neighbor !== undefined) result.add(neighbor)
      }
    }
  }
  result.delete(group)
  return result
}

function visitRecipeGroups(
  groupMap: RecipeGroupMap,
  group: RecipeGroup,
  result: Set<RecipeGroup>,
  seen: Set<RecipeGroup>,
): void {
  if (result.has(group) || seen.has(group)) return
  seen.add(group)
  for (const neighbor of neighbors(groupMap, group)) visitRecipeGroups(groupMap, neighbor, result, seen)
  seen.delete(group)
  result.add(group)
}

export function topoSort(groups: ReadonlySet<RecipeGroup>): RecipeGroup[] {
  const groupMap: RecipeGroupMap = new Map()
  for (const group of groups) {
    for (const recipe of group) groupMap.set(recipe, group)
  }
  const result = new Set<RecipeGroup>()
  const seen = new Set<RecipeGroup>()
  for (const group of groups) {
    if (!result.has(group) && !seen.has(group)) visitRecipeGroups(groupMap, group, result, seen)
  }
  return [...result].reverse()
}

export function getRecipeGroups(recipes: ReadonlySet<FactoryRecipe>): Set<RecipeGroup> {
  const groups = new Map<FactoryRecipe, RecipeGroup>()
  const items = new Set<Item>()
  for (const recipe of recipes) {
    if (recipe.products.length === 0) continue
    groups.set(recipe, new Set([recipe]))
    for (const product of recipe.products) {
      if (isItem(product.item)) items.add(product.item)
    }
  }
  for (const item of items) {
    const itemRecipes = item.allRecipes().filter((recipe) => recipes.has(recipe))
    if (itemRecipes.length <= 1) continue
    const combined = new Set<FactoryRecipe>()
    for (const recipe of itemRecipes) {
      for (const groupedRecipe of groups.get(recipe) ?? []) combined.add(groupedRecipe)
    }
    for (const recipe of combined) groups.set(recipe, combined)
  }
  return new Set(groups.values())
}
// endregion results/grouping.ts

// region results/summary.ts
function hasQualityModules(moduleSpec: ModuleSpec | null): boolean {
  return moduleSpec?.modules.some((module) => module?.category === "quality") ?? false
}

export interface FactorySummary {
  readonly exactMachines: Rational
  readonly placedMachines: Rational
  readonly electricalPower: Rational
  readonly fuelRates: ReadonlyMap<Fuel, Rational>
  readonly recipeCount: number
  readonly ambiguousRecipeCount: number
  readonly qualityRecipeCount: number
  readonly beaconedRecipeCount: number
  readonly selectedLocations: readonly Planet[]
  readonly importedItems: readonly Item[]
  readonly planning: ReturnType<typeof getPlanningSummary>
}

export function getFactorySummary(specification: FactorySpecification, totals: Totals): FactorySummary {
  let exactMachines = zero
  let placedMachines = zero
  let electricalPower = zero
  const fuelRates = new Map<Fuel, Rational>()
  let recipeCount = 0
  let ambiguousRecipeCount = 0
  let qualityRecipeCount = 0
  let beaconedRecipeCount = 0

  for (const [solverRecipe, rate] of totals.rates) {
    if (!(solverRecipe instanceof Recipe) || !solverRecipe.isReal()) continue
    const recipe = solverRecipe
    recipeCount++
    const building = specification.getBuilding(recipe)
    if (building === null) continue

    const count = specification.getCount(recipe, rate)
    exactMachines = exactMachines.add(count)
    placedMachines = placedMachines.add(count.ceil())

    const { fuel, power } = specification.getPowerUsage(recipe, rate)
    if (fuel === "electric") {
      electricalPower = electricalPower.add(power)
    } else if (fuel !== null) {
      const recipeFuel = specification.getFuelForRecipe(recipe)
      if (recipeFuel !== null) {
        fuelRates.set(recipeFuel, (fuelRates.get(recipeFuel) ?? zero).add(power.div(recipeFuel.value)))
      }
    }

    if (getRecipeLocations(specification, recipe, building).length > 1) ambiguousRecipeCount++
    const moduleSpec = specification.getModuleSpec(recipe)
    if (hasQualityModules(moduleSpec)) qualityRecipeCount++
    if (
      moduleSpec !== null &&
      !moduleSpec.beaconCount.isZero() &&
      moduleSpec.beaconModules.some((module) => module !== null)
    ) {
      beaconedRecipeCount++
    }
  }

  const planning = getPlanningSummary(specification, totals)
  for (const plan of planning.qualityPlans) {
    exactMachines = exactMachines.add(plan.totalMachineCount)
    placedMachines = placedMachines.add(
      plan.operations.reduce((total, operation) => total.add(operation.machineCount.ceil()), zero),
    )
    electricalPower = electricalPower.add(plan.totalPower)
    recipeCount += plan.operations.length
    qualityRecipeCount += plan.operations.filter((operation) =>
      operation.configuration.modules.some((module) => module?.category === "quality"),
    ).length
    beaconedRecipeCount += plan.operations.filter(
      (operation) =>
        !operation.configuration.beaconCount.isZero() &&
        operation.configuration.beaconModules.some((module) => module !== null),
    ).length
  }

  const selectedLocations = [...specification.selectedPlanets].sort((a, b) => a.order.localeCompare(b.order))
  const importedItems = [...specification.ignore]
    .filter((item) => totals.items.has(item))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    exactMachines,
    placedMachines,
    electricalPower,
    fuelRates,
    recipeCount,
    ambiguousRecipeCount,
    qualityRecipeCount,
    beaconedRecipeCount,
    selectedLocations,
    importedItems,
    planning,
  }
}
// endregion results/summary.ts

// region results.ts
function requireNode<TNode extends Node>(node: TNode | null, label: string): TNode {
  if (node === null) throw new Error(`Unable to create ${label}`)
  return node
}

function getMapValue<TKey, TValue>(map: ReadonlyMap<TKey, TValue>, key: TKey): TValue | undefined {
  return map.get(key)
}

// Row recipe selector

let openItemKey: string | null = null
let dismissHandlerInstalled = false
const recipeSelectorInstances = new Set<Instance>()

function closeAll(except: Instance | null = null): void {
  if (except === null) {
    openItemKey = null
  }
  for (let instance of recipeSelectorInstances) {
    if (instance !== except) {
      instance.hide()
    }
  }
}

function installDismissHandler(): void {
  if (dismissHandlerInstalled) {
    return
  }
  dismissHandlerInstalled = true
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAll()
    }
  })
}

interface RecipeSelectorRow {
  readonly item: Item
  readonly recipe: Recipe
}

export function makeRecipeSelector(row: RecipeSelectorRow): HTMLElement | null {
  const recipes = getItemProductionRecipes(row.item)
  if (recipes.length === 0) return null

  installDismissHandler()
  const details = create("details").classed("recipe-selector", true).property("open", false)
  const summary = details
    .append("summary")
    .attr("data-tooltip", `Enable or disable recipes for ${row.item.name}.`)
    .attr("aria-label", `Enable or disable recipes for ${row.item.name}.`)
    .on("click", (event: Event) => event.preventDefault())
  summary.append(() => row.item.icon.make(32, true))

  let menu: HTMLDivElement | null = null
  const ensureMenu = (instance: Instance): void => {
    if (menu !== null) {
      instance.setContent(menu)
      return
    }
    const createdMenu = create("div").classed("recipe-selector-menu", true)
    menu = requireNode(createdMenu.node(), "recipe selector menu")
    createdMenu.append("div").classed("recipe-selector-title", true).text(`Recipes for ${row.item.name}`)
    const groups = createdMenu
      .selectAll<HTMLElement, RecipeSelectorGroup>("section.recipe-selector-group")
      .data(getRecipeSelectorGroups(recipes, row.recipe), (entry: RecipeSelectorGroup) => entry.key)
      .join("section")
      .classed("recipe-selector-group", true)
    groups
      .append("div")
      .classed("recipe-selector-group-title", true)
      .text((entry: RecipeSelectorGroup) => entry.name)
    const options = groups
      .selectAll<HTMLLabelElement, Recipe>("label")
      .data((entry: RecipeSelectorGroup) => entry.recipes)
      .join("label")
      .classed("recipe-selector-option", true)
      .classed("active", (recipe: Recipe) => recipe === row.recipe)
    options
      .append("input")
      .attr("type", "checkbox")
      .property("checked", (recipe: Recipe) => !spec.disable.has(recipe))
      .on("change", (event: Event, recipe: Recipe) => {
        event.stopPropagation()
        const target = event.target
        if (!(target instanceof HTMLInputElement)) return
        openItemKey = row.item.key
        setRecipeEnabled(spec, recipe, target.checked)
        refreshRecipeSettings(spec)
        spec.updateSolution()
      })
    options.append((recipe: Recipe) => recipe.icon.make(32))
    options.append("span").text((recipe: Recipe) => {
      const recipeDetails: string[] = []
      if (!recipe.time.isZero()) recipeDetails.push(`${formatCanadianNumber(recipe.time.toDecimal())} s`)
      if (spec.selectedPlanets.size > 0) {
        const count = getRecipeLocations(spec, recipe, spec.getBuilding(recipe)).length
        recipeDetails.push(`${count} selected location${count === 1 ? "" : "s"}`)
      }
      return recipeDetails.length > 0 ? `${recipe.name} — ${recipeDetails.join(", ")}` : recipe.name
    })
    instance.setContent(requireNode(createdMenu.node(), "recipe selector menu"))
  }

  const detailsNode = requireNode(details.node(), "recipe selector")
  const instance = makePopover(detailsNode, " ", {
    appendTo: () => document.body,
    arrow: false,
    offset: [0, 8],
    placement: "right-start",
    showOnCreate: openItemKey === row.item.key,
    theme: "factorio-menu",
    onShow(instance) {
      ensureMenu(instance)
      closeAll(instance)
      openItemKey = row.item.key
      details.property("open", true)
    },
    onHide() {
      details.property("open", false)
      if (document.body.contains(detailsNode) && openItemKey === row.item.key) openItemKey = null
    },
    onDestroy(instance) {
      recipeSelectorInstances.delete(instance)
    },
  })
  recipeSelectorInstances.add(instance)
  return detailsNode
}

let machineSelectorCount = 0

interface MachineOption {
  readonly building: Building | null
  readonly displayBuilding: Building
  readonly label: string
}

interface MachineSelectorRow {
  readonly recipe: Recipe
  readonly building: Building
}

function makeMachineSelector(row: MachineSelectorRow, compatibleBuildings: readonly Building[]): HTMLElement {
  const automaticBuilding = spec.getAutomaticBuilding(row.recipe) ?? row.building
  const override = spec.getBuildingOverride(row.recipe)
  const label = (building: Building): string => {
    const details: string[] = []
    if (!building.speed.isZero()) details.push(`speed ${formatCanadianNumber(building.speed.toDecimal())}`)
    details.push(`${building.moduleSlots} module slot${building.moduleSlots === 1 ? "" : "s"}`)
    return `${building.name} — ${details.join(", ")}`
  }
  const options: MachineOption[] = [
    { building: null, displayBuilding: automaticBuilding, label: `Automatic (${label(automaticBuilding)})` },
    ...(compatibleBuildings.length > 1 || override !== null
      ? compatibleBuildings.map((building) => ({ building, displayBuilding: building, label: label(building) }))
      : []),
  ]

  const root = create("span")
    .classed("machine-selector", true)
    .attr("aria-label", `Choose a machine for ${row.recipe.name}`)
  const dropdown = makeDropdown(root).classed("machine-dropdown", true)
  const quality = spec.getMachineQuality(row.recipe)
  const hasQualityChoices = row.building.supportsEquipmentQuality() && spec.getAvailableQualities().length > 1
  if (hasQualityChoices) {
    dropdown
      .append("div")
      .classed("equipment-quality-strip", true)
      .attr("aria-label", "Machine quality")
      .selectAll<HTMLButtonElement, Quality>("button")
      .data(spec.getAvailableQualities())
      .join("button")
      .attr("type", "button")
      .style("--quality-color", (option) => option.color)
      .classed("selected", (option) => option === quality)
      .attr("aria-label", (option) => `${option.name} quality`)
      .attr("title", (option) => `${option.name} quality`)
      .each(function (option) {
        this.replaceChildren(option.icon.make(20, true))
      })
      .on("click", (event: MouseEvent, option) => {
        event.stopPropagation()
        closeDropdowns()
        globalThis.setTimeout(() => {
          spec.setMachineQuality(row.recipe, option)
          spec.updateSolution()
        }, 0)
      })
  }
  const choices = dropdown
    .selectAll<HTMLDivElement, MachineOption>("div.machine-option")
    .data(options)
    .join("div")
    .classed("machine-option", true)
  const labels = addInputs(
    choices,
    `machine-selector-${machineSelectorCount++}`,
    (option) => option.building === override,
    (option) => {
      if (spec.setBuildingOverride(row.recipe, option.building)) spec.updateSolution()
    },
  )
  labels.append(function (option: MachineOption) {
    const iconQuality = hasQualityChoices && option.building === override ? quality : null
    const machineName = formatEquipmentName(option.displayBuilding.name)
    return makeQualityIcon(option.displayBuilding.icon, iconQuality, {
      label: iconQuality === null ? machineName : `${iconQuality.name} ${machineName}`,
      tooltip: null,
      badgeTitle: `${quality.name} machine quality`,
    })
  })
  labels
    .append("span")
    .classed("machine-option-name", true)
    .text((option: MachineOption) => option.label)
  return requireNode(root.node(), "machine selector")
}
export { powerRepresentation as powerRepr }

function alignPower(value: Rational): string {
  if (value.isZero()) return "0 W"
  const { power, suffix } = powerRepresentation(value)
  return `${spec.format.alignCount(power)} ${suffix}`
}

type HeaderAlignment = "left" | "right" | "center"

class Header {
  constructor(
    readonly text: string,
    readonly colspan: number,
    readonly surplus = false,
    readonly title: string | null = null,
    readonly icon: Icon | null = null,
    readonly align: HeaderAlignment = "right",
  ) {}
}

function setLength<TValue>(values: TValue[], length: number, createValue: () => TValue): void {
  if (values.length > length) values.length = length
  while (values.length < length) values.push(createValue())
}

class BreakdownRow {
  constructor(
    readonly item: Item,
    readonly recipe: Recipe,
    readonly rate: Rational,
    readonly building: Building | null,
    readonly count: Rational | null,
    readonly percent: string | null = null,
    readonly divider = false,
  ) {}
}

function getBreakdown(item: Item, totals: Totals): BreakdownRow[] {
  const rows: BreakdownRow[] = []
  let found = false
  for (const recipe of item.recipes) {
    if (!totals.rates.has(recipe)) continue
    for (const ingredient of recipe.getIngredients()) {
      if (!isItem(ingredient.item)) continue
      const rate = totals.consumers.get(ingredient.item)?.get(recipe)
      if (rate === undefined) continue
      let building: Building | null = null
      let count: Rational | null = null
      const producers = totals.producers.get(ingredient.item)
      if (producers?.size === 1) {
        const producer = producers.keys().next().value
        if (producer instanceof Recipe) {
          const recipeRate = rate.div(producer.gives(ingredient.item))
          building = spec.getBuilding(producer)
          count = spec.getCount(producer, recipeRate)
        }
      }
      rows.push(new BreakdownRow(ingredient.item, recipe, rate, building, count))
      found = true
    }
  }

  const producers = totals.producers.get(item)
  const singleProducer = producers?.size === 1 ? producers.keys().next().value : undefined
  const singleRecipe = singleProducer instanceof Recipe ? singleProducer : null
  const amount = singleRecipe?.gives(item) ?? null
  const building = singleRecipe === null ? null : spec.getBuilding(singleRecipe)
  const itemConsumers = totals.consumers.get(item)
  const itemTotal = totals.items.get(item)
  if (itemConsumers === undefined || itemTotal === undefined || itemTotal.isZero()) return rows
  const hundred = Rational.from_float(100)
  for (const [consumer, rate] of itemConsumers) {
    if (!(consumer instanceof Recipe)) continue
    let count: Rational | null = null
    if (singleRecipe !== null && amount !== null) count = spec.getCount(singleRecipe, rate.div(amount))
    const percent = rate.div(itemTotal).mul(hundred)
    const percentText = percent.less(one) ? "<1%" : `${formatCanadianNumber(percent.toDecimal(0))}%`
    rows.push(new BreakdownRow(item, consumer, rate, building, count, percentText, found))
    found = false
  }
  return rows
}

function formatModuleEffect(label: string, value: Rational): string | null {
  if (value.isZero()) return null
  const sign = value.less(zero) ? "" : "+"
  return `${label} ${sign}${formatCanadianNumber(value.mul(Rational.from_integer(100)).toDecimal())}%`
}

function formatEquipmentName(name: string): string {
  return name.replace(
    /(^|[ -])([a-z])/g,
    (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`,
  )
}

function formatQualifiedModule(module: Module, quality: Quality): string {
  const effects = [
    formatModuleEffect("Speed", module.speedFor(quality)),
    formatModuleEffect("Productivity", module.productivityFor(quality)),
    formatModuleEffect("Quality", module.qualityFor(quality)),
    formatModuleEffect("Energy", module.powerFor(quality)),
    formatModuleEffect("Pollution", module.pollutionFor(quality)),
  ].filter((effect): effect is string => effect !== null)
  return `${quality.name} ${formatEquipmentName(module.name)}${effects.length === 0 ? "" : `\n${effects.join("\n")}`}`
}

class ModuleInput implements ModuleDropdownOption {
  private slot: ModuleSlot | null = null
  module: Module | null = null

  get cell(): ModuleSlot {
    if (this.slot === null) throw new Error("Module input is not attached to a slot")
    return this.slot
  }

  checked(): boolean {
    const cell = this.cell
    return cell.moduleSpec.getModule(cell.index) === this.module
  }

  tooltip(): string | null {
    return this.module === null ? "Empty Module Slot" : formatQualifiedModule(this.module, this.cell.selectedQuality())
  }

  choose(): void {
    const cell = this.cell
    const toUpdate = [cell.index]
    if (cell.index === 0) {
      const modules = cell.moduleSpec.modules
      const oldModule = modules[cell.index]
      for (let index = 1; index < modules.length; index++) {
        if (modules[index] === oldModule) toUpdate.push(index)
      }
    }
    let needsRecalculation = false
    for (const index of toUpdate) {
      needsRecalculation = cell.moduleSpec.setModule(index, this.module) || needsRecalculation
    }
    if (needsRecalculation || spec.isFactoryTarget(cell.moduleSpec.recipe)) spec.updateSolution()
    else spec.display()
  }

  setData(slot: ModuleSlot, module: Module | null): void {
    this.slot = slot
    this.module = module
  }
}

let slotCount = 0

class ModuleSlot implements ModuleDropdownCell {
  readonly name = `moduleslot-${slotCount++}`
  moduleSpec: ModuleSpec
  index = 0
  readonly inputRows: ModuleInput[][] = []

  get qualityOptions(): readonly Quality[] {
    const qualities = spec.getAvailableQualities()
    return qualities.length > 1 ? qualities : []
  }

  selectedQuality(): Quality {
    return this.moduleSpec.moduleQualities[this.index] ?? spec.getNormalQuality()
  }

  keepOpenAfterQualitySelection(): boolean {
    return this.moduleSpec.modules[this.index] === null
  }

  pipetteLabel(): string {
    return this.index === 0
      ? "Module 1 — normal selection changes matching slots"
      : `Module ${this.index + 1} — changes this slot`
  }

  applyPipetteSelection(selection: ModulePipetteSelection): "applied" | "incompatible" {
    if (!selection.module.canUse(this.moduleSpec.recipe, this.moduleSpec.building)) return "incompatible"
    let needsRecalculation = this.moduleSpec.setModule(this.index, selection.module)
    needsRecalculation = this.moduleSpec.setModuleQuality(this.index, selection.quality) || needsRecalculation
    if (needsRecalculation || spec.isFactoryTarget(this.moduleSpec.recipe)) spec.updateSolution()
    else spec.display()
    return "applied"
  }

  chooseQuality(quality: Quality): void {
    const toUpdate = [this.index]
    if (this.index === 0) {
      const oldModule = this.moduleSpec.modules[0]
      const oldQuality = this.selectedQuality()
      for (let index = 1; index < this.moduleSpec.modules.length; index++) {
        const slotQuality = this.moduleSpec.moduleQualities[index] ?? spec.getNormalQuality()
        if (this.moduleSpec.modules[index] === oldModule && slotQuality === oldQuality) toUpdate.push(index)
      }
    }
    let needsRecalculation = false
    for (const index of toUpdate) {
      needsRecalculation = this.moduleSpec.setModuleQuality(index, quality) || needsRecalculation
    }
    if (toUpdate.every((index) => this.moduleSpec.modules[index] === null)) return
    if (needsRecalculation || spec.isFactoryTarget(this.moduleSpec.recipe)) spec.updateSolution()
    else spec.display()
  }

  constructor(
    readonly group: DisplayGroup,
    readonly row: DisplayRow,
    moduleSpec: ModuleSpec,
  ) {
    this.moduleSpec = moduleSpec
    setLength(this.inputRows, moduleRows.length, () => [])
  }

  setData(moduleSpec: ModuleSpec, index: number): void {
    this.moduleSpec = moduleSpec
    this.index = index
    for (let rowIndex = 0; rowIndex < this.inputRows.length; rowIndex++) {
      const inputRow = this.inputRows[rowIndex]
      const modules = moduleRows[rowIndex]
      if (inputRow === undefined || modules === undefined) continue
      let inputIndex = 0
      for (const module of modules) {
        if (module !== null && !module.canUse(moduleSpec.recipe, moduleSpec.building)) continue
        const input = inputRow[inputIndex] ?? new ModuleInput()
        if (inputRow[inputIndex] === undefined) inputRow.push(input)
        input.setData(this, module)
        inputIndex++
      }
      inputRow.length = inputIndex
    }
  }
}

class BeaconInput implements ModuleDropdownOption {
  constructor(
    readonly cell: BeaconCell,
    readonly module: Module | null,
  ) {}

  checked(): boolean {
    return this.module === this.cell.row.moduleSpec?.beaconModules[this.cell.index]
  }

  tooltip(): string | null {
    return this.module === null
      ? "Empty Beacon Module Slot"
      : formatQualifiedModule(this.module, this.cell.selectedQuality())
  }

  choose(): void {
    const moduleSpec = this.cell.row.moduleSpec
    if (moduleSpec === null) return
    const toUpdate = [this.cell.index]
    if (this.cell.index === 0 && moduleSpec.beaconModules[0] === moduleSpec.beaconModules[1]) toUpdate.push(1)
    for (const index of toUpdate) moduleSpec.setBeaconModule(this.module, index)
    if (spec.isFactoryTarget(moduleSpec.recipe)) spec.updateSolution()
    else spec.display()
  }
}

let beaconCount = 0

class BeaconCell implements ModuleDropdownCell {
  readonly name = `beaconslot-${beaconCount++}`
  readonly inputRows: BeaconInput[][] = []

  get qualityOptions(): readonly Quality[] {
    const qualities = spec.getAvailableQualities()
    return qualities.length > 1 ? qualities : []
  }

  selectedQuality(): Quality {
    return this.row.moduleSpec?.beaconModuleQualities[this.index] ?? spec.getNormalQuality()
  }

  keepOpenAfterQualitySelection(): boolean {
    const moduleSpec = this.row.moduleSpec
    return moduleSpec !== null && moduleSpec.beaconModules[this.index] === null
  }

  pipetteLabel(): string {
    return `Beacon module ${this.index + 1}`
  }

  applyPipetteSelection(selection: ModulePipetteSelection): "applied" | "incompatible" {
    const moduleSpec = this.row.moduleSpec
    if (
      moduleSpec === null ||
      !selection.module.canBeacon() ||
      !selection.module.canUse(moduleSpec.recipe, moduleSpec.building)
    ) {
      return "incompatible"
    }
    moduleSpec.setBeaconModule(selection.module, this.index)
    moduleSpec.setBeaconModuleQuality(selection.quality, this.index)
    if (spec.isFactoryTarget(moduleSpec.recipe)) spec.updateSolution()
    else spec.display()
    return "applied"
  }

  chooseQuality(quality: Quality): void {
    const moduleSpec = this.row.moduleSpec
    if (moduleSpec === null) return
    const toUpdate = [this.index]
    if (this.index === 0) {
      const oldModule = moduleSpec.beaconModules[0]
      const oldQuality = this.selectedQuality()
      const secondQuality = moduleSpec.beaconModuleQualities[1] ?? spec.getNormalQuality()
      if (moduleSpec.beaconModules[1] === oldModule && secondQuality === oldQuality) toUpdate.push(1)
    }
    for (const index of toUpdate) moduleSpec.setBeaconModuleQuality(quality, index)
    if (toUpdate.every((index) => moduleSpec.beaconModules[index] === null)) return
    if (spec.isFactoryTarget(moduleSpec.recipe)) spec.updateSolution()
    else spec.display()
  }

  constructor(
    readonly row: DisplayRow,
    readonly index: number,
  ) {}

  setData(moduleSpec: ModuleSpec | null): void {
    this.inputRows.length = 0
    if (moduleSpec === null) return
    for (const modules of moduleRows) {
      const inputRow = modules
        .filter(
          (module) => module === null || (module.canBeacon() && module.canUse(moduleSpec.recipe, moduleSpec.building)),
        )
        .map((module) => new BeaconInput(this, module))
      if (inputRow.length > 0) this.inputRows.push(inputRow)
    }
  }
}

class DisplayRow {
  item: Item | null = null
  recipe: FactoryRecipe | null = null
  building: Building | null = null
  moduleSpec: ModuleSpec | null = null
  single = false
  breakdown: BreakdownRow[] | null = null
  readonly slots: ModuleSlot[] = []
  readonly beaconModules: BeaconCell[] = [new BeaconCell(this, 0), new BeaconCell(this, 1)]

  setData(
    item: Item | null,
    recipe: FactoryRecipe | null,
    building: Building | null,
    moduleSpec: ModuleSpec | null,
    single: boolean,
    breakdown: BreakdownRow[] | null,
  ): void {
    this.item = item
    this.recipe = recipe
    this.building = building
    this.moduleSpec = moduleSpec
    this.single = single
    this.breakdown = breakdown
    for (const beaconCell of this.beaconModules) beaconCell.setData(moduleSpec)
  }
}

class DisplayGroup {
  readonly rows: DisplayRow[] = []

  setData(totals: Totals, itemValues: Iterable<Item>, recipeValues: Iterable<FactoryRecipe>): void {
    const items = [...itemValues]
    const recipes = [...recipeValues]
    if (items.length === 0) {
      this.rows.length = 0
      return
    }
    const length = Math.max(items.length, recipes.length)
    setLength(this.rows, length, () => new DisplayRow())
    for (let index = 0; index < length; index++) {
      const row = this.rows[index]
      if (row === undefined) continue
      const item = items[index] ?? null
      const recipe = recipes[index] ?? null
      let building: Building | null = null
      let moduleSpec: ModuleSpec | null = null
      if (recipe instanceof Recipe) {
        building = spec.getBuilding(recipe)
        if (building?.canBeacon()) moduleSpec = spec.getModuleSpec(recipe)
      }
      const moduleSlotCount = moduleSpec?.modules.length ?? 0
      setLength(row.slots, moduleSlotCount, () => {
        if (moduleSpec === null) throw new Error("Cannot create a module slot without a module specification")
        return new ModuleSlot(this, row, moduleSpec)
      })
      if (moduleSpec !== null) {
        for (let slotIndex = 0; slotIndex < moduleSlotCount; slotIndex++)
          row.slots[slotIndex]?.setData(moduleSpec, slotIndex)
      }
      const single = item !== null && recipe !== null && item.key === recipe.key
      row.setData(item, recipe, building, moduleSpec, single, item === null ? null : getBreakdown(item, totals))
    }
  }
}

export function resetDisplay(): void {
  clearModulePipette()
  selectAll("table#totals > tbody").remove()
  displayGroups = []
}

let displayGroups: DisplayGroup[] = []

function getDisplayGroups(totals: Totals): void {
  const recipes = [...totals.rates.keys()].filter(isFactoryRecipe).reverse()
  const groups = topoSort(getRecipeGroups(new Set(recipes)))
  setLength(displayGroups, groups.length, () => new DisplayGroup())
  groups.forEach((group, index) => {
    const items = new Set<Item>()
    for (const recipe of group) {
      for (const product of recipe.products) {
        if (isItem(product.item) && totals.items.has(product.item)) items.add(product.item)
      }
    }
    displayGroups[index]?.setData(totals, items, group)
  })
}

function toggleBreakdownHandler(this: Element): void {
  const row = this.parentElement
  const breakdownRow = row?.nextElementSibling
  if (row === null || breakdownRow === null || breakdownRow === undefined) return
  if (row.classList.contains("breakdown-open")) {
    row.classList.remove("breakdown-open")
    breakdownRow.classList.remove("breakdown-open")
  } else {
    row.classList.add("breakdown-open")
    breakdownRow.classList.add("breakdown-open")
  }
}

class ItemIcon implements IconObject {
  readonly name: string
  readonly icon_col: number
  readonly icon_row: number
  readonly icon: Icon
  private readonly extra = create("span")

  constructor(readonly item: Item) {
    this.name = item.name
    this.icon_col = item.icon_col
    this.icon_row = item.icon_row
    this.icon = new Icon(this)
  }

  setText(text: string): void {
    this.extra.text(text)
  }

  renderTooltip(): HTMLElement {
    return this.item.renderTooltip(requireNode(this.extra.node(), "item status"))
  }
}

// All this pipe stuff is legacy code, irrelevant as of 2.0, but we might as
// well keep it around for legacy datasets.

// For pipe segment of the given length, returns maximum throughput as fluid/s.
function pipeThroughput(length: Rational): Rational {
  let R = Rational.from_float
  if (length.equal(zero)) {
    // A length of zero represents a solid line of pumps.
    return R(12000)
  } else if (length.less(R(198))) {
    let numerator = R(50).mul(length).add(R(150))
    let denominator = R(3).mul(length).sub(one)
    return numerator.div(denominator).mul(R(60))
  } else {
    return R(60 * 4000).div(R(39).add(length))
  }
}

// Throughput at which pipe length equation changes.
let pipeThreshold = Rational.from_floats(4000, 236)

// For fluid throughput in fluid/s, returns maximum length of pipe that can
// support it.
function pipeLength(throughput: Rational): Rational | null {
  let R = Rational.from_float
  throughput = throughput.div(R(60))
  if (R(200).less(throughput)) {
    return null
  } else if (R(100).less(throughput)) {
    return zero
  } else if (pipeThreshold.less(throughput)) {
    let numerator = throughput.add(R(150))
    let denominator = R(3).mul(throughput).sub(R(50))
    return numerator.div(denominator)
  } else {
    return R(4000).div(throughput).sub(R(39))
  }
}

// Just hardcode this. It used to be a setting, but now it's defunct.
let minPipeLength = Rational.from_float(17)
let maxPipeThroughput = pipeThroughput(minPipeLength)

function pipeValues(rate: Rational): { pipes: Rational; length: Rational } {
  let pipes = rate.div(maxPipeThroughput).ceil()
  let perPipeRate = rate.div(pipes)
  const maximumLength = pipeLength(perPipeRate)
  const length = maximumLength?.floor() ?? zero
  return { pipes: pipes, length: length }
}

function pipeText(rate: Rational): string {
  if (!usesLegacyCalculation()) {
    return ""
  }
  if (rate.equal(zero)) {
    return " \u00d7 0"
  }
  let { pipes, length } = pipeValues(rate)
  let pipeString = ""
  if (one.less(pipes)) {
    pipeString += " \u00d7 " + formatCanadianNumber(pipes.toDecimal(0))
  }
  pipeString += " \u2264 " + formatCanadianNumber(length.toDecimal(0))
  return pipeString
}

class PipeIcon implements IconObject {
  readonly name: string
  readonly icon_col: number
  readonly icon_row: number
  readonly icon: Icon

  constructor() {
    const item = spec.items.get("pipe")
    if (item === undefined) throw new Error("Missing pipe item")
    this.name = item.name
    this.icon_col = item.icon_col
    this.icon_row = item.icon_row
    this.icon = new Icon(this)
  }
}

function requireResultPlanets(specification: FactorySpecification): ReadonlyMap<string, Planet> {
  if (specification.planets === null) throw new Error("Planet data is not initialized")
  return specification.planets
}

function requireItemRate(map: ReadonlyMap<SolverItem, Rational>, item: Item, label: string): Rational {
  const rate = map.get(item)
  if (rate === undefined) throw new Error(`Missing ${label} rate for ${item.key}`)
  return rate
}

function requireRecipeRate(map: ReadonlyMap<SolverRecipe, Rational>, recipe: FactoryRecipe, label: string): Rational {
  const rate = map.get(recipe)
  if (rate === undefined) throw new Error(`Missing ${label} rate for ${recipe.key}`)
  return rate
}

function requireRowItem(row: DisplayRow): Item {
  if (row.item === null) throw new Error("Display row has no item")
  return row.item
}

function requireRowRecipe(row: DisplayRow): Recipe {
  if (!(row.recipe instanceof Recipe)) throw new Error("Display row has no concrete recipe")
  return row.recipe
}

function requireRowBuilding(row: DisplayRow): Building {
  if (row.building === null) throw new Error("Display row has no building")
  return row.building
}

function requireRowModuleSpec(row: DisplayRow): ModuleSpec {
  if (row.moduleSpec === null) throw new Error("Display row has no module specification")
  return row.moduleSpec
}

function makeLocationSelector(row: DisplayRow): HTMLSelectElement {
  const recipe = requireRowRecipe(row)
  const building = row.building
  const compatible = getCompatibleLocations(spec, recipe, building)
  const configured = spec.recipeLocations.get(recipe) ?? null
  const assigned = configured !== null && compatible.includes(configured) ? configured : null
  const automatic = getAssignedLocation(spec, recipe, building)
  const planets = requireResultPlanets(spec)
  const selector = create("select")
    .classed("recipe-location-selector", true)
    .attr("aria-label", `Choose production location for ${recipe.name}`)
    .on("change", (event: Event) => {
      const target = event.target
      if (!(target instanceof HTMLSelectElement)) return
      const location = target.value === "" ? null : (planets.get(target.value) ?? null)
      spec.setRecipeLocation(recipe, location)
      spec.updateSolution()
    })
  selector
    .append("option")
    .attr("value", "")
    .property("selected", assigned === null)
    .text(`Automatic (${automatic?.name ?? "unavailable"})`)
  selector
    .selectAll<HTMLOptionElement, Planet>("option.location")
    .data(compatible)
    .join("option")
    .classed("location", true)
    .attr("value", (location: Planet) => location.key)
    .property("selected", (location: Planet) => location === assigned)
    .text((location: Planet) => location.name)
  return requireNode(selector.node() as HTMLSelectElement | null, "location selector")
}

function formatLocationNames(locations: readonly Planet[]): string {
  return locations.map((location) => location.name).join(" / ")
}

function getLocationCellText(
  specification: FactorySpecification,
  recipe: FactoryRecipe | null,
  building: Building | null,
): string {
  if (!(recipe instanceof Recipe) || !recipe.isReal()) return ""
  const locations = getRecipeLocations(specification, recipe, building)
  if (locations.length === 0) return "Unavailable"
  if (locations.length === specification.selectedPlanets.size && locations.length > 2) return "Any selected"
  if (locations.length > 2) return `${locations.length} locations`
  return formatLocationNames(locations)
}

function getRocketStatsForRow(row: DisplayRow): RocketLaunchStats | null {
  if (!(row.recipe instanceof Recipe) || row.recipe.key !== "rocket-part") return null
  return row.building instanceof RocketSilo ? row.building.getLaunchStats(spec) : null
}

function getBuildingCountTooltip(row: DisplayRow): string | null {
  const recipe = requireRowRecipe(row)
  const building = requireRowBuilding(row)
  const quality = spec.getMachineQuality(recipe)
  const rocket = getRocketStatsForRow(row)
  if (rocket !== null) {
    const limit = `${spec.format.rate(rocket.animationLaunchRate)} launches/${spec.format.rateName} per silo`
    return rocket.launchLimited
      ? `${quality.name}-quality launch animation limit: ${limit}. More speed does not increase steady-state throughput; productivity still reduces required crafts.`
      : `Maximum ${quality.name.toLowerCase()}-quality buffered launch rate: ${limit}. Current rocket-part crafting is slower than the launch animation.`
  }
  if (building instanceof Miner) {
    const drain = building.getResourceDrainRate(spec, recipe)
    const patchYield = spec.getProdEffect(recipe).div(drain)
    return `${quality.name} ${formatEquipmentName(building.name)}\nResource drain ${formatCanadianNumber(drain.mul(Rational.from_integer(100)).toDecimal())}% per mined unit\nExpected patch yield ×${formatCanadianNumber(patchYield.toDecimal())} at current mining productivity.`
  }
  if (!building.supportsEquipmentQuality()) return null
  const craftingSpeed = building.getRecipeRate(spec, recipe).mul(recipe.time)
  const productivity = spec.getProdEffect(recipe).sub(one)
  return `${quality.name} ${formatEquipmentName(building.name)}\nEffective crafting speed ${formatCanadianNumber(craftingSpeed.toDecimal())}\nProductivity ${formatModuleEffect("", productivity)?.trim() ?? "0%"}`
}

function isLaunchLimitedRow(row: DisplayRow): boolean {
  return getRocketStatsForRow(row)?.launchLimited ?? false
}

interface SummaryCard {
  readonly label: string
  readonly value: string
}

interface QualityPlanMetric {
  readonly label: string
  readonly value: string
}

interface QualityBuildLine {
  readonly stage: string
  readonly recipe: Recipe
  readonly kind: QualityOperationRate["kind"]
  readonly configuration: QualityTierConfiguration
  readonly qualityLevels: Set<number>
  machineCount: Rational
}

const QUALITY_BUILD_STAGE_ORDER = [
  "Local sources",
  "Fluid production",
  "Quality production",
  "Guaranteed-quality crafting",
  "Recycling",
] as const

function formatQualityPercent(value: Rational, precision = 6): string {
  return `${formatCanadianNumber(value.mul(Rational.from_integer(100)).toDecimal(precision))}%`
}

function qualifiedAmountKey(entry: Pick<QualifiedItemAmount, "item" | "qualityLevel">): string {
  return `${entry.item.key}@q${entry.qualityLevel}`
}

function qualifiedAmountLabel(entry: QualifiedItemAmount): string {
  const quality =
    entry.item.phase === "solid" ? `${QUALITY_TIERS[entry.qualityLevel] ?? `Quality ${entry.qualityLevel}`} ` : ""
  return `${quality}${entry.item.name}`
}

function qualifiedAmountQuality(specification: FactorySpecification, entry: QualifiedItemAmount): Quality | null {
  if (entry.item.phase !== "solid") return null
  const quality = specification.qualityTiers[entry.qualityLevel]
  if (quality === undefined) throw new Error(`Missing quality tier ${entry.qualityLevel}`)
  return quality
}

function renderQualifiedAmounts<GElement extends BaseType, TDatum, PElement extends BaseType, PDatum>(
  container: Selection<GElement, TDatum, PElement, PDatum>,
  specification: FactorySpecification,
  amounts: readonly QualifiedItemAmount[],
  emptyText?: string,
): void {
  if (amounts.length === 0) {
    if (emptyText !== undefined) container.append("div").text(emptyText)
    return
  }
  const lines = container
    .selectAll<HTMLDivElement, QualifiedItemAmount>("div.quality-plan-material-line")
    .data(amounts)
    .join("div")
    .classed("quality-plan-material-line", true)
  lines.each(function (entry) {
    const line = select(this)
    const quality = qualifiedAmountQuality(specification, entry)
    const label = qualifiedAmountLabel(entry)
    line.append(() => makeQualityIcon(entry.item.icon, quality, { label }))
    line
      .append("span")
      .classed("quality-plan-material-rate", true)
      .text(`${specification.format.rate(entry.amount)}/${specification.format.rateName}`)
  })
}

function subtractQualifiedAmounts(
  amounts: readonly QualifiedItemAmount[],
  subtract: readonly QualifiedItemAmount[],
): QualifiedItemAmount[] {
  const remaining = new Map(subtract.map((entry) => [qualifiedAmountKey(entry), entry.amount]))
  return amounts.flatMap((entry) => {
    const amount = entry.amount.sub(remaining.get(qualifiedAmountKey(entry)) ?? zero)
    return zero.less(amount) ? [{ ...entry, amount }] : []
  })
}

function moduleLoadoutLabel(configuration: QualityTierConfiguration): string {
  const groups = new Map<string, { count: number; label: string }>()
  for (let index = 0; index < configuration.modules.length; index++) {
    const module = configuration.modules[index]
    if (module === null || module === undefined) continue
    const quality = configuration.moduleQualities[index]?.name ?? "Normal"
    const key = `${quality}::${module.key}`
    const group = groups.get(key) ?? { count: 0, label: `${quality} ${module.name}` }
    group.count++
    groups.set(key, group)
  }
  const modules = [...groups.values()].map(({ count, label }) => `${count} × ${label}`).join(", ")
  const beaconGroups = new Map<string, { count: number; label: string }>()
  for (let index = 0; index < configuration.beaconModules.length; index++) {
    const module = configuration.beaconModules[index]
    if (module === null || module === undefined) continue
    const quality = configuration.beaconModuleQualities[index]?.name ?? "Normal"
    const key = `${quality}::${module.key}`
    const group = beaconGroups.get(key) ?? { count: 0, label: `${quality} ${module.name}` }
    group.count++
    beaconGroups.set(key, group)
  }
  const beacons = [...beaconGroups.values()].map(({ count, label }) => `${count} × ${label}`).join(", ")
  const beacon =
    beacons === "" || configuration.beaconCount.isZero()
      ? ""
      : `${configuration.beaconCount.toDecimal()} × ${configuration.beaconQuality.name} beacon (${beacons})`
  return [modules || "No direct modules", beacon].filter(Boolean).join("; ")
}

function moduleConfigurationLabel(configuration: QualityTierConfiguration): string {
  return `${configuration.machineQuality.name} ${configuration.building?.name ?? "hand crafting"}; ${moduleLoadoutLabel(configuration)}`
}

function qualityPlanDiagnosticMetrics(
  specification: FactorySpecification,
  plan: QualityTargetPlan,
): QualityPlanMetric[] {
  const metrics: QualityPlanMetric[] = [
    {
      label: "Expected target",
      value: `${specification.format.rate(plan.requested)}/${specification.format.rateName}`,
    },
    { label: "First-pass Normal → target", value: formatQualityPercent(plan.firstPassChance) },
    {
      label: "Crafting operations",
      value: `${specification.format.rate(plan.totalCrafts)}/${specification.format.rateName}`,
    },
    {
      label: "Recycling operations",
      value: `${specification.format.rate(plan.totalRecycles)}/${specification.format.rateName}`,
    },
    {
      label: "Machines to place",
      value: specification.format.count(plan.totalMachineCount),
    },
  ]
  const represented = powerRepresentation(plan.totalPower)
  metrics.push({
    label: "Power",
    value: `${specification.format.count(represented.power)} ${represented.suffix}`,
  })
  return metrics
}

function recycledItemName(recipe: Recipe): string {
  return recipe.ingredients.find(({ item }) => item.phase === "solid")?.item.name ?? recipe.name
}

function qualityOperationLabel(operation: Pick<QualityOperationRate, "kind" | "recipe">): string {
  if (operation.kind === "dispose" || operation.kind === "recycle") {
    return `Recycle ${recycledItemName(operation.recipe)}`
  }
  if (operation.kind === "source") {
    if (!operation.recipe.isResource()) return operation.recipe.name
    return operation.recipe.products.some(({ item }) => item.phase !== "solid")
      ? `Pump ${operation.recipe.name}`
      : `Mine ${operation.recipe.name}`
  }
  return operation.recipe.name
}

function qualityBuildStage(operation: QualityOperationRate): string {
  if (operation.kind === "source") return "Local sources"
  if (operation.kind === "recycle" || operation.kind === "dispose") return "Recycling"
  if (operation.recipe.products[0]?.item.phase !== "solid") return "Fluid production"
  return zero.less(operation.configuration.qualityChance) ? "Quality production" : "Guaranteed-quality crafting"
}

function aggregateQualityBuildLines(plan: QualityTargetPlan): QualityBuildLine[] {
  const lines = new Map<string, QualityBuildLine>()
  for (const operation of plan.operations) {
    const stage = qualityBuildStage(operation)
    const configurationKey = moduleConfigurationLabel(operation.configuration)
    const key = `${stage}::${operation.kind}::${operation.recipe.key}::${configurationKey}`
    const existing = lines.get(key)
    if (existing === undefined) {
      lines.set(key, {
        stage,
        recipe: operation.recipe,
        kind: operation.kind,
        configuration: operation.configuration,
        qualityLevels: new Set([operation.qualityLevel]),
        machineCount: operation.machineCount,
      })
      continue
    }
    existing.qualityLevels.add(operation.qualityLevel)
    existing.machineCount = existing.machineCount.add(operation.machineCount)
  }
  return [...lines.values()].sort((left, right) => {
    const stage =
      QUALITY_BUILD_STAGE_ORDER.indexOf(left.stage as (typeof QUALITY_BUILD_STAGE_ORDER)[number]) -
      QUALITY_BUILD_STAGE_ORDER.indexOf(right.stage as (typeof QUALITY_BUILD_STAGE_ORDER)[number])
    if (stage !== 0) return stage
    return (left.recipe.order ?? "").localeCompare(right.recipe.order ?? "")
  })
}

function qualityPlanProfileLabel(specification: FactorySpecification, plan: QualityTargetPlan): string {
  if (plan.profile === "planet") {
    const planetName = specification.planets?.get(plan.planetKey)?.name
    return `${planetName ?? plan.planetKey} practical quality factory`
  }
  return "Vulcanus practical quality factory"
}

function renderQualityEquipment<GElement extends BaseType, Datum, PElement extends BaseType, PDatum>(
  container: Selection<GElement, Datum, PElement, PDatum>,
  configuration: QualityTierConfiguration,
): void {
  const directModules = configuration.modules.flatMap((module, index) => {
    const quality = configuration.moduleQualities[index]
    return module === null || module === undefined || quality === undefined ? [] : [{ module, quality }]
  })
  const beaconModules = configuration.beaconModules.flatMap((module, index) => {
    const quality = configuration.beaconModuleQualities[index]
    return module === null || module === undefined || quality === undefined ? [] : [{ module, quality }]
  })

  if (directModules.length === 0) {
    container.append("span").classed("quality-plan-equipment-empty", true).text("No direct modules")
  } else {
    container
      .append("span")
      .classed("quality-plan-equipment-slots", true)
      .selectAll<HTMLSpanElement, (typeof directModules)[number]>("span.quality-icon")
      .data(directModules)
      .join((enter) =>
        enter.append(({ module, quality }) => {
          const label = `${quality.name} ${formatEquipmentName(module.name)}`
          return makeQualityIcon(module.icon, quality, { label })
        }),
      )
      .classed("quality-plan-equipment-icon", true)
  }

  if (!configuration.beaconCount.isZero() && beaconModules.length > 0) {
    container
      .append("span")
      .classed("quality-plan-beacon-label", true)
      .text(`${configuration.beaconCount.toDecimal()} × ${configuration.beaconQuality.name} beacon`)
    container
      .append("span")
      .classed("quality-plan-equipment-slots", true)
      .selectAll<HTMLSpanElement, (typeof beaconModules)[number]>("span.quality-icon")
      .data(beaconModules)
      .join((enter) =>
        enter.append(({ module, quality }) => {
          const label = `${quality.name} ${formatEquipmentName(module.name)}`
          return makeQualityIcon(module.icon, quality, { label })
        }),
      )
      .classed("quality-plan-equipment-icon", true)
  }
}

function renderMetricGrid<GElement extends BaseType, TDatum, PElement extends BaseType, PDatum>(
  container: Selection<GElement, TDatum, PElement, PDatum>,
  metrics: readonly QualityPlanMetric[],
): void {
  const metric = container
    .append("div")
    .classed("quality-plan-metrics", true)
    .selectAll<HTMLDivElement, QualityPlanMetric>("div")
    .data(metrics)
    .join("div")
    .classed("quality-plan-metric", true)
  metric
    .append("div")
    .classed("quality-plan-metric-value", true)
    .text((entry: QualityPlanMetric) => entry.value)
  metric
    .append("div")
    .classed("quality-plan-metric-label", true)
    .text((entry: QualityPlanMetric) => entry.label)
}

function renderQualityPlans<PElement extends BaseType, PDatum>(
  root: Selection<HTMLElement, unknown, PElement, PDatum>,
  specification: FactorySpecification,
  plans: readonly QualityTargetPlan[],
): void {
  const list = root
    .selectAll<HTMLDivElement, readonly QualityTargetPlan[]>("div.quality-plan-list")
    .data(plans.length === 0 ? [] : [plans])
    .join("div")
    .classed("quality-plan-list", true)

  list
    .selectAll<HTMLDetailsElement, QualityTargetPlan>("details.quality-plan")
    .data(plans)
    .join("details")
    .classed("quality-plan", true)
    .property("open", true)
    .each(function (this: HTMLDetailsElement, plan: QualityTargetPlan) {
      const card = select(this)
      card.selectAll("*").remove()
      const tier = QUALITY_TIERS[plan.qualityLevel] ?? `Quality ${plan.qualityLevel}`
      const summary = card.append("summary").classed("quality-plan-title", true)
      summary.append("span").classed("quality-plan-title-main", true).text(`${tier} ${plan.item.name}`)
      summary
        .append("span")
        .classed("quality-plan-title-rate", true)
        .text(`${specification.format.rate(plan.requested)}/${specification.format.rateName}`)
      const recyclerMachines = plan.operations
        .filter((operation) => operation.kind === "recycle" || operation.kind === "dispose")
        .reduce((total, operation) => total.add(operation.machineCount), zero)
      summary
        .append("span")
        .classed("quality-plan-title-profile", true)
        .text(
          `${qualityPlanProfileLabel(specification, plan)}${recyclerMachines.isZero() ? "" : ` · ${specification.format.count(recyclerMachines)} recyclers`}`,
        )

      const allFresh = [...plan.freshInputs, ...plan.fluidInputs]
      const localFeed = subtractQualifiedAmounts(allFresh, plan.importedInputs)
      const feed = card.append("section").classed("quality-plan-material quality-plan-primary-section", true)
      feed.append("h4").text("Feed")
      renderQualifiedAmounts(
        feed.append("div").classed("quality-plan-lines", true),
        specification,
        localFeed,
        "No local raw inputs",
      )

      if (plan.importedInputs.length > 0) {
        const planetName = specification.planets?.get(plan.planetKey)?.name ?? plan.planetKey
        const imports = card.append("section").classed("quality-plan-imports quality-plan-primary-section", true)
        imports.append("h4").text(`Bring to ${planetName}`)
        renderQualifiedAmounts(
          imports.append("div").classed("quality-plan-lines", true),
          specification,
          plan.importedInputs,
        )
      }

      const build = card.append("section").classed("quality-plan-build quality-plan-primary-section", true)
      build.append("h4").text("Build")
      const buildLines = aggregateQualityBuildLines(plan)
      for (const stageName of QUALITY_BUILD_STAGE_ORDER) {
        const stageLines = buildLines.filter((line) => line.stage === stageName)
        if (stageLines.length === 0) continue
        const stage = build.append("details").classed("quality-plan-build-stage", true)
        const stageMachines = stageLines.reduce((total, line) => total.add(line.machineCount), zero)
        const stageSummary = stage.append("summary")
        stageSummary.append("span").text(stageName)
        stageSummary
          .append("span")
          .classed("quality-plan-build-stage-meta", true)
          .text(
            `${stageLines.length} ${stageLines.length === 1 ? "step" : "steps"}${stageMachines.isZero() ? "" : ` · ${specification.format.count(stageMachines)} machines`}`,
          )
        const rows = stage
          .selectAll<HTMLDivElement, QualityBuildLine>("div.quality-plan-build-line")
          .data(stageLines)
          .join("div")
          .classed("quality-plan-build-line", true)
        const machine = rows.append("div").classed("quality-plan-build-machine", true)
        machine.append("strong").text((line) => {
          const building = line.configuration.building
          const machineName = building === null ? "Hand crafting" : formatEquipmentName(building.name)
          const quality =
            line.configuration.machineQuality.key === "normal" ? "" : `${line.configuration.machineQuality.name} `
          return `${specification.format.count(line.machineCount)} × ${quality}${machineName}`
        })
        machine.append("span").text((line) => ` — ${qualityOperationLabel(line)}`)
        const equipment = rows.append("div").classed("quality-plan-build-equipment", true)
        equipment.each(function (line) {
          renderQualityEquipment(select<HTMLDivElement, QualityBuildLine>(this), line.configuration)
        })
      }

      const routing = card.append("section").classed("quality-plan-routing quality-plan-primary-section", true)
      routing.append("h4").text("Routing")
      const routingLines = [
        `Keep ${tier} ${plan.item.name}.`,
        `Recycle lower-quality products automatically${plan.recyclerRecipe === null ? " where a real recycler route exists" : ""}.`,
      ]
      if (plan.surplusOutputs.length > 0) routingLines.push("Store or route the unavoidable outputs listed in details.")
      routing
        .append("div")
        .classed("quality-plan-lines", true)
        .selectAll("div")
        .data(routingLines)
        .join("div")
        .text((line: string) => line)

      const advanced = card.append("details").classed("quality-plan-advanced", true)
      advanced.append("summary").text("Quality math and full operation rates")
      const advancedBody = advanced.append("div").classed("quality-plan-advanced-body", true)
      const meta = advancedBody.append("div").classed("quality-plan-meta", true)
      meta
        .append("span")
        .text(`Objective: ${plan.objective === "configured" ? "practical configured policy" : plan.objective}`)
      meta.append("span").text("Automatic tier policy")
      renderMetricGrid(advancedBody, qualityPlanDiagnosticMetrics(specification, plan))

      const operationTable = advancedBody.append("table").classed("quality-plan-operations", true)
      const header = operationTable.append("thead").append("tr")
      for (const label of [
        "Operation",
        "Input quality",
        `Rate/${specification.format.rateName}`,
        "Machines",
        "Power",
        "Equipment",
      ]) {
        header.append("th").text(label)
      }
      const rows = operationTable
        .append("tbody")
        .selectAll<HTMLTableRowElement, QualityOperationRate>("tr")
        .data(plan.operations)
        .join("tr")
      rows.append("td").text((operation: QualityOperationRate) => qualityOperationLabel(operation))
      rows
        .append("td")
        .text(
          (operation: QualityOperationRate) =>
            QUALITY_TIERS[operation.qualityLevel] ?? `Quality ${operation.qualityLevel}`,
        )
      rows
        .append("td")
        .classed("numeric", true)
        .text((operation: QualityOperationRate) => specification.format.rate(operation.rate))
      rows
        .append("td")
        .classed("numeric", true)
        .text((operation: QualityOperationRate) => specification.format.count(operation.machineCount))
      rows
        .append("td")
        .classed("numeric", true)
        .text((operation: QualityOperationRate) => {
          const represented = powerRepresentation(operation.power)
          return `${specification.format.count(represented.power)} ${represented.suffix}`
        })
      const equipment = rows
        .append("td")
        .append("div")
        .classed("quality-plan-build-equipment quality-plan-operation-equipment", true)
      equipment
        .append("span")
        .classed("quality-plan-operation-machine", true)
        .text((operation: QualityOperationRate) => {
          const building = operation.configuration.building
          const quality =
            operation.configuration.machineQuality.key === "normal"
              ? ""
              : `${operation.configuration.machineQuality.name} `
          return `${quality}${building === null ? "Hand crafting" : formatEquipmentName(building.name)}`
        })
      equipment.each(function (operation) {
        renderQualityEquipment(select(this), operation.configuration)
      })

      if (plan.surplusOutputs.length > 0) {
        const surplus = advancedBody.append("div").classed("quality-plan-surplus", true)
        surplus.append("h4").text("Unavoidable outputs")
        renderQualifiedAmounts(
          surplus.append("div").classed("quality-plan-lines", true),
          specification,
          plan.surplusOutputs,
        )
      }

      advancedBody
        .append("div")
        .classed("quality-plan-notes", true)
        .selectAll("div")
        .data(plan.warnings)
        .join("div")
        .text((warning: string) => warning)
    })
}

function renderFactorySummary(specification: FactorySpecification, totals: Totals): void {
  const summary = getFactorySummary(specification, totals)
  const root = select<HTMLElement, unknown>("#factory_summary").property("hidden", false)
  const totalPower = summary.electricalPower.add(summary.planning.beaconPower)
  const { power, suffix } = powerRepresentation(totalPower)
  const cards: SummaryCard[] = [
    { label: "Active recipes", value: formatCanadianNumber(String(summary.recipeCount)) },
    { label: "Machines to place", value: formatCanadianNumber(summary.placedMachines.toDecimal(0)) },
    { label: "Electric + beacon power", value: `${specification.format.count(power)} ${suffix}` },
  ]
  if (!summary.planning.pollution.isZero())
    cards.push({ label: "Pollution / min", value: specification.format.count(summary.planning.pollution) })
  if (!summary.planning.spores.isZero())
    cards.push({ label: "Spores / min", value: specification.format.count(summary.planning.spores) })
  if (summary.planning.rocket !== null) {
    cards.push({
      label: `Rocket launches / ${specification.format.rateName}`,
      value: specification.format.rate(summary.planning.rocket.launches),
    })
  }
  if (!summary.planning.aquiloHeat.isZero()) {
    const heat = powerRepresentation(summary.planning.aquiloHeat)
    cards.push({ label: "Aquilo heat", value: `${specification.format.count(heat.power)} ${heat.suffix}` })
  }
  if (summary.planning.transport.length > 0)
    cards.push({
      label: "Cross-location flows",
      value: formatCanadianNumber(String(summary.planning.transport.length)),
    })
  if (summary.importedItems.length > 0)
    cards.push({ label: "Imported items", value: formatCanadianNumber(String(summary.importedItems.length)) })
  const lowest = summary.planning.freshness[0]
  if (lowest !== undefined) {
    cards.push({
      label: "Lowest freshness",
      value: `${formatCanadianNumber((lowest.remaining.toFloat() * 100).toFixed(1))}% · ${lowest.item.name}`,
    })
  }
  for (const [fuel, rate] of [...summary.fuelRates].sort(([fuelA], [fuelB]) => fuelA.name.localeCompare(fuelB.name))) {
    cards.push({
      label: `${fuel.name} / ${specification.format.rateName}`,
      value: specification.format.rate(rate),
    })
  }
  const card = root
    .selectAll<HTMLDivElement, SummaryCard>("div.factory-summary-card")
    .data(cards, (entry: SummaryCard) => entry.label)
    .join("div")
    .classed("factory-summary-card", true)
  card
    .selectAll<HTMLDivElement, SummaryCard>("div.factory-summary-value")
    .data((entry: SummaryCard) => [entry])
    .join("div")
    .classed("factory-summary-value", true)
    .text((entry: SummaryCard) => entry.value)
  card
    .selectAll<HTMLDivElement, SummaryCard>("div.factory-summary-label")
    .data((entry: SummaryCard) => [entry])
    .join("div")
    .classed("factory-summary-label", true)
    .text((entry: SummaryCard) => entry.label)

  const warnings: string[] = []
  if (summary.planning.rocket?.launchLimited) {
    const rocket = summary.planning.rocket
    warnings.push(
      `Rocket silo launch-limited at ${specification.format.rate(rocket.animationLaunchRate)} launches/${specification.format.rateName} per silo; more speed will not increase throughput.`,
    )
  }
  for (const target of summary.planning.qualityTargets) {
    warnings.push(
      `${target.tier} ${target.item.name}: ${formatCanadianNumber((target.probability.toFloat() * 100).toFixed(3))}% first-pass chance; ${specification.format.rate(target.totalProduction)}/${specification.format.rateName} direct crafts if lower-quality outputs are not reused.`,
    )
  }
  if (
    summary.qualityRecipeCount > 0 &&
    summary.planning.qualityTargets.length === 0 &&
    summary.planning.qualityPlans.length === 0
  ) {
    warnings.push("Quality modules selected; choose a target quality to include its yield.")
  }
  const expired = summary.planning.freshness.filter((row) => row.expired)
  if (expired.length > 0)
    warnings.push(`Fully spoiled after the configured delay: ${expired.map((row) => row.item.name).join(", ")}.`)
  const agriculturalScience = summary.planning.freshness.find((row) => row.item.key === "agricultural-science-pack")
  if (agriculturalScience !== undefined && !specification.freshnessDelayMinutes.isZero()) {
    warnings.push(
      `Agricultural science after ${formatCanadianNumber(specification.freshnessDelayMinutes.toDecimal())} min: ${formatCanadianNumber((agriculturalScience.remaining.toFloat() * 100).toFixed(1))}% effective.`,
    )
  }
  for (const row of summary.planning.asteroidConstraints.filter((entry) => entry.exceeded)) {
    warnings.push(
      `${row.item.name} cap exceeded: ${specification.format.rate(row.required)} required vs ${specification.format.rate(row.limit)} available/${specification.format.rateName}.`,
    )
  }
  if (!summary.planning.aquiloHeat.isZero())
    warnings.push("Aquilo heat excludes belts, pipes, inserters, pumps, tanks, and other logistics entities.")

  root
    .selectAll<HTMLDivElement, string>("div.factory-summary-warning")
    .data(warnings)
    .join("div")
    .classed("factory-summary-warning", true)
    .text((warning: string) => warning)

  renderQualityPlans(root, specification, summary.planning.qualityPlans)
}

function getErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null
  const code = error.code
  return typeof code === "string" ? code : null
}

export function displayCalculationError(_specification: FactorySpecification, error: unknown): void {
  const code = getErrorCode(error)
  const rawMessage = error instanceof Error ? error.message : String(error)
  let message = "The current settings could not produce a complete factory."
  let title = "Unable to calculate this factory"
  let guidance = "Check the target values, selected recipes, machines, locations, and resource priorities."

  if (code === "missing-recipe") {
    message = rawMessage
    guidance =
      "Choose a compatible production location above, enable a recipe in Settings, choose another recipe, or click the item icon in the Factory table to treat that item as imported."
  } else if (code === "infeasible") {
    message = "This combination of recipes and resource priorities cannot produce every requested output."
    guidance =
      "Review alternate recipes and resource priorities. A cyclic or multi-output chain may require at least one additional recipe or imported input."
  } else if (
    /cannot produce .* output with the current quality settings|No recipe is available to produce/i.test(rawMessage)
  ) {
    message = rawMessage
  } else if (/integer|number|denominator|divide|invalid/i.test(rawMessage)) {
    title = "Invalid numeric value"
    message = "One of the entered values is not a valid number."
    guidance = "Use a whole number, decimal, or fraction such as 60, 2.5, or 1/3."
  }

  const root = select<HTMLElement, unknown>("#calculation_error").property("hidden", false)
  root.select(".calculation-error-title").text(title)
  root.select(".calculation-error-message").text(message)
  root.select(".calculation-error-guidance").text(guidance)
  select("#factory_summary").property("hidden", true)
  select("table#totals").property("hidden", true)
}

export function displayItems(spec: FactorySpecification, totals: Totals): void {
  const belt = spec.belt
  if (belt === null) throw new Error("Belt data is not initialized")

  select("#calculation_error").property("hidden", true)
  renderFactorySummary(spec, totals)
  getDisplayGroups(totals)
  const table = select<HTMLTableElement, unknown>("table#totals")
  const showFactoryTable = displayGroups.some((group) => group.rows.length > 0)
  table.property("hidden", !showFactoryTable)
  if (!showFactoryTable) {
    table.selectAll("thead th").remove()
    table.selectAll("tbody").remove()
    return
  }

  const showLocations = spec.selectedPlanets.size > 1
  const showSurplus = totals.surplus.size > 0
  const headers: Header[] = [
    new Header("Item", 2, false, null, null, "left"),
    new Header(`Rate / ${spec.format.rateName}`, 1, false, null, null, "right"),
    ...(showSurplus ? [new Header(`Surplus / ${spec.format.rateName}`, 1, true, null, null, "right")] : []),
    new Header("Belts", 1, false, `Select stacking per item; counts use ${belt.name}`, belt.icon, "right"),
    new Header("Machines", 2, false, null, null, "center"),
    ...(showLocations ? [new Header("Location", 1, false, null, null, "left")] : []),
    new Header("Modules", 1, false, null, null, "left"),
    new Header("Beacons", 1, false, null, null, "left"),
    new Header("Power", 1, false, null, null, "right"),
    new Header("", 1, false, null, null, "center"),
  ]
  const totalCols = headers.reduce((sum, header) => sum + header.colspan, 0)

  table.classed("nosurplus", totals.surplus.size === 0)

  const headerRow = table
    .selectAll<HTMLTableRowElement, unknown>("thead tr")
    .classed("factory-header", true)
    .selectAll<HTMLTableCellElement, Header>("th")
    .data(headers)
  headerRow.exit().remove()
  const headerCell = headerRow
    .join("th")
    .classed("surplus", (header: Header) => header.surplus)
    .classed("align-left", (header: Header) => header.align === "left")
    .classed("align-center", (header: Header) => header.align === "center")
    .classed("align-right", (header: Header) => header.align === "right")
    .attr("colspan", (header: Header) => header.colspan)
    .attr("data-tooltip", (header: Header) => header.title)
  headerCell.each(function (this: Element, header: Header) {
    const cell = select(this)
    cell.selectAll("*").remove()
    const icon = header.icon
    if (icon !== null) cell.append(() => icon.make(18)).classed("header-icon", true)
    cell.append("span").text(header.text)
  })

  const rowGroup = table
    .selectAll<HTMLTableSectionElement, DisplayGroup>("tbody")
    .data(displayGroups)
    .join("tbody")
    .classed("display-group", true)
    .classed("multi", (group: DisplayGroup) => group.rows.length > 1)
  rowGroup.selectAll("tr.breakdown").remove()

  const displayRows = rowGroup
    .selectAll<HTMLTableRowElement, DisplayRow>("tr.display-row")
    .data<DisplayRow>((group: DisplayGroup) => group.rows)
    .join((enter) => {
      const rows = enter.append("tr").classed("display-row", true)

      rows
        .append("td")
        .classed("item", true)
        .on("click", function (this: Element) {
          toggleBreakdownHandler.call(this)
        })
        .append("svg")
        .classed("breakdown-arrow", true)
        .attr("viewBox", "0 0 16 16")
        .attr("width", 16)
        .attr("height", 16)
        .append("use")
        .attr("href", "images/icons.svg#right")

      const itemCell = rows.append("td").classed("item item-identity", true)
      const itemToggle = itemCell.append("button").classed("item-import-toggle", true).attr("type", "button")
      itemToggle.append("span").classed("item-icon", true)
      itemToggle.append("span").classed("item-name", true)
      itemToggle.append("span").classed("item-state", true)

      rows.append("td").classed("item right-align", true).append("tt").classed("item-rate", true)
      rows.append("td").classed("item surplus right-align", true).append("tt").classed("surplus-rate", true)
      const logisticsCell = rows.append("td").classed("item right-align logistics-cell pad-right", true)
      logisticsCell.append("tt").classed("belt-count", true)
      const beltStackPolicy = logisticsCell
        .append("select")
        .classed("belt-stack-policy", true)
        .attr("title", "Set belt stacking for this item")
        .on("change", function (this: HTMLSelectElement, _event: Event, row: DisplayRow) {
          const value = this.value
          if (value !== "" && !isBeltStackPolicy(value)) return
          spec.setBeltStackOverride(requireRowItem(row), value === "" ? null : value)
          spec.updateSolution()
        })
      beltStackPolicy.append("option").attr("value", "").text("Default")
      beltStackPolicy.append("option").attr("value", "auto").text("Auto")
      beltStackPolicy.append("option").attr("value", "stacked").text("Stacked")
      beltStackPolicy.append("option").attr("value", "unstacked").text("Unstacked")
      logisticsCell.append("span").classed("belt-stack-height", true)

      rows.append("td").classed("pad building building-icon leftmost right-align", true)
      rows.append("td").classed("right-align building", true).append("tt").classed("building-count", true)
      rows.append("td").classed("location-cell", true)
      rows.append("td").classed("pad building module module-cell", true)

      const beaconCell = rows.append("td").classed("pad building module beacon", true)
      const beaconControls = beaconCell.append("span").classed("beacon-controls", true)
      beaconControls.append("span").classed("beacon-container", true)
      const beaconQuality = beaconControls.append("span").classed("beacon-quality-selector", true)
      beaconQuality.each(function () {
        const selector = select(this)
        makeDropdown(selector)
          .classed("beacon-quality-dropdown", true)
          .append("div")
          .classed("equipment-quality-strip", true)
        selector.select(".dropdownWrapper").append("span").classed("beacon-quality-trigger", true)
      })
      const beaconCountSpan = beaconControls.append("span").classed("beacon-count", true)
      beaconCountSpan.append("span").text(" \u00d7 ")
      beaconCountSpan
        .append("input")
        .attr("type", "text")
        .attr("size", 3)
        .on("change", function (this: Element, event: Event, row: DisplayRow) {
          const target = event.target
          if (!(target instanceof HTMLInputElement)) return
          const moduleSpec = requireRowModuleSpec(row)
          const recipe = requireRowRecipe(row)
          moduleSpec.setBeaconCount(Rational.from_string(target.value))
          if (spec.isFactoryTarget(recipe)) spec.updateSolution()
          else spec.display()
        })

      const powerCell = rows.append("td").classed("right-align building power-cell", true)
      powerCell.append("span").classed("fuel-icon", true)
      powerCell.append("tt").classed("power", true)

      rows
        .append("td")
        .classed("popout pad item", true)
        .append("a")
        .attr("target", "_blank")
        .attr("data-tooltip", "Open this item as a separate plan.")
        .append("svg")
        .classed("popout", true)
        .attr("viewBox", "0 0 24 24")
        .attr("width", 24)
        .attr("height", 24)
        .append("use")
        .attr("href", "images/icons.svg#popout")

      return rows
    })
    .classed("nobuilding", (row: DisplayRow) => row.building === null)
    .classed("nomodule", (row: DisplayRow) => row.moduleSpec === null)
    .classed("noitem", (row: DisplayRow) => row.item === null)
    .classed(
      "target-output",
      (row: DisplayRow) => row.item !== null && spec.buildTargets.some((target) => target.item === row.item),
    )
    .classed("imported-output", (row: DisplayRow) => row.item !== null && spec.ignore.has(row.item))
    .classed("launch-limited", (row: DisplayRow) => isLaunchLimitedRow(row))

  const locationCell = displayRows
    .selectAll<HTMLTableCellElement, DisplayRow>("td.location-cell")
    .classed("hide", !showLocations)
  locationCell.selectAll("*").remove()
  locationCell
    .filter((row: DisplayRow) => row.recipe instanceof Recipe && row.recipe.isReal())
    .append((row: DisplayRow) => makeLocationSelector(row))
  locationCell
    .filter((row: DisplayRow) => !(row.recipe instanceof Recipe) || !row.recipe.isReal())
    .text((row: DisplayRow) => getLocationCellText(spec, row.recipe, row.building))

  const itemRows = displayRows.filter((row: DisplayRow) => row.item !== null)
  const itemToggle = itemRows
    .selectAll<HTMLButtonElement, DisplayRow>("button.item-import-toggle")
    .classed("imported", (row: DisplayRow) => spec.ignore.has(requireRowItem(row)))
    .attr("data-tooltip", (row: DisplayRow) => {
      const item = requireRowItem(row)
      return spec.ignore.has(item) ? `Produce ${item.name} in this plan` : `Treat ${item.name} as imported`
    })
    .attr("aria-label", (row: DisplayRow) => {
      const item = requireRowItem(row)
      return spec.ignore.has(item) ? `Produce ${item.name} in this plan` : `Treat ${item.name} as imported`
    })
    .on("click", (event: Event, row: DisplayRow) => toggleIgnoreHandler(event, { item: requireRowItem(row) }))
  const itemIcon = itemToggle.select<HTMLSpanElement>("span.item-icon")
  itemIcon.selectAll("*").remove()
  itemIcon
    .append((row: DisplayRow) => {
      const item = requireRowItem(row)
      const icon = new ItemIcon(item)
      icon.setText(spec.ignore.has(item) ? "Imported." : "Produced in this plan.")
      return makeQualityIcon(icon.icon, null, {
        label: item.name,
        tooltip: () => icon.renderTooltip(),
      })
    })
    .classed("ignore", (row: DisplayRow) => spec.ignore.has(requireRowItem(row)))
  itemToggle.select<HTMLSpanElement>("span.item-name").text((row: DisplayRow) => requireRowItem(row).name)
  itemToggle.select<HTMLSpanElement>("span.item-state").text((row: DisplayRow) => {
    const item = requireRowItem(row)
    const labels: string[] = []
    if (spec.buildTargets.some((target) => target.item === item)) labels.push("target")
    if (spec.ignore.has(item)) labels.push("imported")
    if (isLaunchLimitedRow(row)) labels.push("launch-limited")
    return labels.join(" · ")
  })
  itemRows.selectAll<HTMLElement, DisplayRow>("tt.item-rate").text((row: DisplayRow) => {
    const item = requireRowItem(row)
    const rate = requireItemRate(totals.items, item, "item")
    const surplus = totals.surplus.get(item) ?? zero
    return spec.format.alignRate(rate.sub(surplus))
  })
  itemRows
    .selectAll<HTMLElement, DisplayRow>("tt.surplus-rate")
    .text((row: DisplayRow) => spec.format.alignRate(totals.surplus.get(requireRowItem(row)) ?? zero))

  const beltRows = itemRows.filter((row: DisplayRow) => requireRowItem(row).phase === "solid")
  beltRows
    .selectAll<HTMLTableCellElement, DisplayRow>("td.logistics-cell")
    .attr("data-tooltip", (row: DisplayRow) => {
      const item = requireRowItem(row)
      const rate = requireItemRate(totals.items, item, "item")
      const logistics = getLogistics(item, rate, spec)
      if (logistics === null) throw new Error(`Missing solid logistics report for ${item.key}`)
      const stackHeight = formatCanadianNumber(spec.getEffectiveBeltStackSize(item).toDecimal())
      const policy = spec.getBeltStackPolicy(item)
      const source = spec.getBeltStackPolicySource(item)
      const policyText =
        policy === "auto"
          ? spec.isItemAutomaticallyBeltStacked(item)
            ? "Auto: direct output"
            : "Auto: unstacked"
          : policy === "stacked"
            ? source === "override"
              ? "Stacked override"
              : "Default: stacked"
            : source === "override"
              ? "Unstacked override"
              : "Default: unstacked"
      const stackLabel = logistics.stackRate.equal(one) ? "stack" : "stacks"
      const slotLabel = logistics.bufferSlots.equal(one) ? "slot" : "slots"
      const wagonLabel = logistics.wagonLoads.equal(one) ? "load" : "loads"
      return `${belt.name} equivalent at ×${stackHeight} (${policyText})\n${spec.format.rate(logistics.stackRate)} inventory ${stackLabel}/${spec.format.rateName}\n${formatCanadianNumber(logistics.bufferSlots.toDecimal(0))} buffer ${slotLabel} (${formatCanadianNumber(spec.bufferMinutes.toDecimal())}m)\n${spec.format.count(logistics.wagonLoads)} wagon ${wagonLabel}/${spec.format.rateName}.`
    })
    .selectAll<HTMLElement, DisplayRow>("tt.belt-count")
    .text((row: DisplayRow) => {
      const item = requireRowItem(row)
      return spec.format.alignCount(spec.getBeltCount(item, requireItemRate(totals.items, item, "item")))
    })
  beltRows
    .selectAll<HTMLSelectElement, DisplayRow>("select.belt-stack-policy")
    .property("hidden", false)
    .attr("aria-label", (row: DisplayRow) => `Belt stacking for ${requireRowItem(row).name}`)
    .property("value", (row: DisplayRow) => {
      const item = requireRowItem(row)
      return spec.getBeltStackPolicySource(item) === "default" ? "" : spec.getBeltStackPolicy(item)
    })
  beltRows
    .selectAll<HTMLElement, DisplayRow>("span.belt-stack-height")
    .property("hidden", false)
    .text(
      (row: DisplayRow) => `×${formatCanadianNumber(spec.getEffectiveBeltStackSize(requireRowItem(row)).toDecimal())}`,
    )

  const pipeRows = itemRows.filter((row: DisplayRow) => requireRowItem(row).phase === "fluid")
  pipeRows.selectAll<HTMLSelectElement, DisplayRow>("select.belt-stack-policy").property("hidden", true)
  pipeRows.selectAll<HTMLElement, DisplayRow>("span.belt-stack-height").property("hidden", true)
  pipeRows
    .selectAll<HTMLTableCellElement, DisplayRow>("td.logistics-cell")
    .attr("data-tooltip", usesLegacyCalculation() ? "Legacy maximum pipe length" : null)
    .selectAll<HTMLElement, DisplayRow>("tt.belt-count")
    .text((row: DisplayRow) => pipeText(requireItemRate(totals.items, requireRowItem(row), "item")))

  const itemBuildingCell = itemRows.selectAll<HTMLTableCellElement, DisplayRow>("td.building-icon")
  itemBuildingCell.selectAll("*").remove()
  itemBuildingCell
    .filter(
      (row: DisplayRow) => getItemProductionRecipes(requireRowItem(row)).length > 0 && row.recipe instanceof Recipe,
    )
    .append((row: DisplayRow) => {
      const selector = makeRecipeSelector({ item: requireRowItem(row), recipe: requireRowRecipe(row) })
      return requireNode(selector, "recipe selector")
    })

  displayRows.selectAll("td.building-icon > :not(.recipe-selector)").remove()
  const buildingRows = displayRows.filter((row: DisplayRow) => row.building !== null && row.recipe instanceof Recipe)
  const buildingCell = buildingRows.selectAll<HTMLTableCellElement, DisplayRow>("td.building-icon")
  buildingCell.append((row: DisplayRow) => {
    const recipe = requireRowRecipe(row)
    const building = requireRowBuilding(row)
    const compatibleBuildings = spec.getCompatibleBuildings(recipe)
    if (!building.supportsEquipmentQuality() && compatibleBuildings.length <= 1) return building.icon.make(32)
    return makeMachineSelector({ recipe, building }, compatibleBuildings)
  })
  buildingCell.append("span").text(" \u00d7")
  buildingRows
    .selectAll<HTMLElement, DisplayRow>("tt.building-count")
    .attr("data-tooltip", getBuildingCountTooltip)
    .text((row: DisplayRow) => {
      const recipe = requireRowRecipe(row)
      return spec.format.alignCount(spec.getCount(recipe, requireRecipeRate(totals.rates, recipe, "recipe")))
    })

  const moduleRowsSelection = displayRows.filter((row: DisplayRow) => row.moduleSpec !== null)
  const moduleCell = moduleRowsSelection.selectAll<HTMLTableCellElement, DisplayRow>("td.module-cell")
  moduleCell.selectAll("*").remove()
  moduleRowsSelection.selectAll("span.beacon-container").selectAll("*").remove()
  moduleDropdown(moduleCell, (row: DisplayRow) => row.slots)
  moduleDropdown(
    moduleRowsSelection.selectAll<HTMLSpanElement, DisplayRow>("span.beacon-container"),
    (row: DisplayRow) => row.beaconModules,
  )
  moduleRowsSelection.selectAll<HTMLSpanElement, DisplayRow>("span.beacon-quality-selector").each(function (row) {
    const selector = select(this)
    const moduleSpec = requireRowModuleSpec(row)
    const quality = moduleSpec.beaconQuality
    selector.property(
      "hidden",
      spec.getAvailableQualities().length <= 1 || moduleSpec.beaconModules.every((module) => module === null),
    )
    selector
      .select(".dropdownWrapper")
      .attr("aria-label", `${quality.name} beacon quality`)
      .attr(
        "data-tooltip",
        `${quality.name} Beacon\n${formatCanadianNumber(getBeaconEffect(quality).mul(Rational.from_integer(100)).toDecimal())}% distribution effectivity\n${formatCanadianNumber(quality.beaconPowerUsageMultiplier.mul(Rational.from_integer(100)).toDecimal())}% base power`,
      )
    selector
      .select<HTMLSpanElement>("span.beacon-quality-trigger")
      .selectAll<HTMLImageElement, Quality>("img")
      .data([quality])
      .join((enter) => enter.append((option) => option.icon.make(20, true)))
      .each(function (option) {
        const icon = option.icon.make(20, true)
        this.style.cssText = icon.style.cssText
      })
    selector
      .select(".equipment-quality-strip")
      .selectAll<HTMLButtonElement, Quality>("button")
      .data(spec.getAvailableQualities())
      .join("button")
      .attr("type", "button")
      .classed("selected", (option) => option === quality)
      .attr("title", (option) => `${option.name} quality`)
      .each(function (option) {
        this.replaceChildren(option.icon.make(20, true))
      })
      .on("click", (event: MouseEvent, option) => {
        event.stopPropagation()
        closeDropdowns()
        globalThis.setTimeout(() => {
          moduleSpec.setBeaconQuality(option)
          if (spec.isFactoryTarget(moduleSpec.recipe)) spec.updateSolution()
          else spec.display()
        }, 0)
      })
  })
  moduleRowsSelection
    .selectAll<HTMLInputElement, DisplayRow>("span.beacon-count input")
    .attr("value", (row: DisplayRow) => spec.format.count(requireRowModuleSpec(row).beaconCount))

  const fuelRows = buildingRows.filter((row: DisplayRow) => requireRowBuilding(row).fuel !== null)
  const fuelIcon = fuelRows.selectAll<HTMLSpanElement, DisplayRow>(".fuel-icon")
  fuelIcon.selectAll("*").remove()
  fuelIcon.append((row: DisplayRow) => {
    const fuel = spec.getFuelForRecipe(requireRowRecipe(row))
    if (fuel === null) throw new Error(`Missing fuel for ${requireRowRecipe(row).key}`)
    return fuel.icon.make(24)
  })
  fuelIcon.append("span").text(" × ")
  fuelRows.selectAll<HTMLElement, DisplayRow>("tt.power").text((row: DisplayRow) => {
    const recipe = requireRowRecipe(row)
    const rate = requireRecipeRate(totals.rates, recipe, "recipe")
    const { power } = spec.getPowerUsage(recipe, rate)
    const recipeFuel = spec.getFuelForRecipe(recipe)
    if (recipeFuel === null) throw new Error(`Missing fuel for ${recipe.key}`)
    return `${spec.format.alignRate(power.div(recipeFuel.value))}/${spec.format.rateName}`
  })

  const electricRows = buildingRows.filter((row: DisplayRow) => requireRowBuilding(row).fuel === null)
  electricRows.selectAll(".fuel-icon").selectAll("*").remove()
  electricRows.selectAll<HTMLElement, DisplayRow>("tt.power").text((row: DisplayRow) => {
    const recipe = requireRowRecipe(row)
    const rate = requireRecipeRate(totals.rates, recipe, "recipe")
    return alignPower(spec.getPowerUsage(recipe, rate).power)
  })
  refreshRecipeSettings(spec)

  itemRows.selectAll<HTMLAnchorElement, DisplayRow>("td.popout a").attr("href", (row: DisplayRow) => {
    const item = requireRowItem(row)
    const rate = requireItemRate(totals.items, item, "item")
    const rates: readonly (readonly [Item, Rational])[] = [[item, rate]]
    return `#${formatSettings(true, "totals", rates)}`
  })

  const rowsWithBreakdowns = displayRows.filter((row: DisplayRow) => row.breakdown !== null)
  const breakdownContainers = rowsWithBreakdowns
    .select<HTMLTableRowElement>(function (this: Element) {
      const breakdown = document.createElement("tr")
      this.parentElement?.insertBefore(breakdown, this.nextSibling)
      return breakdown
    })
    .classed("breakdown", true)
    .classed("breakdown-open", function (this: Element) {
      return this.previousElementSibling?.classList.contains("breakdown-open") ?? false
    })
  breakdownContainers.append("td")
  const breakdownRows = breakdownContainers
    .append("td")
    .attr("colspan", totalCols - 1)
    .append("table")
    .selectAll<HTMLTableRowElement, BreakdownRow>("tr")
    .data<BreakdownRow>((row: DisplayRow) => row.breakdown ?? [])
    .join("tr")
    .classed("breakdown-row", true)
    .classed("breakdown-first-output", (row: BreakdownRow) => row.divider)

  const breakdownIcons = breakdownRows.append("td")
  breakdownIcons.append((row: BreakdownRow) => row.recipe.icon.make(32)).classed("item-icon", true)
  breakdownIcons
    .append("svg")
    .classed("usage-arrow", true)
    .attr("viewBox", "0 0 18 16")
    .attr("width", 18)
    .attr("height", 16)
    .append("use")
    .attr("href", "images/icons.svg#rightarrow")
  breakdownIcons.append((row: BreakdownRow) => row.item.icon.make(32)).classed("item-icon", true)
  breakdownRows
    .append("td")
    .classed("right-align", true)
    .append("tt")
    .classed("item-rate pad-right", true)
    .text((row: BreakdownRow) => spec.format.alignRate(row.rate))

  const breakdownBeltRows = breakdownRows.filter((row: BreakdownRow) => row.item.phase === "solid")
  const breakdownBeltCell = breakdownBeltRows.append("td")
  breakdownBeltCell.append(() => belt.icon.make(32))
  breakdownBeltCell.append("span").text(" \u00d7")
  breakdownBeltRows
    .append("td")
    .classed("right-align", true)
    .append("tt")
    .classed("belt-count pad-right", true)
    .text((row: BreakdownRow) => spec.format.alignCount(spec.getBeltCount(row.item, row.rate)))

  const breakdownPipeRows = breakdownRows.filter((row: BreakdownRow) => row.item.phase === "fluid")
  breakdownPipeRows.append("td").append(() => new PipeIcon().icon.make(32))
  breakdownPipeRows.append("td")

  const breakdownBuildingCell = breakdownRows
    .append("td")
    .filter((row: BreakdownRow) => row.building !== null)
    .classed("building", true)
  breakdownBuildingCell.append((row: BreakdownRow) => {
    if (row.building === null) throw new Error("Breakdown row has no building")
    return row.building.icon.make(32)
  })
  breakdownBuildingCell.append("span").text(" \u00d7")
  breakdownRows
    .append("td")
    .filter((row: BreakdownRow) => row.count !== null)
    .classed("building pad-right", true)
    .append("tt")
    .text((row: BreakdownRow) => {
      if (row.count === null) throw new Error("Breakdown row has no machine count")
      return spec.format.alignCount(row.count)
    })
  breakdownRows
    .append("td")
    .filter((row: BreakdownRow) => row.percent !== null)
    .classed("right-align", true)
    .append("tt")
    .text((row: BreakdownRow) => row.percent ?? "")
}
// endregion results.ts

// region ui.ts
// Build targets

function hasRecipeCategories(recipe: Recipe | null | undefined): boolean {
  return recipe !== null && recipe !== undefined && (recipe.categories.size > 0 || recipe.category !== null)
}

const SELECTED_INPUT = "selected"

// events

function itemHandler(target: BuildTarget): (item: Item) => void {
  return function (item: Item) {
    target.setItem(item, target.getRate())
    spec.updateSolution()
  }
}

function removeHandler(target: BuildTarget): () => void {
  return function () {
    spec.removeTarget(target)
    spec.updateSolution()
  }
}

function changeBuildingCountHandler(target: BuildTarget): () => void {
  return function () {
    target.buildingsChanged()
    spec.updateSolution()
  }
}

function changeRateHandler(target: BuildTarget): () => void {
  return function () {
    target.rateChanged()
    spec.updateSolution()
  }
}

function changeBeltCountHandler(target: BuildTarget): () => void {
  return function () {
    target.beltsChanged()
    spec.updateSolution()
  }
}

function activateOnEnter(activate: () => void): (event: KeyboardEvent) => void {
  return function (event: KeyboardEvent) {
    if (event.key !== "Enter") return
    event.preventDefault()
    activate()
  }
}

export function handleTargetQualityChange(target: BuildTarget, requestedQuality: number): void {
  const currentRate = target.getRate()
  target.setQuality(requestedQuality)
  target.setQualityStrategy(target.qualityLevel > 0 ? "auto" : "direct", currentRate)
  spec.updateSolution()
}

function resetSearch(dropdown: Element): void {
  let search = dropdown.getElementsByClassName("search")[0] as HTMLInputElement | undefined
  if (search !== undefined) {
    search.value = ""
  }

  // unhide all child nodes
  const elems = dropdown.querySelectorAll<HTMLElement>("label, hr")
  for (const elem of elems) {
    elem.style.display = ""
  }
}

function searchTargets(this: HTMLInputElement, event: KeyboardEvent): void {
  const search = this
  const searchText = search.value
  const parent = search.parentElement
  if (parent === null) return
  const dropdown = select(parent)

  if (!searchText.trim()) {
    resetSearch(parent)
    return
  }

  // handle enter key press (select target if only one is visible)
  if (event.key === "Enter") {
    const labels = dropdown.selectAll<HTMLElement, unknown>("label").filter(function () {
      return this.style.display !== "none"
    })
    // don't do anything if more than one icon is visible
    if (labels.size() === 1) {
      const label = labels.node()
      if (label instanceof HTMLLabelElement) {
        const input = document.getElementById(label.htmlFor)
        if (input instanceof HTMLInputElement) {
          input.checked = true
          input.dispatchEvent(new Event("change"))
        }
      }
    }
    return
  }

  // hide non-matching labels & icons
  let currentHrHasContent = false
  const searchState: { lastHrWithContent: HTMLElement | null } = { lastHrWithContent: null }
  dropdown.selectAll<HTMLElement, unknown>("hr, label").each(function (item: unknown) {
    if (this.tagName === "HR") {
      if (currentHrHasContent) {
        this.style.display = ""
        searchState.lastHrWithContent = this
      } else {
        this.style.display = "none"
      }
      currentHrHasContent = false
    } else {
      if (!(item instanceof Item) || !itemMatchesSearch(item, searchText)) {
        this.style.display = "none"
      } else {
        this.style.display = ""
        currentHrHasContent = true
      }
    }
  })
  if (!currentHrHasContent && searchState.lastHrWithContent !== null) {
    searchState.lastHrWithContent.style.display = "none"
  }
}

let targetCount = 0
let recipeSelectorCount = 0

export class BuildTarget implements FactoryBuildTarget {
  index: number
  itemKey: string
  item: Item
  recipe: Recipe | null = null
  defaultRecipe: Recipe | null = null
  basis: TargetBasis = "machines"
  buildings = one
  rate = zero
  belts = zero
  qualityLevel = 0
  qualityStrategy: QualityStrategy = "direct"
  readonly element: HTMLElement
  readonly recipeSelector: Selection<HTMLSpanElement, undefined, null, undefined>
  readonly qualitySelector: HTMLSelectElement
  readonly buildingInput: HTMLInputElement
  readonly rateInput: HTMLInputElement
  readonly beltInput: HTMLInputElement
  readonly beltStackHeight: HTMLSpanElement
  readonly rateFieldLabel: HTMLLabelElement
  readonly locationWarning: Selection<HTMLDivElement, undefined, null, undefined>
  compatibleLocations: Planet[] = []

  constructor(index: number, itemKey: string, item: Item, itemGroups: ItemGroups) {
    this.index = index
    this.itemKey = itemKey
    this.item = item

    let element = create("li").classed("target production-target-row", true)
    element
      .append("button")
      .classed("targetButton ui", true)
      .text("×")
      .attr("data-tooltip", "Remove this production target.")
      .on("click", removeHandler(this))
    const elementNode = element.node()
    if (!(elementNode instanceof HTMLElement)) throw new Error("Unable to create production target")
    this.element = elementNode

    const targetInputName = `target-${targetCount}`
    let itemOptionsRendered = false
    const itemColumn = element.append("span").classed("production-target-item", true)

    const renderItemOptions = (selection: Selection<HTMLElement, unknown, null, undefined>): void => {
      if (itemOptionsRendered) {
        return
      }
      itemOptionsRendered = true
      selection.selectAll("*").remove()
      selection
        .append("input")
        .classed("search", true)
        .attr("placeholder", "Search")
        .on("keyup", function (this: Element, event: KeyboardEvent) {
          if (this instanceof HTMLInputElement) searchTargets.call(this, event)
        })
      let group = selection.selectAll("div").data(itemGroups).join("div")
      group.filter((_d: Item[][], i: number) => i > 0).append("hr")
      let items = group
        .selectAll("div")
        .data((d: Item[][]) => d)
        .join("div")
        .selectAll("span")
        .data((d: Item[]) => d)
        .join("span")
      let itemLabel = addInputs(items, targetInputName, (d: Item) => d === this.item, itemHandler(this))
      itemLabel.append((d: Item) => {
        const node = selection.node()
        return d.icon.make(32, false, node instanceof HTMLElement ? node : undefined)
      })
      itemLabel
        .append("span")
        .classed("target-item-name", true)
        .text((d: Item) => d.name)
      reapTooltips()
    }

    const dropdown = makeDropdown(
      itemColumn,
      (selection) => {
        renderItemOptions(selection)
        const search = selection.select(".search").node() as HTMLInputElement | null
        search?.focus()
      },
      (selection) => {
        const node = selection.node()
        if (node instanceof Element) resetSearch(node)
      },
    )
    dropdown.classed("itemDropdown", true)

    const selectedItem = dropdown.append("span").datum(item)
    const selectedItemLabel = addInputs(selectedItem, targetInputName, () => true, itemHandler(this))
    selectedItemLabel.append(() => {
      const node = dropdown.node()
      return item.icon.make(32, false, node instanceof HTMLElement ? node : undefined)
    })
    selectedItemLabel.append("span").classed("target-item-name", true).text(item.name)

    targetCount++

    this.recipeSelector = itemColumn.append("span").classed("production-target-recipe", true)
    const settings = element.append("span").classed("production-target-settings", true)

    const qualityPlanning = settings.append("span").classed("target-quality-planning", true)
    const qualityInputId = `target-quality-${targetCount}`
    const qualityField = qualityPlanning.append("span").classed("target-setting-field target-quality-field", true)
    qualityField.append("label").classed("target-field-label", true).attr("for", qualityInputId).text("Quality")
    this.qualitySelector = qualityField
      .append("select")
      .classed("target-quality", true)
      .attr("id", qualityInputId)
      .attr("aria-label", `Quality for ${item.name}`)
      .attr("data-tooltip", "Set the output quality; module chances are applied automatically.")
      .on("change", (event: Event) => {
        const target = event.target
        if (target instanceof HTMLSelectElement) handleTargetQualityChange(this, Number(target.value))
      })
      .node() as HTMLSelectElement
    select(this.qualitySelector)
      .selectAll("option")
      .data(QUALITY_TIERS.map((name, level) => ({ name, level })))
      .join("option")
      .attr("value", (d: { readonly name: string; readonly level: number }) => d.level)
      .text((d: { readonly name: string; readonly level: number }) => d.name)

    const buildingInputId = `target-machines-${targetCount}`
    const buildingField = settings.append("span").classed("target-setting-field target-machines-field", true)
    buildingField.append("label").classed("target-field-label", true).attr("for", buildingInputId).text("Machines")
    this.buildingInput = buildingField
      .append("input")
      .classed("target-machine-count", true)
      .classed(SELECTED_INPUT, true)
      .on("change", changeBuildingCountHandler(this))
      .on("keydown", activateOnEnter(changeBuildingCountHandler(this)))
      .attr("type", "text")
      .attr("id", buildingInputId)
      .attr("value", 1)
      .attr("size", 3)
      .attr("aria-label", "Machines")
      .attr("title", "Set the required machine count.")
      .node() as HTMLInputElement

    const rateInputId = `target-rate-${targetCount}`
    const rateField = settings.append("span").classed("target-setting-field target-rate-field", true)
    this.rateFieldLabel = rateField
      .append("label")
      .classed("target-field-label", true)
      .attr("for", rateInputId)
      .node() as HTMLLabelElement
    this.rateInput = rateField
      .append("input")
      .classed("target-rate", true)
      .on("change", changeRateHandler(this))
      .on("keydown", activateOnEnter(changeRateHandler(this)))
      .attr("type", "text")
      .attr("id", rateInputId)
      .attr("value", "")
      .attr("size", 5)
      .attr("data-tooltip", "Set the required output rate.")
      .node() as HTMLInputElement

    const beltInputId = `target-belts-${targetCount}`
    const beltField = settings.append("span").classed("target-setting-field target-belts-field", true)
    beltField.append("label").classed("target-field-label", true).attr("for", beltInputId).text("Belts")
    this.beltInput = beltField
      .append("input")
      .classed("target-belts", true)
      .on("change", changeBeltCountHandler(this))
      .on("keydown", activateOnEnter(changeBeltCountHandler(this)))
      .attr("type", "text")
      .attr("id", beltInputId)
      .attr("value", "")
      .attr("size", 3)
      .attr("aria-label", "Belts")
      .node() as HTMLInputElement
    this.beltStackHeight = beltField
      .append("span")
      .classed("target-belt-stack-height", true)
      .attr("aria-hidden", "true")
      .node() as HTMLSpanElement
    this.setQuality(0)
    this.setRateLabel()
    this.syncBeltInputAvailability()
    this.syncBeltStackHeight()

    this.locationWarning = element
      .append("div")
      .classed("location-warning", true)
      .attr("aria-live", "polite")
      .style("display", "none")
    this.locationWarning.append("div").classed("location-warning-title", true)
    this.locationWarning.append("div").classed("location-warning-message", true)
    this.locationWarning
      .append("button")
      .classed("ui", true)
      .attr("type", "button")
      .text("Enable compatible locations")
      .on("click", () => this.enableCompatibleLocations())

    this.displayRecipes()
  }
  getBuildingCountInput(): string {
    return this.buildingInput.value
  }
  get changedBuilding(): boolean {
    return this.basis === "machines"
  }
  getBeltCountInput(): string {
    return this.beltInput.value
  }
  setRateLabel(): void {
    this.rateInput?.setAttribute("aria-label", "Rate per " + spec.format.longRate)
    if (this.rateFieldLabel) {
      const unit = spec.format.rateName === "m" ? "min" : spec.format.rateName
      this.rateFieldLabel.textContent = `Rate/${unit}`
    }
  }
  setItem(item: Item, currentRate: Rational): void {
    this.itemKey = item.key
    this.item = item
    if (this.basis === "belts" && item.phase !== "solid") {
      this.basis = "rate"
      this.rate = currentRate
      this.belts = zero
    }
    this.syncSelectedInput()
    this.syncBeltInputAvailability()
    this.displayRecipes()
  }
  syncBeltInputAvailability(): void {
    const solid = this.item.phase === "solid"
    const rateOnly = this.qualityLevel > 0 && this.qualityStrategy !== "direct"
    this.beltInput.disabled = !solid || rateOnly
    if (!solid) this.beltInput.value = "N/A"
  }
  syncSelectedInput(): void {
    this.buildingInput.classList.toggle(SELECTED_INPUT, this.basis === "machines")
    this.rateInput.classList.toggle(SELECTED_INPUT, this.basis === "rate")
    this.beltInput.classList.toggle(SELECTED_INPUT, this.basis === "belts")
  }
  displayLocationWarning(): void {
    let info = getUnavailableLocationInfo(spec, this.item)
    if (info === null) {
      this.locationWarning.style("display", "none")
      return
    }

    this.compatibleLocations = info.compatibleLocations
    let selectedLabel = info.selectedLocations.length === 1 ? "location" : "locations"
    this.locationWarning
      .select(".location-warning-title")
      .text(`Unavailable on selected ${selectedLabel}: ${formatLocationList(info.selectedLocations, "and")}`)
    this.locationWarning.select(".location-warning-message").text("Choose a compatible production location above.")
    this.locationWarning.style("display", null)
  }
  enableCompatibleLocations(): void {
    let locations = [...this.compatibleLocations]
    for (let location of locations) {
      if (!spec.selectedPlanets.has(location)) {
        spec.selectPlanet(location)
      }
    }
    selectAll<HTMLButtonElement, Planet>("#planet_selector .toggle")
      .classed("selected", (location: Planet) => spec.selectedPlanets.has(location))
      .attr("aria-pressed", (location: Planet) => String(spec.selectedPlanets.has(location)))
    refreshRecipeSettings(spec)
    spec.updateSolution()
  }
  displayRecipes(): void {
    this.recipeSelector.selectAll("*").remove()
    const recipes: Recipe[] = []
    let found = false
    if (!spec.ignore.has(this.item)) {
      for (let recipe of this.item.recipes) {
        if (spec.disable.has(recipe) || !recipe.isNetProducer(this.item)) {
          continue
        }
        if (recipe === this.recipe) {
          found = true
        }
        recipes.push(recipe)
      }
    }
    if (!found) {
      this.recipe = null
    }
    this.displayLocationWarning()
    if (recipes.length > 0) {
      this.defaultRecipe = recipes[0] ?? null
    }
    if (recipes.length === 0) {
      this.defaultRecipe = null
      return
    } else if (recipes.length === 1) {
      this.recipe = recipes[0] ?? null
      return
    }
    // If there are multiple valid recipes, render the recipe dropdown.
    if (this.recipe === null) {
      this.recipe = recipes[0] ?? null
    }
    let self = this
    let dropdown = makeDropdown(this.recipeSelector)
    let inputs = dropdown.selectAll("div").data(recipes).join("div")
    let labels = addInputs(
      inputs,
      "target-recipe-" + recipeSelectorCount,
      (d: Recipe) => self.recipe === d,
      (d: Recipe) => {
        self.recipe = d
        spec.updateSolution()
      },
    )
    labels.append((d: Recipe) => {
      const node = dropdown.node()
      return d.icon.make(32, false, node instanceof HTMLElement ? node : undefined)
    })
    recipeSelectorCount++
  }
  getRate(): Rational {
    this.setRateLabel()
    this.syncBeltInputAvailability()
    this.syncBeltStackHeight()
    let rate = zero
    let recipe = this.recipe
    if (!hasRecipeCategories(recipe) && this.changedBuilding) {
      this.rateChanged()
    }
    let baseRate = null
    if (recipe !== null) {
      baseRate = spec.getRecipeRate(recipe)
      if (baseRate !== null) {
        baseRate = baseRate.mul(recipe.gives(this.item))
      }
    }
    const plannedQuality = this.qualityLevel > 0 && this.qualityStrategy !== "direct"
    let qualityRate = baseRate
    if (baseRate !== null && recipe !== null && this.qualityLevel > 0 && !plannedQuality) {
      const probability = qualityProbability(
        getRecipeQualityChance(spec, recipe),
        this.qualityLevel,
        spec.maxQualityLevel,
      )
      qualityRate = baseRate.mul(probability)
    }
    if (this.basis === "machines") {
      rate = qualityRate === null ? zero : qualityRate.mul(this.buildings)
    } else if (this.basis === "belts") {
      rate = spec.getRateForBeltCount(this.item, this.belts, this.recipe ?? this.defaultRecipe)
    } else {
      rate = this.rate
    }

    if (plannedQuality) {
      this.buildingInput.value = "Plan"
    } else if (this.basis !== "machines") {
      if (qualityRate !== null && !qualityRate.isZero()) {
        const count = rate.div(qualityRate)
        this.buildingInput.value = spec.format.count(count)
      } else {
        this.buildingInput.value = "N/A"
      }
    }
    this.rateInput.value = spec.format.rate(rate)
    if (this.item.phase === "solid" && this.basis !== "belts") {
      this.beltInput.value = spec.format.count(spec.getBeltCount(this.item, rate, this.recipe ?? this.defaultRecipe))
    }
    return rate
  }
  buildingsChanged(): void {
    this.basis = "machines"
    this.buildings = Rational.from_string(this.buildingInput.value)
    this.rate = zero
    this.belts = zero
    this.rateInput.value = ""
    this.beltInput.value = ""
    this.syncSelectedInput()
  }
  setBuildings(count: string, recipe: Recipe | null): void {
    this.buildingInput.value = count
    this.recipe = recipe
    this.buildingsChanged()
  }
  rateChanged(): void {
    this.basis = "rate"
    this.buildings = zero
    this.rate = Rational.from_string(this.rateInput.value).div(spec.format.rateFactor)
    this.belts = zero
    this.buildingInput.value = ""
    if (this.item.phase === "solid") this.beltInput.value = ""
    this.syncSelectedInput()
  }
  setRate(rate: string): void {
    this.rateInput.value = rate
    this.rateChanged()
  }
  beltsChanged(): void {
    if (this.item.phase !== "solid") return
    this.basis = "belts"
    this.buildings = zero
    this.rate = zero
    this.belts = Rational.from_string(this.beltInput.value)
    this.buildingInput.value = ""
    this.rateInput.value = ""
    this.syncSelectedInput()
  }
  setBelts(belts: string): void {
    const beltCount = Rational.from_string(belts)
    this.beltInput.value = belts
    if (this.item.phase === "solid") {
      this.beltsChanged()
      return
    }
    this.basis = "rate"
    this.buildings = zero
    this.rate = spec.getRateForBeltCount(this.item, beltCount, this.recipe ?? this.defaultRecipe)
    this.belts = zero
    this.rateInput.value = spec.format.rate(this.rate)
    this.syncSelectedInput()
    this.syncBeltInputAvailability()
  }
  syncBeltStackHeight(): void {
    if (this.item.phase !== "solid") {
      this.beltStackHeight.textContent = ""
      return
    }
    const recipe = this.recipe ?? this.defaultRecipe
    const height = formatCanadianNumber(spec.getEffectiveBeltStackSize(this.item, recipe).toDecimal())
    const policy = spec.getBeltStackPolicy(this.item)
    const source = spec.getBeltStackPolicySource(this.item)
    this.beltStackHeight.textContent = `×${height}`
    const policyText =
      policy === "auto"
        ? spec.isItemAutomaticallyBeltStacked(this.item, recipe)
          ? "Auto: direct output"
          : "Auto: unstacked"
        : policy === "stacked"
          ? source === "override"
            ? "Stacked override"
            : "Default: stacked"
          : source === "override"
            ? "Unstacked override"
            : "Default: unstacked"
    this.beltInput.setAttribute(
      "data-tooltip",
      `Full two-lane belts at ×${height} (${policyText}). Change item stacking in Factory.`,
    )
  }
  setQuality(level: number | string): void {
    const maxLevel = Math.max(0, Math.min(QUALITY_TIERS.length - 1, spec.maxQualityLevel))
    select(this.qualitySelector)
      .selectAll("option")
      .property("disabled", (option: { level: number }) => option.level > maxLevel)
    this.qualityLevel = Math.max(0, Math.min(maxLevel, Number(level) || 0))
    this.qualitySelector.value = String(this.qualityLevel)
    if (this.qualityLevel === 0) {
      this.qualityStrategy = "direct"
    }
    this.syncQualityPlanningControls()
  }
  setQualityStrategy(strategy: QualityStrategy, preservedRate: Rational | null = null): void {
    const switchToRate = strategy !== "direct" && this.qualityLevel > 0 && this.basis !== "rate"
    const currentRate = switchToRate ? (preservedRate ?? this.getRate()) : null
    this.qualityStrategy = strategy
    if (currentRate !== null) {
      this.basis = "rate"
      this.buildings = zero
      this.rate = currentRate
      this.belts = zero
      this.rateInput.value = spec.format.rate(currentRate)
      this.buildingInput.value = "Plan"
      this.beltInput.value = ""
      this.syncSelectedInput()
    }
    this.syncQualityPlanningControls()
  }
  syncQualityPlanningControls(): void {
    const qualityEnabled = this.qualityLevel > 0
    const rateOnly = qualityEnabled && this.qualityStrategy !== "direct"
    this.element.classList.toggle("planned-quality-target", rateOnly)
    this.recipeSelector.style("display", rateOnly ? "none" : "")
    this.buildingInput.disabled = rateOnly
    this.syncBeltInputAvailability()
  }
}
// endregion ui.ts

// region quality/highs-solver.ts
type HighsLoader = (typeof import("highs"))["default"]
type Highs = Awaited<ReturnType<HighsLoader>>

export interface HighsLoaderOptions {
  readonly locateFile?: (file: string) => string
}

export interface QualityOptimizationRun {
  readonly certified: boolean
  readonly cacheHit: boolean
  readonly columns: number
  readonly rows: number
  readonly basicColumns: number
  readonly solveMilliseconds: number
  readonly certificationMilliseconds: number
  readonly reason: string | null
}

interface CachedSolution {
  readonly rates: readonly Rational[]
  readonly surplus: readonly Rational[]
}

interface ExactModel {
  readonly recipes: readonly QualityGraphRecipe[]
  readonly items: readonly QualityGraphItem[]
  readonly coefficients: readonly (readonly Rational[])[]
  readonly demand: readonly Rational[]
  readonly costs: readonly Rational[]
}

function addAmount(amounts: Map<QualityGraphItem, Rational>, item: QualityGraphItem, amount: Rational): void {
  amounts.set(item, (amounts.get(item) ?? zero).add(amount))
}

function modelForGraph(graph: QualityGraph, output: QualityGraphItem, rate: Rational): ExactModel {
  const recipes = [...graph.solverRecipes()]
  const itemSet = new Set<QualityGraphItem>([output])
  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) itemSet.add(ingredient.item)
    for (const product of recipe.products) itemSet.add(product.item)
  }
  const items = [...itemSet]
  const itemRows = new Map(items.map((item, index) => [item, index]))
  const coefficients = Array.from({ length: items.length }, () => Array.from({ length: recipes.length }, () => zero))
  let minimum = one
  let maximum = one
  const observe = (value: Rational): void => {
    if (value.isZero()) return
    const absolute = value.abs()
    if (absolute.less(minimum)) minimum = absolute
    if (maximum.less(absolute)) maximum = absolute
  }
  observe(rate)

  for (let column = 0; column < recipes.length; column++) {
    const recipe = recipes[column]
    if (recipe === undefined) throw new Error("Missing quality recipe")
    const net = new Map<QualityGraphItem, Rational>()
    for (const product of recipe.products) addAmount(net, product.item, product.amount)
    for (const ingredient of recipe.ingredients) addAmount(net, ingredient.item, zero.sub(ingredient.amount))
    for (const [item, amount] of net) {
      const row = itemRows.get(item)
      if (row === undefined) throw new Error("Missing quality item row")
      coefficients[row]![column] = amount
      observe(amount)
    }
  }

  const combinedCosts = Array.from({ length: recipes.length }, () => one)
  const costRatio = Rational.max(Rational.from_integer(2), maximum.div(minimum).mul(Rational.from_integer(2)))
  let priorityCost = costRatio
  for (const level of graph.priorityLevels) {
    let minimumWeight: Rational | null = null
    for (const [recipe, weight] of level) {
      if (!recipes.includes(recipe)) continue
      if (minimumWeight === null || weight.less(minimumWeight)) minimumWeight = weight
    }
    if (minimumWeight === null) continue
    let normalizedTotal = zero
    for (const [recipe, weight] of level) {
      const column = recipes.indexOf(recipe)
      if (column === -1) continue
      const normalizedWeight = weight.div(minimumWeight)
      normalizedTotal = normalizedTotal.add(normalizedWeight)
      combinedCosts[column] = one.add(priorityCost.mul(normalizedWeight))
    }
    if (!normalizedTotal.isZero()) priorityCost = priorityCost.mul(costRatio).mul(normalizedTotal)
  }
  return {
    recipes,
    items,
    coefficients,
    demand: items.map((item) => (item === output ? rate : zero)),
    costs: combinedCosts,
  }
}

function finiteFloat(value: Rational, label: string): number {
  const result = value.toFloat()
  if (!Number.isFinite(result)) throw new Error(`${label} is outside the Float64 range`)
  return Object.is(result, -0) ? 0 : result
}

function modelSignature(model: ExactModel, output: QualityGraphItem): string {
  return JSON.stringify([
    output.key,
    model.items.map((item) => item.key),
    model.recipes.map((recipe) => recipe.key),
    model.coefficients.map((row) => row.map((value) => value.toString())),
    model.costs.map((value) => value.toString()),
  ])
}

function cachedSolutionForModel(model: ExactModel, cached: CachedSolution, rate: Rational): QualityGraphSolution {
  const rates = new Map<QualityGraphRecipe, Rational>()
  for (let column = 0; column < model.recipes.length; column++) {
    const recipe = model.recipes[column]
    const unitRate = cached.rates[column]
    if (recipe === undefined || unitRate === undefined) throw new Error("Cached quality solution is incomplete")
    const scaled = unitRate.mul(rate)
    if (!scaled.isZero()) rates.set(recipe, scaled)
  }
  const surplus = new Map<QualityGraphItem, Rational>()
  for (let row = 0; row < model.items.length; row++) {
    const item = model.items[row]
    const unitRate = cached.surplus[row]
    if (item === undefined || unitRate === undefined) throw new Error("Cached quality surplus is incomplete")
    const scaled = unitRate.mul(rate)
    if (!scaled.isZero()) surplus.set(item, scaled)
  }
  return { rates, surplus }
}

function lpTerm(value: Rational, name: string, first: boolean): string {
  const numeric = finiteFloat(value, name)
  const sign = numeric < 0 ? "-" : first ? "" : "+"
  return `${sign} ${Math.abs(numeric).toPrecision(17)} ${name}`
}

function lpForModel(model: ExactModel): string {
  const maximumCost = model.costs.reduce((maximum, cost) => (maximum.less(cost) ? cost : maximum), zero)
  const objective = model.costs
    .map((cost, column) => lpTerm(cost.div(maximumCost), `x${column}`, column === 0))
    .join(" ")
  const constraints = model.items.map((_, row) => {
    const terms: string[] = []
    for (let column = 0; column < model.recipes.length; column++) {
      const coefficient = model.coefficients[row]?.[column]
      if (coefficient === undefined || coefficient.isZero()) continue
      terms.push(lpTerm(coefficient, `x${column}`, terms.length === 0))
    }
    if (terms.length === 0) terms.push("0")
    const demand = model.demand[row]
    if (demand === undefined) throw new Error("Missing quality demand")
    return ` c${row}: ${terms.join(" ")} >= ${finiteFloat(demand, `c${row}`).toPrecision(17)}`
  })
  const bounds = model.recipes.map((_, column) => ` 0 <= x${column}`)
  return ["Minimize", ` obj: ${objective}`, "Subject To", ...constraints, "Bounds", ...bounds, "End"].join("\n")
}

function dot(left: readonly Rational[], right: readonly Rational[]): Rational {
  let result = zero
  for (let index = 0; index < left.length; index++) {
    const leftValue = left[index]
    const rightValue = right[index]
    if (leftValue === undefined || rightValue === undefined) throw new Error("Mismatched exact vectors")
    result = result.add(leftValue.mul(rightValue))
  }
  return result
}

const RANK_PRIME = 2_147_483_647n

function modularPower(base: bigint, exponent: bigint): bigint {
  let result = 1n
  while (exponent > 0n) {
    if ((exponent & 1n) === 1n) result = (result * base) % RANK_PRIME
    base = (base * base) % RANK_PRIME
    exponent >>= 1n
  }
  return result
}

function rationalModulo(value: Rational): bigint {
  const numerator = ((value.p % RANK_PRIME) + RANK_PRIME) % RANK_PRIME
  const denominator = ((value.q % RANK_PRIME) + RANK_PRIME) % RANK_PRIME
  if (denominator === 0n) throw new Error("Exact basis denominator is not invertible")
  return (numerator * modularPower(denominator, RANK_PRIME - 2n)) % RANK_PRIME
}

function selectIndependentRows(
  model: ExactModel,
  basicColumns: readonly number[],
  candidates: readonly number[],
): number[] {
  const selected: number[] = []
  const echelon = new Map<number, bigint[]>()
  for (const row of candidates) {
    const values = basicColumns.map((column) => rationalModulo(model.coefficients[row]?.[column] ?? zero))
    for (const [pivot, pivotValues] of echelon) {
      const factor = values[pivot]
      if (factor === undefined || factor === 0n) continue
      for (let column = pivot; column < values.length; column++) {
        const value = values[column]
        const pivotValue = pivotValues[column]
        if (value === undefined || pivotValue === undefined) throw new Error("Missing modular basis coefficient")
        values[column] = (((value - factor * pivotValue) % RANK_PRIME) + RANK_PRIME) % RANK_PRIME
      }
    }
    const pivot = values.findIndex((value) => value !== 0n)
    if (pivot === -1) continue
    const pivotValue = values[pivot]
    if (pivotValue === undefined) throw new Error("Missing modular basis pivot")
    const inverse = modularPower(pivotValue, RANK_PRIME - 2n)
    for (let column = pivot; column < values.length; column++) {
      const value = values[column]
      if (value === undefined) throw new Error("Missing modular basis coefficient")
      values[column] = (value * inverse) % RANK_PRIME
    }
    echelon.set(pivot, values)
    selected.push(row)
    if (selected.length === basicColumns.length) return selected
  }
  throw new Error(`Candidate active rows have rank ${selected.length}, expected ${basicColumns.length}`)
}

function certify(
  model: ExactModel,
  basicColumns: readonly number[],
  activeRows: readonly number[],
): QualityGraphSolution {
  if (basicColumns.length === 0 || activeRows.length !== basicColumns.length) {
    throw new Error(`Candidate basis is not square (${activeRows.length} rows, ${basicColumns.length} columns)`)
  }

  const basis = activeRows.map((row) =>
    basicColumns.map((column) => {
      const value = model.coefficients[row]?.[column]
      if (value === undefined) throw new Error("Missing candidate basis coefficient")
      return value
    }),
  )
  const basicRates = solveExactLinearSystemFractionFree(
    basis,
    activeRows.map((row) => {
      const value = model.demand[row]
      if (value === undefined) throw new Error("Missing candidate demand")
      return value
    }),
  )
  const negativeIndex = basicRates.findIndex((value) => value.less(zero))
  if (negativeIndex !== -1) {
    throw new Error(`Candidate basis is not primal feasible (${basicRates[negativeIndex]?.toString() ?? "unknown"})`)
  }

  const ratesByColumn = Array.from({ length: model.recipes.length }, () => zero)
  for (let index = 0; index < basicColumns.length; index++) {
    const column = basicColumns[index]
    const value = basicRates[index]
    if (column === undefined || value === undefined) throw new Error("Missing candidate basic rate")
    ratesByColumn[column] = value
  }

  const surplus = new Map<QualityGraphItem, Rational>()
  for (let row = 0; row < model.coefficients.length; row++) {
    const coefficients = model.coefficients[row]
    const demand = model.demand[row]
    if (coefficients === undefined || demand === undefined) {
      throw new Error("Missing candidate material balance")
    }
    const remainder = dot(coefficients, ratesByColumn).sub(demand)
    const item = model.items[row]
    if (item === undefined) throw new Error("Missing candidate material item")
    if (remainder.less(zero)) throw new Error(`Candidate basis underproduces ${item.name}`)
    if (!remainder.isZero()) surplus.set(item, remainder)
  }

  const dualBasis = basicColumns.map((column) =>
    activeRows.map((row) => {
      const value = model.coefficients[row]?.[column]
      if (value === undefined) throw new Error("Missing candidate dual coefficient")
      return value
    }),
  )
  const activeDual = solveExactLinearSystemFractionFree(
    dualBasis,
    basicColumns.map((column) => {
      const value = model.costs[column]
      if (value === undefined) throw new Error("Missing candidate basic cost")
      return value
    }),
  )
  for (let index = 0; index < activeDual.length; index++) {
    const row = activeRows[index]
    const value = activeDual[index]
    if (row === undefined || value === undefined) throw new Error("Missing candidate dual value")
    if (value.less(zero)) throw new Error("Candidate basis is not dual feasible")
  }

  const dual = Array.from({ length: model.coefficients.length }, () => zero)
  for (let index = 0; index < activeRows.length; index++) {
    const row = activeRows[index]
    const value = activeDual[index]
    if (row === undefined || value === undefined) throw new Error("Missing candidate dual value")
    dual[row] = value
  }
  for (let column = 0; column < model.recipes.length; column++) {
    const coefficients = model.coefficients.map((row) => row[column] ?? zero)
    const cost = model.costs[column]
    if (cost === undefined) throw new Error("Missing candidate cost")
    if (cost.less(dot(coefficients, dual))) throw new Error("Candidate basis has a negative exact reduced cost")
  }

  const primalObjective = dot(model.costs, ratesByColumn)
  const dualObjective = dot(model.demand, dual)
  if (!primalObjective.equal(dualObjective)) throw new Error("Candidate primal and dual objectives differ")

  const rates = new Map<QualityGraphRecipe, Rational>()
  for (let column = 0; column < model.recipes.length; column++) {
    const recipe = model.recipes[column]
    const rate = ratesByColumn[column]
    if (recipe !== undefined && rate !== undefined && !rate.isZero()) rates.set(recipe, rate)
  }
  return { rates, surplus }
}

export class HighsQualityOptimizer implements QualityGraphOptimizer {
  lastRun: QualityOptimizationRun | null = null
  private readonly solutionCache = new Map<string, CachedSolution>()

  constructor(private readonly highs: Highs) {}

  solve(graph: QualityGraph, output: QualityGraphItem, rate: Rational): QualityGraphSolution | null {
    const baseModel = modelForGraph(graph, output, rate)
    const signature = modelSignature(baseModel, output)
    const cached = this.solutionCache.get(signature)
    if (cached !== undefined) {
      this.solutionCache.delete(signature)
      this.solutionCache.set(signature, cached)
      this.lastRun = {
        certified: true,
        cacheHit: true,
        columns: baseModel.recipes.length,
        rows: baseModel.coefficients.length,
        basicColumns: 0,
        solveMilliseconds: 0,
        certificationMilliseconds: 0,
        reason: null,
      }
      return cachedSolutionForModel(baseModel, cached, rate)
    }
    const model = baseModel
    const solveStarted = performance.now()
    const solution = this.highs.solve(lpForModel(model), {
      solver: "simplex",
      presolve: "on",
      output_flag: false,
      log_to_console: false,
      small_matrix_value: 1e-12,
      primal_feasibility_tolerance: 1e-9,
      dual_feasibility_tolerance: 1e-9,
    })
    const solveMilliseconds = performance.now() - solveStarted
    const certificationStarted = performance.now()
    let reason: string | null = null
    let certified: QualityGraphSolution | null = null
    let basicColumns: number[] = []
    try {
      if (solution.Status !== "Optimal") {
        throw new Error(
          `HiGHS returned ${solution.Status} (${Object.keys(solution.Columns).length} columns, ${solution.Rows.length} rows, objective ${solution.ObjectiveValue})`,
        )
      }
      basicColumns = model.recipes
        .map((_, column) => column)
        .filter((column) => {
          const candidate = solution.Columns[`x${column}`]
          return candidate !== undefined && "Status" in candidate && candidate.Status === "BS"
        })
      const rowIndexes = model.coefficients.map((_, row) => row)
      const nonbasicRows = rowIndexes.filter((row) => {
        const candidate = solution.Rows[row]
        return candidate !== undefined && "Status" in candidate && candidate.Status !== "BS"
      })
      const tightRows = rowIndexes.filter((row) => {
        const candidate = solution.Rows[row]
        const demand = model.demand[row]
        return (
          candidate !== undefined &&
          "Primal" in candidate &&
          demand !== undefined &&
          Math.abs(candidate.Primal - finiteFloat(demand, `c${row}`)) <= 1e-7
        )
      })
      const activeRows = selectIndependentRows(model, basicColumns, [...new Set([...nonbasicRows, ...tightRows])])
      certified = certify(model, basicColumns, activeRows)
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error)
      certified = null
    }
    this.lastRun = {
      certified: certified !== null,
      cacheHit: false,
      columns: model.recipes.length,
      rows: model.coefficients.length,
      basicColumns: basicColumns.length,
      solveMilliseconds,
      certificationMilliseconds: performance.now() - certificationStarted,
      reason,
    }
    if (certified !== null && !rate.isZero()) {
      const unitRates = baseModel.recipes.map((recipe) => (certified.rates.get(recipe) ?? zero).div(rate))
      const unitSurplus = baseModel.items.map((item) => (certified.surplus.get(item) ?? zero).div(rate))
      this.solutionCache.set(signature, { rates: unitRates, surplus: unitSurplus })
      if (this.solutionCache.size > 8) {
        const oldest = this.solutionCache.keys().next().value
        if (oldest !== undefined) this.solutionCache.delete(oldest)
      }
    }
    return certified
  }
}

export async function loadHighsQualityOptimizer(options: HighsLoaderOptions = {}): Promise<HighsQualityOptimizer> {
  const { default: highsLoader } = await import("highs")
  const highs = await highsLoader(options)
  return new HighsQualityOptimizer(highs)
}
// endregion quality/highs-solver.ts

// region quality/highs-runtime.ts
/** Load the optional quality LP engine without adding it to the normal-plan entry chunk. */
export async function loadBrowserHighsQualityOptimizer(): Promise<HighsQualityOptimizer> {
  const { default: highsRuntimeUrl } = await import("highs/runtime?url")
  return loadHighsQualityOptimizer({ locateFile: () => highsRuntimeUrl })
}
// endregion quality/highs-runtime.ts

// region graph/types.ts
export type GraphDirection = "down" | "right"
export type GraphLayoutDirection = "TB" | "LR"
export type GraphJustification = "left" | "center"
export type LinkDirection = "forward" | "backward" | "self"

export interface GraphPoint {
  readonly x: number
  readonly y: number
}

export interface GraphCurve {
  readonly points: readonly GraphPoint[]
  path(): string
  offset(offset: number): GraphCurve
  transpose(): GraphCurve
}

export interface GraphNodeContract {
  readonly name: string
  readonly recipe: SolverRecipe
  readonly building: Building | null
  readonly count: Rational
  readonly rate: Rational | null
  readonly ingredients: readonly SolverIngredient[]
  readonly linkObjects: GraphLink[]
  element: SVGElement | null
  x0: number
  y0: number
  x1: number
  y1: number
  width: number
  labelX: number
  links(): readonly GraphLink[]
  text(): string
  labelWidth(text: SVGTextElement, nodeMargin: number): number
  highlight(): void
  unhighlight(): void
}

export interface BoxGraphLabel {
  link: GraphLink
  labelpos: "c"
  width: number
  height: number
  text: string
  x: number
  y: number
}

export interface GraphBeltLine {
  readonly item: Item
  readonly curve: GraphCurve
}

export type GraphNode = GraphNodeContract

export interface GraphLink {
  readonly source: GraphNodeContract
  readonly target: GraphNodeContract
  readonly value: number
  readonly item: Item
  readonly rate: Rational
  readonly fuel: boolean
  readonly beltCount: Rational | null
  readonly extra: boolean
  readonly elements: Element[]
  readonly nodeHighlighters: Set<GraphNodeContract>
  index: number
  label: BoxGraphLabel
  points: GraphPoint[]
  width: number
  y0: number
  y1: number
  direction: LinkDirection
  curve: GraphCurve
  belts: GraphBeltLine[]
  highlight(node: GraphNodeContract): void
  unhighlight(node: GraphNodeContract): void
}

export interface GraphData {
  readonly nodes: GraphNodeContract[]
  readonly links: GraphLink[]
}

export interface IconCoordinates {
  readonly icon_col: number
  readonly icon_row: number
}

export type ItemColorMap = Map<Item, number>
export type RecipeColorMap = Map<SolverRecipe, number>
// endregion graph/types.ts

// region graph.ts
// Graph interactions

let clickedNode: GraphNodeContract | null = null

export function graphClickHandler(_event: Event, node: GraphNodeContract): void {
  if (node === clickedNode) {
    node.unhighlight()
    clickedNode = null
  } else {
    clickedNode?.unhighlight()
    clickedNode = node
  }
}

export function graphMouseOverHandler(_event: Event, node: GraphNodeContract): void {
  node.highlight()
}

export function graphMouseLeaveHandler(_event: Event, node: GraphNodeContract): void {
  if (node !== clickedNode) {
    node.unhighlight()
  }
}

// Circular graph paths

export type Vector2 = readonly [number, number]

type CurveInputPoint = Pick<GraphPoint, "x" | "y">

type Sweep = 0 | 1 | null

interface CirclePoint extends GraphPoint {
  readonly nx: number
  readonly ny: number
  readonly r: number | null
  readonly sweep: Sweep
}

export class CirclePath implements GraphCurve {
  points: CirclePoint[]

  constructor(nx: number, ny: number, pairs: readonly CurveInputPoint[]) {
    const first = pairs[0]
    if (first === undefined) throw new Error("A graph curve requires at least one point")
    let { x, y } = first
    const points: CirclePoint[] = [{ x, y, nx, ny, r: null, sweep: null }]
    let prevX = x
    let prevY = y
    for (const pair of pairs.slice(1)) {
      ;({ x, y } = pair)
      const dx = (x - prevX) / 2
      const dy = (y - prevY) / 2
      const tangentProjection = nx * dx + ny * dy
      let normalProjection = -ny * dx + nx * dy
      if (-0.5 < normalProjection && normalProjection < 0.5) {
        const [normalX, normalY] = norm([dx, dy])
        const dot = nx * normalX + ny * normalY
        nx = 2 * dot * normalX - nx
        ny = 2 * dot * normalY - ny
        points.push({ x, y, nx, ny, r: null, sweep: null })
        prevX = x
        prevY = y
        continue
      }
      let sweep: Exclude<Sweep, null> = 1
      let normalX = -ny
      let normalY = nx
      if (normalProjection < 0) {
        sweep = 0
        normalProjection = -normalProjection
        normalX = -normalX
        normalY = -normalY
      }
      const radius = normalProjection + tangentProjection ** 2 / normalProjection
      const centerX = normalX * radius
      const centerY = normalY * radius
      normalX = (centerX - 2 * dx) / radius
      normalY = (centerY - 2 * dy) / radius
      nx = normalY
      ny = -normalX
      if (sweep === 0) {
        nx = -nx
        ny = -ny
      }
      points.push({ x, y, nx, ny, r: radius, sweep })
      prevX = x
      prevY = y
    }
    this.points = points
  }

  path(): string {
    const first = this.points[0]
    if (first === undefined) return ""
    const parts = [`M ${first.x},${first.y}`]
    for (const { x, y, r, sweep } of this.points.slice(1)) {
      if (r === null || Number.isNaN(r)) {
        parts.push(`L ${x},${y}`)
      } else {
        parts.push(`A ${r} ${r} 0 0 ${sweep ?? 0} ${x} ${y}`)
      }
    }
    return parts.join(" ")
  }

  offset(offset: number): CirclePath {
    const first = this.points[0]
    if (first === undefined) throw new Error("Cannot offset an empty graph curve")
    const points = this.points.map(({ x, y, nx, ny }) => ({ x: x + -ny * offset, y: y + nx * offset }))
    return new CirclePath(first.nx, first.ny, points)
  }

  transpose(): CirclePath {
    const first = this.points[0]
    if (first === undefined) throw new Error("Cannot transpose an empty graph curve")
    const points: CirclePoint[] = this.points.map(({ x, y, nx, ny, r, sweep }) => ({
      x: y,
      y: x,
      nx: ny,
      ny: nx,
      r,
      sweep: sweep === 0 ? 1 : sweep === 1 ? 0 : null,
    }))
    const transposed = new CirclePath(first.ny, first.nx, points)
    transposed.points = points
    return transposed
  }
}

function norm([x, y]: Vector2): Vector2 {
  const distance = Math.sqrt(x ** 2 + y ** 2)
  return [x / distance, y / distance]
}

const MIN_RADIUS = 10

// Paths come in four kinds. All mentioned slopes are within the frame of
// reference of the initial tangent vector.
// (E.g. when t is <1, 0>, slopes have the usual meaning.)
// 1) Straight line
//      Used when slope == 0.
// 2) Double arcs
//      Used when slope of overall line is in the range [-0.75, 0.75],
//      excluding 0.
//
//      Consists of two circular arcs, one beginning at the start point and
//      terminating at the middle, the other beginning at the middle and
//      terminating at the end point.
// 3) Initial adjustment w/ double arcs
//      Used with steeper slopes than the previous, so long as the first
//      critical point is located before the line crossing through the center
//      with double the slope.
//
//      Similar to the double arcs, but with a short initial curve on either
//      end to permit the slope at the middle point to equal double the
//      overall slope (similar to a cubic Bezier curve).
// 4) Initial adjustment w/ straight line
//      Used as final fallback in all other cases.
//
//      Generally only needed when the overall slope is too steep for other
//      approaches to be feasible.

// Vector from start point to end point in reference frame of tangent vector.
function toFrame(tx: number, ty: number, x: number, y: number): Vector2 {
  let dotx = tx * x + ty * y
  let doty = -ty * x + tx * y
  return [dotx, doty]
}

function fromFrame(tx: number, ty: number, x: number, y: number): Vector2 {
  return toFrame(tx, -ty, x, y)
}

function frameSlope(tx: number, ty: number, x1: number, y1: number, x2: number, y2: number): number | null {
  let dx = x2 - x1
  let dy = y2 - y1
  let [fx, fy] = toFrame(tx, ty, dx, dy)
  if (fx === 0) {
    return null
  }
  return fy / fx
}

function linePath(tx: number, ty: number, x1: number, y1: number, x2: number, y2: number): CirclePath {
  return new CirclePath(tx, ty, [
    { x: x1, y: y1 },
    { x: x2, y: y2 },
  ])
}

function doubleArcPath(tx: number, ty: number, x1: number, y1: number, x2: number, y2: number): CirclePath {
  let midx = (x1 + x2) / 2
  let midy = (y1 + y2) / 2
  return new CirclePath(tx, ty, [
    { x: x1, y: y1 },
    { x: midx, y: midy },
    { x: x2, y: y2 },
  ])
}

// Vector transpose functions in SVG coord space (i.e. inverted y axis).
function R(x: number, y: number): Vector2 {
  return [-y, x]
}
function L(x: number, y: number): Vector2 {
  return [y, -x]
}

function doubleArcAdjustPath(
  tx: number,
  ty: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
): CirclePath {
  let dx = x2 - x1
  let dy = y2 - y1
  let [fx, fy] = toFrame(tx, ty, dx, dy)
  let T
  if (fy > 0) {
    // Curving to right.
    T = R
  } else {
    // Curving to left.
    T = L
  }
  let [nx, ny] = T(tx, ty)
  // radius of first circle
  let r = width / 2 + MIN_RADIUS
  // center point of first circle
  let cx = x1 + nx * r
  let cy = y1 + ny * r
  // center point of whole curve
  let p3x = (x1 + x2) / 2
  let p3y = (y1 + y2) / 2
  // desired tangent vector at center point
  let [ctx, cty] = fromFrame(tx, ty, fx / 2, fy)
  // unit vector normal to tangent at center point
  // (points at center of second circle)
  let [cnx, cny] = norm(T(ctx, cty))
  // proceed from p3, r units towards center of circle 2
  let midx = p3x + cnx * r
  let midy = p3y + cny * r
  // vector pointing from center of circle 1, to that point
  let crossx = midx - cx
  let crossy = midy - cy
  // unit vector pointing from midpoint of that cross-vector, to center of
  // circle 2
  let [mx, my] = norm(T(crossx, crossy))
  // reflect cn over m; gives unit vector pointing from center of circle 1
  // to center of circle 2
  let dot = cnx * mx + cny * my
  let ox = 2 * dot * mx - cnx
  let oy = 2 * dot * my - cny
  // calculate points 2 and 4
  let p2x = cx + -ox * r
  let p2y = cy + -oy * r
  let p4x = x2 - (p2x - x1)
  let p4y = y2 - (p2y - y1)
  return new CirclePath(tx, ty, [
    { x: x1, y: y1 },
    { x: p2x, y: p2y },
    { x: p3x, y: p3y },
    { x: p4x, y: p4y },
    { x: x2, y: y2 },
  ])
}

function lineAdjustPath(
  tx: number,
  ty: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
): CirclePath {
  let dx = x2 - x1
  let dy = y2 - y1
  let [fx, fy] = toFrame(tx, ty, dx, dy)
  let T
  if (fy > 0) {
    // Curving to right.
    T = R
  } else {
    // Curving to left.
    T = L
  }
  let [nx, ny] = T(tx, ty)
  // radius of both circles
  let r = width / 2 + MIN_RADIUS
  // center points of both circles
  let r1x = x1 + nx * r
  let r1y = y1 + ny * r
  let r2x = x2 - nx * r
  let r2y = y2 - ny * r
  // center point of whole curve
  let cx = (x1 + x2) / 2
  let cy = (y1 + y2) / 2
  // distance between circle center and curve center
  let d = Math.sqrt((cx - r1x) ** 2 + (cy - r1y) ** 2)
  // unit vector from circle center to curve center
  let ax = (cx - r1x) / d
  let ay = (cy - r1y) / d
  // normal pointing towards inflection point
  let [bx, by] = T(-ax, -ay)
  // A wee spot o' trig.
  let d1 = r ** 2 / d
  let h = r ** 2 - Math.sqrt(r ** 2 - r ** 4 / d ** 2)
  let px = ax * d1 + bx * h
  let py = ay * d1 + by * h

  return new CirclePath(tx, ty, [
    { x: x1, y: y1 },
    { x: r1x + px, y: r1y + py },
    { x: r2x - px, y: r2y - py },
    { x: x2, y: y2 },
  ])
}

export function makeCurve(
  tx: number,
  ty: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width = 0,
): CirclePath {
  let dx = x2 - x1
  let dy = y2 - y1
  let [fx, fy] = toFrame(tx, ty, dx, dy)
  if (fy === 0) {
    return linePath(tx, ty, x1, y1, x2, y2)
  }
  let slope = fy / fx
  if (-0.75 <= slope && slope <= 0.75) {
    return doubleArcPath(tx, ty, x1, y1, x2, y2)
  }
  return doubleArcAdjustPath(tx, ty, x1, y1, x2, y2, width)
}

// Shared graph primitives

// Code common between the Sankey and boxline visualizations.

export const colorList = [
  "#1f77b4", // blue
  "#8c564b", // brown
  "#2ca02c", // green
  "#d62728", // red
  "#9467bd", // purple
  "#e377c2", // pink
  "#17becf", // cyan
  "#7f7f7f", // gray
  "#bcbd22", // yellow
  "#ff7f0e", // orange
]

export const iconSize = 32
export const colonWidth = 12

function itemNeighbors(item: Item): Set<Item> {
  const touching = new Set<Item>()
  let recipes = item.recipes.concat(item.uses)
  for (let recipe of recipes) {
    let ingredients = recipe.getIngredients().concat(recipe.products)
    for (let ing of ingredients) {
      if (ing.item instanceof Item) touching.add(ing.item)
    }
  }
  return touching
}

function itemDegree(item: Item): number {
  return itemNeighbors(item).size
}

export function getColorMaps(
  nodes: readonly GraphNodeContract[],
  links: readonly GraphLink[],
): readonly [ItemColorMap, RecipeColorMap] {
  const itemColors: ItemColorMap = new Map()
  const recipeColors: RecipeColorMap = new Map()
  const items: Item[] = []
  for (let link of links) {
    items.push(link.item)
  }
  items.sort(function (a, b) {
    return itemDegree(b) - itemDegree(a)
  })
  const remainingItems = new Set<Item>(items)
  while (remainingItems.size > 0) {
    let chosenItem: Item | null = null
    let usedColors: Set<number> = new Set()
    let max = -1
    for (let item of remainingItems) {
      let neighbors = itemNeighbors(item)
      const colors = new Set<number>()
      for (let neighbor of neighbors) {
        if (itemColors.has(neighbor)) {
          const neighborColor = itemColors.get(neighbor)
          if (neighborColor !== undefined) colors.add(neighborColor)
        }
      }
      if (colors.size > max) {
        max = colors.size
        usedColors = colors
        chosenItem = item
      }
    }
    if (chosenItem === null) break
    remainingItems.delete(chosenItem)
    let color = 0
    while (usedColors.has(color)) {
      color++
    }
    itemColors.set(chosenItem, color)
  }
  // This is intended to be taken modulo the number of colors when it is
  // actually used.
  let recipeColor = 0
  for (let node of nodes) {
    const recipe = node.recipe
    const onlyProduct = recipe.products.length === 1 ? recipe.products[0] : undefined
    const productColor =
      onlyProduct !== undefined && onlyProduct.item instanceof Item ? itemColors.get(onlyProduct.item) : undefined
    if (productColor !== undefined) {
      recipeColors.set(recipe, productColor)
    } else {
      recipeColors.set(recipe, recipeColor++)
    }
  }
  return [itemColors, recipeColors]
}

export function imageViewBox(obj: IconCoordinates): string {
  var x1 = obj.icon_col * PX_WIDTH + 0.5
  var y1 = obj.icon_row * PX_HEIGHT + 0.5
  return `${x1} ${y1} ${PX_WIDTH - 1} ${PX_HEIGHT - 1}`
}

function colorIndex<TKey>(colors: ReadonlyMap<TKey, number>, key: TKey): number {
  return colors.get(key) ?? 0
}

function darkenColor(value: string): string {
  return color(value)?.darker().toString() ?? value
}

function recipeIcon(node: GraphNodeContract): IconCoordinates {
  if (!(node.recipe instanceof Recipe)) throw new Error(`Graph node ${node.name} has no recipe icon`)
  return node.recipe
}

export function renderNode<GElement extends BaseType, PElement extends BaseType, PDatum>(
  rects: Selection<GElement, GraphNodeContract, PElement, PDatum>,
  nodeMargin: number,
  justification: GraphJustification,
  recipeColors: RecipeColorMap,
  ignore: ReadonlySet<unknown>,
): void {
  rects.each((d: GraphNodeContract) => {
    if (justification === "left") {
      d.labelX = d.x0
    } else {
      d.labelX = (d.x0 + d.x1) / 2 - d.width / 2
    }
  })
  // main rect
  rects
    .append("rect")
    .attr("x", (d: GraphNodeContract) => d.x0)
    .attr("y", (d: GraphNodeContract) => d.y0)
    .attr("height", (d: GraphNodeContract) => d.y1 - d.y0)
    .attr("width", (d: GraphNodeContract) => d.x1 - d.x0)
    .attr("fill", (d: GraphNodeContract) => {
      const value = colorList[colorIndex(recipeColors, d.recipe) % colorList.length] ?? colorList[0] ?? "#000"
      return darkenColor(value)
    })
    .attr(
      "stroke",
      (d: GraphNodeContract) => colorList[colorIndex(recipeColors, d.recipe) % colorList.length] ?? "#000",
    )
    .each(function (this: Element, d: GraphNodeContract) {
      if (this instanceof SVGElement) d.element = this
    })
  // plain text node (output, surplus)
  rects
    .filter((d: GraphNodeContract) => d.rate === null)
    .append("text")
    .attr("x", (d: GraphNodeContract) => (d.x0 + d.x1) / 2)
    .attr("y", (d: GraphNodeContract) => (d.y0 + d.y1) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .text((d: GraphNodeContract) => d.text())
  let labeledNode = rects.filter((d: GraphNodeContract) => d.rate !== null)
  // recipe icon
  labeledNode
    .append("svg")
    .attr("viewBox", (d: GraphNodeContract) => imageViewBox(recipeIcon(d)))
    .attr("x", (d: GraphNodeContract) => d.labelX + nodeMargin + 0.5)
    .attr("y", (d: GraphNodeContract) => (d.y0 + d.y1) / 2 - iconSize / 2 + 0.5)
    .attr("width", iconSize)
    .attr("height", iconSize)
    .append("image")
    .classed("ignore", (d: GraphNodeContract) => ignore.has(d.recipe))
    .attr("xlink:href", "images/sprite-sheet-" + sheetHash + ".webp")
    .attr("width", sheetWidth)
    .attr("height", sheetHeight)
  // node text (building count, or plain rate if no building)
  labeledNode
    .append("text")
    .attr(
      "x",
      (d: GraphNodeContract) =>
        d.labelX + nodeMargin + iconSize + (d.building === null ? 0 : colonWidth + iconSize) /*+ 5*/,
    )
    .attr("y", (d: GraphNodeContract) => (d.y0 + d.y1) / 2)
    .attr("dy", "0.35em")
    .text((d: GraphNodeContract) => d.text())
  let buildingNode = rects.filter((d: GraphNodeContract) => d.building !== null)
  // colon
  buildingNode
    .append("circle")
    .classed("colon", true)
    .attr("cx", (d: GraphNodeContract) => d.labelX + nodeMargin + iconSize + colonWidth / 2)
    .attr("cy", (d: GraphNodeContract) => (d.y0 + d.y1) / 2 - 4)
    .attr("r", 1)
  buildingNode
    .append("circle")
    .classed("colon", true)
    .attr("cx", (d: GraphNodeContract) => d.labelX + nodeMargin + iconSize + colonWidth / 2)
    .attr("cy", (d: GraphNodeContract) => (d.y0 + d.y1) / 2 + 4)
    .attr("r", 1)
  // building icon
  buildingNode
    .append("svg")
    .attr("viewBox", (d: GraphNodeContract) => imageViewBox(d.building ?? recipeIcon(d)))
    .attr("x", (d: GraphNodeContract) => d.labelX + iconSize + colonWidth + nodeMargin + 0.5)
    .attr("y", (d: GraphNodeContract) => (d.y0 + d.y1) / 2 - iconSize / 2 + 0.5)
    .attr("width", iconSize)
    .attr("height", iconSize)
    .append("image")
    .attr("xlink:href", "images/sprite-sheet-" + sheetHash + ".webp")
    .attr("width", sheetWidth)
    .attr("height", sheetHeight)
}

// Sankey graph

const nodePadding = 36
const sankeyNodeMargin = 2

const columnWidth = 200
const maxNodeHeight = 175

function selfPath(d: GraphLink): CirclePath {
  let x0 = d.source.x1
  let y0 = d.y0
  let x1 = d.source.x1
  let y1 = d.source.y1 + d.width / 2 + 10
  let r1 = (y1 - y0) / 2
  let x2 = d.target.x0
  let y2 = d.target.y1 + d.width / 2 + 10
  let x3 = d.target.x0
  let y3 = d.y1
  let r2 = (y3 - y2) / 2
  return new CirclePath(1, 0, [
    { x: x0, y: y0 },
    { x: x1, y: y1 },
    { x: x2, y: y2 },
    { x: x3, y: y3 },
  ])
}

function backwardPath(d: GraphLink): CirclePath {
  // start point
  let x0 = d.source.x1
  let y0 = d.y0
  // end point
  let x3 = d.target.x0
  let y3 = d.y1
  let y2a = d.source.y0 - d.width / 2 - 10
  let y2b = d.source.y1 + d.width / 2 + 10
  let y3a = d.target.y0 - d.width / 2 - 10
  let y3b = d.target.y1 + d.width / 2 + 10
  let points = [{ x: x0, y: y0 }]
  let starty
  let endy
  if (y2b < y3a) {
    // draw start arc down, end arc up
    starty = y2b
    endy = y3a
  } else if (y2a > y3b) {
    // draw start arc up, end arc down
    starty = y2a
    endy = y3b
  } else {
    // draw both arcs down
    starty = y2b
    endy = y3b
  }
  let curve = makeCurve(-1, 0, x0, starty, x3, endy)
  for (let { x, y } of curve.points) {
    points.push({ x, y })
  }
  points.push({ x: x3, y: y3 })
  return new CirclePath(1, 0, points)
}

function linkPath(d: GraphLink): CirclePath {
  if (d.direction === "self") {
    return selfPath(d)
  } else if (d.direction === "backward") {
    return backwardPath(d)
  }
  let x0 = d.source.x1
  let y0 = d.y0
  let x1 = d.target.x0
  let y1 = d.y1
  return makeCurve(1, 0, x0, y0, x1, y1, d.width)
}

function createSankey<Node, Link>(): SankeyGenerator<Node, Link> {
  const raw = d3sankey.sankey()
  function generator(graph: SankeyGraph<Node, Link>): SankeyGraph<Node, Link> {
    return Reflect.apply(raw, undefined, [graph]) as SankeyGraph<Node, Link>
  }
  generator.update = (graph: SankeyGraph<Node, Link>): SankeyGraph<Node, Link> => raw.update(graph)
  generator.nodeWidth = (value: number): SankeyGenerator<Node, Link> => {
    raw.nodeWidth(value)
    return generator
  }
  generator.nodePadding = (value: number): SankeyGenerator<Node, Link> => {
    raw.nodePadding(value)
    return generator
  }
  generator.nodeAlign = (value: (node: Node, columns: number) => number): SankeyGenerator<Node, Link> => {
    raw.nodeAlign(value)
    return generator
  }
  generator.maxNodeHeight = (value: number): SankeyGenerator<Node, Link> => {
    raw.maxNodeHeight(value)
    return generator
  }
  generator.linkLength = (value: number): SankeyGenerator<Node, Link> => {
    raw.linkLength(value)
    return generator
  }
  return generator
}

export function renderSankey(data: GraphData, direction: GraphDirection, ignore: ReadonlySet<unknown>): void {
  let maxNodeWidth = 0
  let testSVG = select("body").append("svg").classed("sankey test", true)
  const text = testSVG.append("text")
  const textNode = text.node()
  if (!(textNode instanceof SVGTextElement)) throw new Error("Unable to create graph measurement text")
  for (const node of data.nodes) {
    const nodeWidth = node.labelWidth(textNode, sankeyNodeMargin)
    if (nodeWidth > maxNodeWidth) {
      maxNodeWidth = nodeWidth
    }
    node.width = nodeWidth
  }
  text.remove()
  testSVG.remove()

  const [nw, np] = direction === "down" ? [nodePadding, maxNodeWidth] : [maxNodeWidth, nodePadding]
  let sankey = createSankey<GraphNodeContract, GraphLink>()
  sankey = sankey
    .nodeWidth(nw)
    .nodePadding(np)
    .nodeAlign(d3sankey.sankeyRight)
    .maxNodeHeight(maxNodeHeight)
    .linkLength(columnWidth)
  const { nodes, links } = sankey(data)
  let [itemColors, recipeColors] = getColorMaps(nodes, links)

  for (let link of links) {
    link.curve = linkPath(link)
    if (direction === "down") {
      link.curve = link.curve.transpose()
    }
    const belts: GraphLink["belts"] = []
    if (link.beltCount !== null) {
      let dy = link.width / link.beltCount.toFloat()
      // Only render belts if there are at least three pixels per belt.
      if (dy > 3) {
        for (let i = one; i.less(link.beltCount); i = i.add(one)) {
          let offset = i.toFloat() * dy - link.width / 2
          let beltCurve = link.curve.offset(offset)
          belts.push({ item: link.item, curve: beltCurve })
        }
      }
    }
    link.belts = belts
  }

  if (direction === "down") {
    for (let node of nodes) {
      ;[node.x0, node.y0] = [node.y0, node.x0]
      ;[node.x1, node.y1] = [node.y1, node.x1]
    }
  }

  let svg = select("svg#graph").classed("sankey", true)
  svg.selectAll("g").remove()

  // Node rects
  let rects = svg
    .append("g")
    .classed("nodes", true)
    .selectAll<SVGGElement, GraphNodeContract>("g")
    .data(nodes)
    .join("g")
    .classed("node", true)

  let nodeJust: GraphJustification = "left"
  if (direction === "down") {
    nodeJust = "center"
  }
  renderNode(rects, sankeyNodeMargin, nodeJust, recipeColors, ignore)

  // Link paths
  let link = svg
    .append("g")
    .classed("links", true)
    .selectAll<SVGGElement, GraphLink>("g")
    .data(links)
    .join("g")
    .classed("link", true)
    .each(function (d: GraphLink) {
      d.elements.push(this)
    })
  //.style("mix-blend-mode", "multiply")
  link
    .append("path")
    .attr("fill", "none")
    .attr("stroke-opacity", 0.3)
    .attr("d", (d: GraphLink) => d.curve.path())
    .attr("stroke", (d: GraphLink) => colorList[colorIndex(itemColors, d.item) % colorList.length] ?? "#000")
    .attr("stroke-width", (d: GraphLink) => Math.max(1, d.width))
  link
    .append("g")
    .selectAll("path")
    .data((d: GraphLink) => [d.curve.offset(-d.width / 2), d.curve.offset(d.width / 2)])
    .join("path")
    .classed("highlighter", true)
    .attr("fill", "none")
    .attr("d", (curve: GraphCurve) => curve.path())
    .attr("stroke", "none")
    .attr("stroke-width", 1)
  link
    .append("g")
    .classed("belts", true)
    .selectAll("path")
    .data((d: GraphLink) => d.belts)
    .join("path")
    .classed("belt", true)
    .attr("fill", "none")
    .attr("stroke-opacity", 0.3)
    .attr("d", (belt: GraphBeltLine) => belt.curve.path())
    .attr("stroke", (belt: GraphBeltLine) => colorList[colorIndex(itemColors, belt.item) % colorList.length] ?? "#000")
    .attr("stroke-width", 1)
  link.append("title").text((d: GraphLink) => `${d.source.name} \u2192 ${d.target.name}\n${spec.format.rate(d.rate)}`)
  let linkIcon = link
    .filter((d: GraphLink) => d.extra)
    .append("svg")
    .attr("viewBox", (d: GraphLink) => imageViewBox(d.item))
    .attr("x", (d: GraphLink) => d.source.x1 + 2.25)
    .attr("y", (d: GraphLink) => d.y0 - iconSize / 4 + 0.25)
    .attr("width", iconSize / 2)
    .attr("height", iconSize / 2)
  linkIcon
    .append("image")
    .attr("xlink:href", "images/sprite-sheet-" + sheetHash + ".webp")
    .attr("width", sheetWidth)
    .attr("height", sheetHeight)
  if (direction === "down") {
    linkIcon.attr("x", (d: GraphLink) => d.y0 - iconSize / 4 + 0.25).attr("y", (d: GraphLink) => d.source.y1 + 2.25)
  }
  let linkLabel = link
    .append("text")
    .attr("x", (d: GraphLink) => d.source.x1 + 2 + (d.extra ? iconSize / 2 : 0))
    .attr("y", (d: GraphLink) => d.y0)
    .attr("dy", "0.35em")
    .attr("text-anchor", "start")
    .text((d: GraphLink) => (d.extra ? "\u00d7 " : "") + spec.format.rate(d.rate) + "/" + spec.format.rateName)
  if (direction === "down") {
    linkLabel
      .attr("x", null)
      .attr("y", null)
      .attr("transform", (d: GraphLink) => {
        let x = d.y0
        let y = d.source.y1 + 2 + (d.extra ? 16 : 0)
        return `translate(${x},${y}) rotate(90)`
      })
  }

  // Overlay transparent rect on top of each node, for click events.
  const rectElements = svg.selectAll<SVGGraphicsElement, GraphNodeContract>("g.node rect").nodes()
  const overlayData: { readonly rect: DOMRect; readonly node: GraphNodeContract }[] = []
  // Flash the graph tab to be visible, so that the graph is laid out and
  // the BBox is not empty.
  let graphTab = select("#graph_tab")
  const graphTabNode = graphTab.node()
  if (!(graphTabNode instanceof Element)) throw new Error("Graph tab is unavailable")
  const origDisplay = style(graphTabNode, "display")
  graphTab.style("display", "block")
  for (let i = 0; i < nodes.length; i++) {
    const rectElement = rectElements[i]
    const node = nodes[i]
    if (rectElement === undefined || node === undefined) continue
    const rect = rectElement.getBBox()
    overlayData.push({ rect, node })
  }
  graphTab.style("display", origDisplay)
  svg
    .append("g")
    .classed("overlay", true)
    .selectAll("rect")
    .data(overlayData)
    .join("rect")
    .attr("stroke", "none")
    .attr("fill", "transparent")
    .attr("x", (d: (typeof overlayData)[number]) => d.rect.x)
    .attr("y", (d: (typeof overlayData)[number]) => d.rect.y)
    .attr("width", (d: (typeof overlayData)[number]) => d.rect.width)
    .attr("height", (d: (typeof overlayData)[number]) => d.rect.height)
    .on("mouseover", (event: Event, d: (typeof overlayData)[number]) => graphMouseOverHandler(event, d.node))
    .on("mouseleave", (event: Event, d: (typeof overlayData)[number]) => graphMouseLeaveHandler(event, d.node))
    .on("click", (event: Event, d: (typeof overlayData)[number]) => graphClickHandler(event, d.node))
    .append("title")
    .text(
      (d: (typeof overlayData)[number]) =>
        d.node.name +
        (d.node.count.isZero() || d.node.building === null
          ? ""
          : `\n${d.node.building.name} \u00d7 ${spec.format.count(d.node.count)}`),
    )
}
// endregion graph.ts

// region visualization.ts
type DagreRuntime = (typeof import("@dagrejs/dagre"))["default"]

let dagreRuntime: DagreRuntime | null = null

function requireDagre(): DagreRuntime {
  if (dagreRuntime === null) throw new Error("Graph layout has not loaded")
  return dagreRuntime
}

// Graph viewport

const ZOOM_SCALE = 100
const MAX_SCALE = 10
const ASPECT_RATIO = 16 / 9

export function installSVGEvents<PElement extends BaseType, PDatum>(
  svg: Selection<SVGSVGElement, unknown, PElement, PDatum>,
): void {
  const selectedNode = svg.node()
  if (!(selectedNode instanceof SVGSVGElement)) throw new Error("Graph SVG is unavailable")
  const node: SVGSVGElement = selectedNode
  const tab = select("#graph_tab")
  const style = tab.style("display")
  tab.style("display", "block")
  svg.selectAll("image").style("display", "none")
  let { x, y, width, height } = node.getBBox()
  svg.selectAll("image").style("display", null)
  tab.style("display", style)

  const [diagramX, diagramY, diagramWidth, diagramHeight] = [x, y, width, height]
  if (width / height < ASPECT_RATIO) {
    const newWidth = height * ASPECT_RATIO
    x -= (newWidth - width) / 2
    width = newWidth
  } else if (width / height > ASPECT_RATIO) {
    const newHeight = width / ASPECT_RATIO
    y -= (newHeight - height) / 2
    height = newHeight
  }

  const [origWidth, origHeight] = [width, height]
  y = diagramY
  let scale = MAX_SCALE
  let clickPoint: DOMPoint | null = null

  function clamp(): void {
    const midX = x + width / 2
    const midY = y + height / 2
    if (diagramX > midX) {
      x = diagramX - width / 2
    } else if (diagramX + diagramWidth < midX) {
      x = diagramX + diagramWidth - width / 2
    }
    if (diagramY > midY) {
      y = diagramY - height / 2
    } else if (diagramY + diagramHeight < midY) {
      y = diagramY + diagramHeight - height / 2
    }
  }

  function setViewBox(): void {
    clamp()
    svg.attr("viewBox", `${x} ${y} ${width} ${height}`)
  }

  function point(event: MouseEvent): DOMPoint {
    const clientPoint = new DOMPointReadOnly(event.clientX, event.clientY)
    const matrix = node.getScreenCTM()
    if (matrix === null) throw new Error("Graph SVG has no screen transform")
    return clientPoint.matrixTransform(matrix.inverse())
  }

  function zoom(event: WheelEvent): void {
    event.preventDefault()
    const originalScale = scale
    if (event.deltaY < 0) {
      if (scale === 1) return
      scale--
    } else if (event.deltaY > 0) {
      if (scale === MAX_SCALE + 2) return
      scale++
    }
    const cursor = point(event)
    const dx = cursor.x - x
    const dy = cursor.y - y
    x = cursor.x - (dx / originalScale) * scale
    y = cursor.y - (dy / originalScale) * scale
    width = origWidth * (scale / MAX_SCALE)
    height = origHeight * (scale / MAX_SCALE)
    setViewBox()
  }

  function mouseDown(event: MouseEvent): void {
    clickPoint = point(event)
    event.preventDefault()
  }

  function mouseMove(event: MouseEvent): void {
    if (clickPoint === null) return
    const cursor = point(event)
    x -= cursor.x - clickPoint.x
    y -= cursor.y - clickPoint.y
    setViewBox()
    event.preventDefault()
  }

  function mouseUp(event: MouseEvent): void {
    clickPoint = null
    event.preventDefault()
  }

  setViewBox()
  svg.on("wheel", zoom)
  svg.on("mousedown", mouseDown)
  svg.on("mousemove", mouseMove)
  svg.on("mouseup", mouseUp)
}

// Box-line graph

const boxlineNodeMargin = 10

function edgePath(edge: GraphLink): string | null {
  const path = line<GraphPoint>()
    .x((point) => point.x)
    .y((point) => point.y)
    .curve(curveBasis)
  return path(edge.points)
}

function edgeName(link: GraphLink): string {
  return `link-${link.index}`
}

function itemColor(itemColors: ReadonlyMap<Item, number>, item: Item): string {
  return colorList[(itemColors.get(item) ?? 0) % colorList.length] ?? "#000"
}

function darkenedItemColor(itemColors: ReadonlyMap<Item, number>, item: Item): string {
  const value = itemColor(itemColors, item)
  return color(value)?.darker().toString() ?? value
}

export function renderBoxGraph(
  { nodes, links }: GraphData,
  direction: GraphDirection,
  ignore: ReadonlySet<unknown>,
  callback: () => void,
): void {
  let [itemColors, recipeColors] = getColorMaps(nodes, links)
  const layoutDirection: GraphLayoutDirection = direction === "down" ? "TB" : "LR"
  const dagre = requireDagre()
  const g = new dagre.graphlib.Graph({ multigraph: true })
  g.setGraph({ rankdir: layoutDirection })
  g.setDefaultEdgeLabel(() => {})

  let testSVG = select("body").append("svg").classed("test", true)
  const text = testSVG.append("text")
  const textNode = text.node()
  if (!(textNode instanceof SVGTextElement)) throw new Error("Unable to create graph measurement text")
  for (const node of nodes) {
    const width = node.labelWidth(textNode, boxlineNodeMargin)
    let height = 52
    let label = { node, width, height }
    g.setNode(node.name, label)
  }

  for (let [i, link] of links.entries()) {
    link.index = i
    let s = `\u00a0\u00d7 ${spec.format.rate(link.rate)}/${spec.format.rateName}`
    text.text(s)
    const textWidth = textNode.getBBox().width
    let width = 32 + 10 + textWidth
    let height = 32 + 10
    let label = {
      link: link,
      labelpos: "c",
      width: width,
      height: height,
      text: s,
      x: 0,
      y: 0,
    } satisfies BoxGraphLabel
    link.label = label
    g.setEdge(link.source.name, link.target.name, label, edgeName(link))
  }
  text.remove()
  testSVG.remove()

  dagre.layout(g)
  for (let nodeName of g.nodes()) {
    let dagreNode = g.node(nodeName)
    let node = dagreNode.node
    node.x0 = dagreNode.x - dagreNode.width / 2
    node.y0 = dagreNode.y - dagreNode.height / 2
    node.x1 = node.x0 + dagreNode.width
    node.y1 = node.y0 + dagreNode.height
  }
  for (let edgeName of g.edges()) {
    let dagreEdge = g.edge(edgeName)
    let link = dagreEdge.link
    link.points = dagreEdge.points
  }

  let { width, height } = g.graph()
  let svg = select("svg#graph").classed("sankey", false)
  //.attr("viewBox", `-25,-25,${width+50},${height+50}`)
  //.style("width", width+50)
  //.style("height", height+50)
  svg.selectAll("g").remove()

  let edges = svg
    .append("g")
    .classed("edges", true)
    .selectAll<SVGGElement, GraphLink>("g")
    .data(links)
    .join("g")
    .classed("edge", true)
    .classed("fuel", (d: GraphLink) => d.fuel)
    .each(function (d: GraphLink) {
      d.elements.push(this)
    })
  edges
    .append("path")
    .classed("highlighter", true)
    .attr("fill", "none")
    .attr("stroke", (d: GraphLink) => itemColor(itemColors, d.item))
    .attr("stroke-width", 3)
    .attr("d", edgePath)
    .attr("marker-end", (d: GraphLink) => `url(#arrowhead-${edgeName(d)})`)
  edges
    .append("defs")
    .append("marker")
    .attr("id", (d: GraphLink) => "arrowhead-" + edgeName(d))
    .attr("viewBox", "0 0 10 10")
    .attr("refX", "9")
    .attr("refY", "5")
    .attr("markerWidth", "16")
    .attr("markerHeight", "12")
    .attr("markerUnits", "userSpaceOnUse")
    .attr("orient", "auto")
    .append("path")
    .classed("highlighter", true)
    .attr("d", "M 0,0 L 10,5 L 0,10 z")
    .attr("stroke-width", 1)
    .attr("stroke", (d: GraphLink) => itemColor(itemColors, d.item))
    .attr("fill", (d: GraphLink) => darkenedItemColor(itemColors, d.item))

  let edgeLabels = svg
    .append("g")
    .classed("edgeLabels", true)
    .selectAll<SVGGElement, GraphLink>("g")
    .data(links)
    .join("g")
    .classed("edgeLabel", true)
    .each(function (d: GraphLink) {
      d.elements.push(this)
    })
  edgeLabels
    .append("rect")
    .classed("highlighter", true)
    .attr("x", (d: GraphLink) => {
      let edge = d.label
      return edge.x - edge.width / 2
    })
    .attr("y", (d: GraphLink) => {
      let edge = d.label
      return edge.y - edge.height / 2
    })
    .attr("width", (d: GraphLink) => d.label.width)
    .attr("height", (d: GraphLink) => d.label.height)
    .attr("rx", 6)
    .attr("ry", 6)
    .attr("fill", (d: GraphLink) => darkenedItemColor(itemColors, d.item))
    .attr("fill-opacity", 0)
    .attr("stroke", "none")
  edgeLabels
    .append("svg")
    .attr("viewBox", (d: GraphLink) => imageViewBox(d.item))
    .attr("x", (d: GraphLink) => {
      let edge = d.label
      return edge.x - edge.width / 2 + 5 + 0.5
    })
    .attr("y", (d: GraphLink) => {
      let edge = d.label
      return edge.y - iconSize / 2 + 0.5
    })
    .attr("width", iconSize)
    .attr("height", iconSize)
    .append("image")
    .attr("xlink:href", "images/sprite-sheet-" + sheetHash + ".webp")
    .attr("width", sheetWidth)
    .attr("height", sheetHeight)
  edgeLabels
    .append("text")
    .attr("x", (d: GraphLink) => {
      let edge = d.label
      return edge.x - edge.width / 2 + 5 + iconSize
    })
    .attr("y", (d: GraphLink) => d.label.y)
    .attr("dy", "0.35em")
    .text((d: GraphLink) => d.label.text)

  let rects = svg
    .append("g")
    .classed("nodes", true)
    .selectAll<SVGGElement, GraphNodeContract>("g")
    .data(nodes)
    .join("g")
    .classed("node", true)
  renderNode(rects, boxlineNodeMargin, "left", recipeColors, ignore)

  svg
    .append("g")
    .classed("overlay", true)
    .selectAll("rect")
    .data(nodes)
    .join("rect")
    .attr("stroke", "none")
    .attr("fill", "transparent")
    .attr("x", (d: GraphNodeContract) => d.x0)
    .attr("y", (d: GraphNodeContract) => d.y0)
    .attr("width", (d: GraphNodeContract) => d.x1 - d.x0)
    .attr("height", (d: GraphNodeContract) => d.y1 - d.y0)
    .on("mouseover", (event: Event, node: GraphNodeContract) => graphMouseOverHandler(event, node))
    .on("mouseout", (event: Event, node: GraphNodeContract) => graphMouseLeaveHandler(event, node))
    .on("click", (event: Event, node: GraphNodeContract) => graphClickHandler(event, node))
    .append("title")
    .text((d: GraphNodeContract) => d.name)
  callback()
}

// Visualization orchestration

class GraphEdge implements GraphLink {
  readonly elements: Element[] = []
  readonly nodeHighlighters = new Set<GraphNodeContract>()
  index = 0
  label: BoxGraphLabel
  points: GraphPoint[] = []
  width = 0
  y0 = 0
  y1 = 0
  direction: LinkDirection = "forward"
  curve: GraphCurve = new CirclePath(1, 0, [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ])
  belts: GraphLink["belts"] = []

  constructor(
    readonly source: GraphLayoutNode,
    readonly target: GraphLayoutNode,
    readonly value: number,
    readonly item: Item,
    readonly rate: Rational,
    readonly fuel: boolean,
    readonly beltCount: Rational | null,
    readonly extra: boolean,
  ) {
    this.label = { link: this, labelpos: "c", width: 0, height: 0, text: "", x: 0, y: 0 }
    source.linkObjects.push(this)
    target.linkObjects.push(this)
  }

  hasHighlighters(): boolean {
    return this.nodeHighlighters.size > 0
  }

  highlight(node: GraphNodeContract): void {
    if (!this.hasHighlighters()) {
      for (const element of this.elements) element.classList.add("edgePathHighlight")
    }
    this.nodeHighlighters.add(node)
  }

  unhighlight(node: GraphNodeContract): void {
    this.nodeHighlighters.delete(node)
    if (!this.hasHighlighters()) {
      for (const element of this.elements) element.classList.remove("edgePathHighlight")
    }
  }
}

class GraphLayoutNode implements GraphNodeContract {
  readonly ingredients
  readonly linkObjects: GraphLink[] = []
  element: SVGElement | null = null
  x0 = 0
  y0 = 0
  x1 = 0
  y1 = 0
  width = 0
  labelX = 0

  constructor(
    readonly name: string,
    readonly recipe: SolverRecipe,
    readonly building: Building | null,
    readonly count: Rational,
    readonly rate: Rational | null,
  ) {
    this.ingredients = recipe.getIngredients()
  }

  links(): readonly GraphLink[] {
    return this.linkObjects
  }

  text(): string {
    if (this.rate === null) return this.name
    return this.count.isZero()
      ? ` × ${spec.format.rate(this.rate)}/${spec.format.rateName}`
      : ` × ${spec.format.count(this.count)}`
  }

  labelWidth(text: SVGTextElement, nodeMargin: number): number {
    text.textContent = this.text()
    const textWidth = text.getBBox().width
    let nodeWidth = textWidth + nodeMargin * 2
    if (this.building !== null) {
      nodeWidth += iconSize * 2 + colonWidth
    } else if (this.rate !== null) {
      nodeWidth += iconSize
    }
    return nodeWidth
  }

  highlight(): void {
    this.element?.classList.add("nodeHighlight")
    for (const edge of this.links()) edge.highlight(this)
  }

  unhighlight(): void {
    this.element?.classList.remove("nodeHighlight")
    for (const edge of this.links()) edge.unhighlight(this)
  }
}

function makeGraph(totals: Totals): GraphData {
  const nodes: GraphLayoutNode[] = []
  const nodeMap = new Map<SolverRecipe, GraphLayoutNode>()

  for (let [recipe, rate] of totals.rates) {
    let node: GraphLayoutNode
    if (recipe.isReal()) {
      if (!(recipe instanceof Recipe)) throw new Error(`Unsupported real graph recipe: ${recipe.name}`)
      const building = spec.getBuilding(recipe)
      const count = spec.getCount(recipe, rate)
      node = new GraphLayoutNode(recipe.name, recipe, building, count, rate)
    } else {
      node = new GraphLayoutNode(recipe.name, recipe, null, zero, null)
    }
    nodes.push(node)
    nodeMap.set(recipe, node)
  }

  const links: GraphEdge[] = []
  for (const { item, from, to, rate, fuel } of totals.proportionate) {
    if (!(item instanceof Item)) throw new Error("Graph flow contains an unsupported item")
    const source = nodeMap.get(from)
    const target = nodeMap.get(to)
    if (source === undefined || target === undefined) throw new Error("Graph flow references a missing process node")
    let value = rate.toFloat()
    if (item.phase === "fluid") {
      // Fluids operate on a different scale.
      value /= 10
    }
    let beltCount = null
    if (item.phase === "solid" && spec.belt !== null) {
      beltCount = spec.getBeltCount(item, rate)
    }
    const extra = from.products.length > 1
    links.push(new GraphEdge(source, target, value, item, rate, fuel, beltCount, extra))
  }
  return { nodes, links }
}

export function renderTotals(totals: Totals, ignore: ReadonlySet<Item>): void {
  const data = makeGraph(totals)
  let processCount = data.nodes.filter((node) => node.recipe?.isReal?.()).length
  let summary = document.getElementById("visualization_summary")
  if (summary !== null) {
    summary.textContent = `${formatCanadianNumber(String(processCount))} processes · ${formatCanadianNumber(String(data.links.length))} flows`
  }

  const callback = (): void => {
    const svg = select<SVGSVGElement, unknown>("svg#graph")
    let tab = select("#graph_tab")
    if (visualizerRender === "zoom") {
      tab.style("min-width", 0)
      svg.attr("width", null)
      svg.attr("height", null)
      svg.style("border", null)
      installSVGEvents(svg)
    } else {
      tab.style("min-width", "max-content")
      let style = tab.style("display")
      tab.style("display", "block")
      // Hide images so the sprite sheet doesn't throw off the bounding
      // box.
      svg.selectAll("image").style("display", "none")
      const svgNode = svg.node()
      if (!(svgNode instanceof SVGSVGElement)) throw new Error("Graph SVG is unavailable")
      const { x, y, width, height } = svgNode.getBBox()
      svg.selectAll("image").style("display", null)
      tab.style("display", style)
      svg
        .attr("viewBox", `${x} ${y} ${width} ${height}`)
        .attr("width", width)
        .attr("height", height)
        .style("border", null)
      svg.on("wheel", null)
      svg.on("mousedown", null)
      svg.on("mousemove", null)
      svg.on("mouseup", null)
    }
  }

  if (visualizerType === "sankey") {
    const direction: GraphDirection = visualizerDirection === "down" ? "down" : "right"
    renderSankey(data, direction, ignore)
    callback()
  } else {
    const direction: GraphDirection = visualizerDirection === "down" ? "down" : "right"
    renderBoxGraph(data, direction, ignore, callback)
  }
}
// endregion visualization.ts

// region app.ts
function configureQualityOptimizerLoader(specification: FactorySpecification): void {
  specification.setQualityGraphOptimizerLoader(loadBrowserHighsQualityOptimizer)
}

configureQualityOptimizerLoader(spec)

// Deferred visualization runtime

interface VisualizationModule {
  readonly renderTotals: typeof renderTotals
}

let visualizationModule: VisualizationModule | null = null
let visualizationPromise: Promise<VisualizationModule> | null = null
let pendingVisualization: { totals: Totals; ignore: Set<Item> } | null = null

function loadVisualization(): Promise<VisualizationModule> {
  if (visualizationModule !== null) return Promise.resolve(visualizationModule)
  visualizationPromise ??= import("@dagrejs/dagre")
    .then(({ default: runtime }) => {
      dagreRuntime = runtime
      visualizationModule = { renderTotals }
      return visualizationModule
    })
    .catch((error) => {
      visualizationPromise = null
      throw error
    })
  return visualizationPromise
}

function renderVisualization(totals: Totals, ignore: Set<Item>): void {
  if (visualizationModule !== null) {
    visualizationModule.renderTotals(totals, ignore)
    return
  }
  pendingVisualization = { totals, ignore }
  void loadVisualization().then((module) => {
    const pending = pendingVisualization
    pendingVisualization = null
    if (pending !== null && currentTab === "graph") {
      module.renderTotals(pending.totals, pending.ignore)
    }
  })
}

// Browser factory view

function requireBrowserBuildTarget(target: ReturnType<FactoryViewPort["createBuildTarget"]>): BuildTarget {
  if (!(target instanceof BuildTarget)) {
    throw new Error("The browser renderer received a non-browser production target")
  }
  return target
}

export const browserFactoryView: FactoryViewPort = {
  createBuildTarget(index, itemKey, item, itemGroups) {
    return new BuildTarget(index, itemKey, item, itemGroups)
  },

  mountBuildTarget(target) {
    const browserTarget = requireBrowserBuildTarget(target)
    select("#targets").insert(() => browserTarget.element, "#plusButton")
  },

  removeBuildTarget(target) {
    const browserTarget = requireBrowserBuildTarget(target)
    select(browserTarget.element).remove()
  },

  renderSolution(specification: FactorySpecification, totals: Totals) {
    displayItems(specification, totals)
    if (currentTab === "graph") {
      renderVisualization(totals, specification.ignore)
    }
    reapTooltips()
  },

  renderCalculationError(specification: FactorySpecification, error: unknown) {
    displayCalculationError(specification, error)
    reapTooltips()
  },

  persistUrlState() {
    syncUrlHash(formatSettings())
  },
}

// Application bootstrap

function reset(): void {
  clearUrlHash()
  resetDisplay()
  spec.setQualityGraphOptimizerLoader(null)
  resetSpec()
  configureQualityOptimizerLoader(spec)
  bindCalculatorSpecification(spec)
  window.spec = spec
}

export function changeMod(): void {
  let currentSettings = loadSettings("#" + formatSettings())
  currentSettings.delete("data")
  let modName = currentMod()
  reset()
  console.log("settings on reset:", currentSettings)
  loadData(modName, currentSettings)
}

let OIL_EXCLUSION = new Map([
  ["basic", ["advanced-oil-processing"]],
  ["coal", ["advanced-oil-processing", "basic-oil-processing"]],
])

function fixLegacySettings(settings: Map<string, string>): void {
  if ((settings.has("use_3") || settings.has("min") || settings.has("furnace")) && !settings.has("buildings")) {
    const parts: string[] = []
    if (settings.has("min")) {
      let n = settings.get("min")
      if (n === "4") {
        n = "3"
      }
      parts.push("assembling-machine-" + n)
      settings.delete("min")
    } else if (settings.has("use_3")) {
      parts.push("assembling-machine-3")
      settings.delete("use_3")
    }
    const furnace = settings.get("furnace")
    if (furnace !== undefined) {
      parts.push(furnace)
      settings.delete("furnace")
    }
    settings.set("buildings", parts.join(","))
  }
  if ((settings.has("k") || settings.has("p")) && !settings.has("disable")) {
    const parts: string[] = []
    if (settings.has("k")) {
      settings.delete("k")
      parts.push("kovarex-processing")
    }
    if (settings.has("p")) {
      let p = settings.get("p")
      for (const recipeKey of OIL_EXCLUSION.get(p ?? "") ?? []) {
        parts.push(recipeKey)
      }
      settings.delete("p")
    }
    settings.set("disable", parts.join(","))
  }
}

const dataRequests = new Map<string, Promise<unknown>>()

function fetchData(filename: string): Promise<unknown> {
  let request = dataRequests.get(filename)
  if (request !== undefined) {
    return request
  }
  request = fetch(filename, { cache: "force-cache", credentials: "same-origin" }).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to load ${filename}: ${response.status} ${response.statusText}`)
    }
    return response.json() as Promise<unknown>
  })
  dataRequests.set(filename, request)
  return request
}

let loadGeneration = 0

function loadData(modName: string, settings: Map<string, string>): void {
  const generation = ++loadGeneration
  const mod = MODIFICATIONS.get(modName)
  if (mod === undefined) throw new Error(`Unknown dataset: ${modName}`)
  setLegacyCalculation(mod.legacy)
  const filename = "data/" + mod.filename
  void fetchData(filename)
    .then((rawData: unknown) => {
      if (generation !== loadGeneration) return
      const data = parseCalculatorData(rawData)
      const items = getItems(data)
      const recipes = getRecipes(data, items)
      const buildings = getBuildings(data, items)
      const planets = getPlanets(data, recipes, buildings)
      const modules = getModules(data, items)
      const qualities = getQualities(data)
      const belts = getBelts(data)
      const fuel = getFuel(data, items)
      const recipeProductivityResearch = getRecipeProductivityResearch(data, recipes)
      getSprites(data)
      const itemGroups = getItemGroups(items, data)
      spec.setData(
        items,
        recipes,
        planets,
        modules,
        buildings,
        belts,
        fuel,
        itemGroups,
        recipeProductivityResearch,
        getDatasetBeaconPower(data),
        qualities,
      )

      fixLegacySettings(settings)
      renderSettings(settings)

      spec.updateSolution()
      finishUrlInitialization()
    })
    .catch((error: unknown) => {
      if (generation !== loadGeneration) return
      spec.lastTotals = null
      spec.lastError = error
      spec.display()
    })
}

let initialized = false

function handleUrlHashChange(): void {
  const newHash = window.location.hash
  if (newHash === `#${formatSettings()}`) {
    return
  }
  const settings = loadSettings(newHash)
  renderDataSetOptions(settings)
  reset()
  loadData(currentMod(), settings)
}

export function init(): void {
  if (initialized) {
    return
  }
  initialized = true
  initializeFactoryDensity()
  initializeTooltips()
  initializeModulePipette()
  configureFactoryView(browserFactoryView)
  configureDatasetChangeHandler(changeMod)
  configureDeferredTabHandler((tabName) => {
    if (tabName === "settings") {
      ensureDeferredSettingsRendered()
    } else {
      ensureDeferredResourcesRendered()
    }
  })
  window.spec = spec
  configureModelRuntime({
    getSpecification: () => spec,
    useLegacyCalculation: usesLegacyCalculation,
  })
  initializeUrlState()
  let settings = loadSettings(window.location.hash)
  renderDataSetOptions(settings)
  loadData(currentMod(), settings)

  window.addEventListener("hashchange", handleUrlHashChange)
  window.addEventListener("popstate", handleUrlHashChange)
}

export function dispose(): void {
  if (!initialized) return
  initialized = false
  loadGeneration++
  window.removeEventListener("hashchange", handleUrlHashChange)
  window.removeEventListener("popstate", handleUrlHashChange)
  disposeModulePipette()
}
// endregion app.ts

// region react/HelpPanel.tsx
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
              ["Copy a module and its quality between slots", "Hover a module or module choice and press Q"],
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
            <ChangelogEntry date="2026-08-15" title="Q-Key Module Pipette">
              <li>
                Hover a module slot or picker choice and press Q to copy that module and quality, then click compatible
                machine or beacon slots to place it repeatedly.
              </li>
            </ChangelogEntry>

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
// endregion react/HelpPanel.tsx

// region react/SettingsPanel.tsx
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
                onInput={(event: FormEvent<HTMLInputElement>) => commands.setTitle(event.currentTarget.value)}
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
            <td className="setting-label">Maximum belt stack</td>
            <td>
              <select id="belt_stack_size" value={snapshot.settings.beltStackSize} onChange={onPlanningChange}>
                <option value="1">×1 — No belt stacking</option>
                <option value="2">×2 — Stack inserter research</option>
                <option value="3">×3 — Belt capacity 1</option>
                <option value="4">×4 — Belt capacity 2</option>
              </select>
              <div className="setting-help">Research sets the maximum; items still need a stacking source.</div>
            </td>
          </tr>

          <tr className="setting-row compact-setting-row compact-setting-first">
            <td className="setting-label">Default item stacking</td>
            <td>
              <select
                id="belt_stack_default_policy"
                value={snapshot.settings.beltStackDefaultPolicy}
                onChange={onPlanningChange}
              >
                <option value="auto">Auto — direct output only</option>
                <option value="stacked">Stacked — use maximum</option>
                <option value="unstacked">Unstacked — use ×1</option>
              </select>
              <div className="setting-help">
                Auto detects big drills. Override items stacked by inserters or recyclers.
              </div>
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

          <tr className="setting-row" hidden={!snapshot.settings.equipmentQualityAvailable}>
            <td className="setting-label">Equipment quality defaults</td>
            <td>
              <span className="equipment-quality-defaults">
                <label>
                  <span>Machine</span>
                  <span id="default_machine_quality" />
                </label>
                <label>
                  <span>Module</span>
                  <span id="default_module_quality" />
                </label>
                <label>
                  <span>Beacon</span>
                  <span id="default_beacon_quality" />
                </label>
              </span>
            </td>
          </tr>

          <tr className="setting-row" hidden={!snapshot.settings.equipmentQualityAvailable}>
            <td className="setting-label top">Quality factory</td>
            <td>
              <span className="quality-planner-settings">
                <label>
                  <span>Quality module</span>
                  <span id="quality_planner_module" />
                </label>
                <label>
                  <span>Quality module quality</span>
                  <span id="quality_planner_module_quality" />
                </label>
                <label>
                  <span>Productivity module</span>
                  <span id="quality_planner_productivity_module" />
                </label>
                <label>
                  <span>Productivity module quality</span>
                  <span id="quality_planner_productivity_module_quality" />
                </label>
              </span>
              <div className="setting-help">
                Quality-producing stages and recyclers use the quality selection. Guaranteed target-quality crafting
                uses the productivity selection where compatible.
              </div>
              <details className="quality-planner-advanced">
                <summary>Advanced priority</summary>
                <label>
                  <span>Prefer</span>
                  <select
                    id="quality_planner_objective"
                    value={snapshot.settings.qualityPlannerObjective}
                    onChange={onPlanningChange}
                  >
                    <option value="practical">Practical factory (recommended)</option>
                    <option value="materials">Fewer raw resources</option>
                    <option value="machines">Fewer machines</option>
                    <option value="power">Lower power</option>
                  </select>
                </label>
                <div className="setting-help">
                  Used as a route tiebreaker after meeting the target and preferring local resources.
                </div>
              </details>
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
// endregion react/SettingsPanel.tsx

// region react/CalculatorShell.tsx
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
  return (
    <div className="planner-toolbar">
      <div id="location_toolbar" className="location-toolbar" hidden>
        <span className="location-toolbar-label">Locations</span>
        <div className="location-toolbar-content">
          <div id="planet_selector" />
          <span className="location-toolbar-help">Shift-click to combine</span>
        </div>
      </div>
      <div className="progression-presets" role="group" aria-label="Calculator preset">
        <label htmlFor="progression_preset">Preset</label>
        <select
          id="progression_preset"
          defaultValue=""
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            const value = event.currentTarget.value
            if (isProgressionPreset(value)) commands.applyProgressionPreset(value)
            else if (isQualityPreset(value)) commands.applyQualityPreset(value)
          }}
        >
          <option value="">Custom</option>
          <option value="early">Early game</option>
          <option value="pre-rocket">Pre-rocket</option>
          <option value="first-planets">Early Space Age</option>
          <option value="late-space-age">Late Space Age</option>
          <option value="full-legendary" disabled={!snapshot.settings.equipmentQualityAvailable}>
            Full Legendary
          </option>
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
// endregion react/CalculatorShell.tsx

// region react/useCalculatorStore.ts
export function useCalculatorStore() {
  return useSyncExternalStore(calculatorStore.subscribe, calculatorStore.getSnapshot, calculatorStore.getSnapshot)
}
// endregion react/useCalculatorStore.ts

// region react/CalculatorApp.tsx
export function CalculatorApp() {
  const snapshot = useCalculatorStore()

  useLayoutEffect(() => {
    calculatorStore.start()
    init()
    return () => {
      dispose()
      calculatorStore.dispose()
    }
  }, [])

  return <CalculatorShell commands={calculatorStore.commands} snapshot={snapshot} />
}
// endregion react/CalculatorApp.tsx

// region main.tsx
export function mountCalculator(rootElement: HTMLElement): void {
  installCalculatorStyles()
  void import("tippy.js/dist/tippy.css")
  createRoot(rootElement).render(<CalculatorApp />)
}

if (typeof document !== "undefined") {
  const rootElement = document.getElementById?.("root")
  if (rootElement != null) mountCalculator(rootElement)
}
// endregion main.tsx
