#!/usr/bin/env node
// StreetVoxer (https://www.streetvoxer.net/). MIT License, see LICENSE.

import { readFileSync } from 'node:fs';
import { buildScenarioLink, decodeScenarioFragment, SCENARIO_LINK_SOFT_MAX_CHARS } from '../src/scenarioLink.js';

const args = process.argv.slice(2);
const file = args.find(function(a){ return !a.startsWith('--'); });
const baseAt = args.indexOf('--base');
const base = baseAt >= 0 ? args[baseAt + 1] : 'https://www.streetvoxer.net/';
if(!file){
  console.error('usage: node tools/scenario-link.mjs <scenario.json> [--base <page url>]');
  process.exit(2);
}
const scenario = JSON.parse(readFileSync(file, 'utf8'));
if(scenario.format !== 'streetvoxer-scenario'){
  console.error(file + ': not a streetvoxer-scenario file (format = ' + JSON.stringify(scenario.format) + ')');
  process.exit(1);
}

const url = buildScenarioLink(base, scenario.pose, scenario.quest || null, scenario.preload ? { preload: scenario.preload } : null);
const check = decodeScenarioFragment(url.slice(url.indexOf('#')));
if(!check.ok){
  console.error(file + ': ' + check.reason);
  process.exit(1);
}
console.log(url);
if(url.length > SCENARIO_LINK_SOFT_MAX_CHARS){
  console.error('warning: ' + url.length + ' characters; chat apps may truncate past ~' + SCENARIO_LINK_SOFT_MAX_CHARS);
}
