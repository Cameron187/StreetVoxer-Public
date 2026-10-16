// StreetVoxer (https://www.streetvoxer.net/). MIT License, see LICENSE.
"use strict";

import { validateQuestSpec } from './questSpec.js';

export const SCENARIO_LINK_VERSION = 1;
const FRAGMENT_KEY = 'scenario';
const B64_PREFIX = 'b64.';

export const SCENARIO_LINK_SOFT_MAX_CHARS = 2000;

export const SCENARIO_LINK_REWARD_MAX_CENTS = 10000;

export const SCENARIO_LINK_PRELOAD_MAX_RADIUS_METERS = 1500;
export const SCENARIO_LINK_PRELOAD_MAX_OFFSET_METERS = 5000;

const FRAGMENT_SAFE = { '%3A': ':', '%2C': ',', '%40': '@', '%24': '$', '%3B': ';', '%3D': '=', '%2F': '/', '%3F': '?' };

export function encodeScenarioFragment(quest, extra){
  const payload = { v: SCENARIO_LINK_VERSION };
  if(quest) payload.quest = quest;
  if(extra && extra.preload) payload.preload = extra.preload;
  const json = JSON.stringify(payload);
  return FRAGMENT_KEY + '=' + encodeURIComponent(json).replace(/%3A|%2C|%40|%24|%3B|%3D|%2F|%3F/g, function(m){ return FRAGMENT_SAFE[m]; });
}

export function buildScenarioLink(base, pose, quest, extra){
  const q = ['lat=' + pose.lat, 'lon=' + pose.lon];
  if(pose.bear !== undefined) q.push('bear=' + pose.bear);
  if(pose.ctrl !== undefined) q.push('ctrl=' + pose.ctrl);
  if(pose.elev !== undefined) q.push('elev=' + pose.elev);
  if(pose.pitch !== undefined) q.push('pitch=' + pose.pitch);
  return base + '?' + q.join('&') + '#' + encodeScenarioFragment(quest, extra);
}

export function buildSpawnLink(base, pose){
  const q = ['lat=' + pose.lat, 'lon=' + pose.lon];
  if(pose.bear !== undefined) q.push('bear=' + pose.bear);
  if(pose.ctrl !== undefined) q.push('ctrl=' + pose.ctrl);
  if(pose.elev !== undefined) q.push('elev=' + pose.elev);
  if(pose.pitch !== undefined) q.push('pitch=' + pose.pitch);
  return base + '?' + q.join('&');
}

export function checkSpawnPose(pose){
  if(!pose || typeof pose !== 'object') return { ok: false, reason: 'pose must be an object {lat, lon, bear?, ctrl?, elev?, pitch?}' };
  for(const k of Object.keys(pose)){
    if(pose[k] !== undefined && ['lat', 'lon', 'bear', 'ctrl', 'elev', 'pitch'].indexOf(k) < 0){
      return { ok: false, reason: 'unknown pose field ' + JSON.stringify(k) + ' (known: lat, lon, bear, ctrl, elev, pitch)' };
    }
  }
  if(!Number.isFinite(pose.lat) || Math.abs(pose.lat) > 85) return { ok: false, reason: 'lat must be a number within ±85 degrees' };
  if(!Number.isFinite(pose.lon) || Math.abs(pose.lon) > 180) return { ok: false, reason: 'lon must be a number within ±180 degrees' };
  if(pose.bear !== undefined && !Number.isFinite(pose.bear)) return { ok: false, reason: 'bear (bearing, degrees clockwise from north) must be a number' };
  if(pose.ctrl !== undefined && [0, 1, 2].indexOf(pose.ctrl) < 0) return { ok: false, reason: 'ctrl must be 0 (free camera), 1 (on foot) or 2 (vehicle)' };
  if(pose.elev !== undefined && !(Number.isFinite(pose.elev) && pose.elev > -500 && pose.elev < 100000)){
    return { ok: false, reason: 'elev (metres above sea level) must be a number in (-500, 100000)' };
  }
  if(pose.pitch !== undefined && !(Number.isFinite(pose.pitch) && Math.abs(pose.pitch) <= 90)){
    return { ok: false, reason: 'pitch (degrees, 0 level, -90 straight down) must be within ±90' };
  }
  return { ok: true };
}

export function checkScenario(quest, extra){
  const warnings = [];
  let questId = null;
  if(quest){
    const v = validateQuestSpec(quest);
    if(!v.ok) return { ok: false, reason: v.reason };
    if(v.scope !== 'once') return { ok: false, reason: 'a linked quest must be scope "once": nobody hands it over, so there is no giver' };
    questId = v.id;
    for(const w of v.warnings) warnings.push(w);
  }else if(!(extra && extra.preload)){
    return { ok: false, reason: 'need a quest spec, or a preload for a preload-only link' };
  }
  const decoded = decodeScenarioFragment('#' + encodeScenarioFragment(quest || null, extra));
  if(!decoded.ok) return { ok: false, reason: decoded.reason };
  return { ok: true, questId: questId, warnings: warnings };
}

export function decodeScenarioFragment(hash){
  const h = (hash || '').replace(/^#/, '');
  if(!h) return { present: false };
  let raw = null;
  for(const part of h.split('&')){
    if(part.indexOf(FRAGMENT_KEY + '=') === 0){ raw = part.slice(FRAGMENT_KEY.length + 1); break; }
  }
  if(raw === null) return { present: false };
  let json;
  try {
    if(raw.indexOf(B64_PREFIX) === 0){
      const b64 = raw.slice(B64_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
      const bytes = new Uint8Array(bin.length);
      for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      json = new TextDecoder().decode(bytes);
    }else{
      json = decodeURIComponent(raw);
    }
  } catch(e){
    return { present: true, ok: false, reason: 'the scenario could not be decoded (' + e.message + ')' };
  }
  let payload;
  try { payload = JSON.parse(json); }
  catch(e){ return { present: true, ok: false, reason: 'the scenario is not valid JSON (' + e.message + ')' }; }
  if(!payload || typeof payload !== 'object') return { present: true, ok: false, reason: 'the scenario is not an object' };
  if(payload.v !== SCENARIO_LINK_VERSION){
    return { present: true, ok: false, reason: 'unsupported scenario version ' + JSON.stringify(payload.v)
                                              + ' (this build reads ' + SCENARIO_LINK_VERSION + ')' };
  }
  let preload = null;
  if(payload.preload !== undefined){
    const pr = payload.preload;
    if(!pr || typeof pr !== 'object') return { present: true, ok: false, reason: '`preload` must be an object {radiusMeters, lat?, lon?}' };
    for(const k of Object.keys(pr)){
      if(k !== 'radiusMeters' && k !== 'lat' && k !== 'lon') return { present: true, ok: false, reason: 'unknown `preload` field ' + JSON.stringify(k) };
    }
    if(!Number.isFinite(pr.radiusMeters) || pr.radiusMeters <= 0 || pr.radiusMeters > SCENARIO_LINK_PRELOAD_MAX_RADIUS_METERS){
      return { present: true, ok: false, reason: 'preload.radiusMeters must be a number in (0, ' + SCENARIO_LINK_PRELOAD_MAX_RADIUS_METERS
                                                + '] (got ' + JSON.stringify(pr.radiusMeters) + ')' };
    }
    if((pr.lat === undefined) !== (pr.lon === undefined)) return { present: true, ok: false, reason: 'preload needs both lat and lon, or neither (the spawn)' };
    if(pr.lat !== undefined && !(Number.isFinite(pr.lat) && Math.abs(pr.lat) <= 85 && Number.isFinite(pr.lon) && Math.abs(pr.lon) <= 180)){
      return { present: true, ok: false, reason: 'preload lat/lon out of range' };
    }
    preload = { radiusMeters: pr.radiusMeters };
    if(pr.lat !== undefined){ preload.lat = pr.lat; preload.lon = pr.lon; }
  }
  const quest = payload.quest === undefined ? null : payload.quest;
  if(quest === null && !preload) return { present: true, ok: false, reason: 'the scenario has no `quest` object' };
  if(quest !== null && typeof quest !== 'object') return { present: true, ok: false, reason: 'the scenario has no `quest` object' };
  if(quest && quest.reward && Number.isFinite(quest.reward.cents) && quest.reward.cents > SCENARIO_LINK_REWARD_MAX_CENTS){
    return { present: true, ok: false, reason: 'a linked quest may pay at most ' + SCENARIO_LINK_REWARD_MAX_CENTS
                                              + ' cents (this one asks ' + quest.reward.cents + ')' };
  }
  return { present: true, ok: true, quest: quest, preload: preload };
}

export const scenarioFromLoad = (typeof location !== 'undefined')
  ? decodeScenarioFragment(location.hash) : { present: false };

export const scenarioLinkStatus = {
  present: scenarioFromLoad.present, decoded: !!scenarioFromLoad.ok,
  applied: false, ok: null, reason: scenarioFromLoad.ok ? null : (scenarioFromLoad.reason || null),
  questId: null, appliedAtMs: null,

  preload: (scenarioFromLoad.ok && scenarioFromLoad.preload) ? 'pending' : null,
  preloadSummary: null,
};
export function recordScenarioPreload(state, summary){
  scenarioLinkStatus.preload = state;
  if(summary !== undefined) scenarioLinkStatus.preloadSummary = summary || null;
}
export function recordScenarioLinkOutcome(ok, reason, questId){
  scenarioLinkStatus.applied = true;
  scenarioLinkStatus.ok = ok;
  scenarioLinkStatus.reason = reason || null;
  scenarioLinkStatus.questId = questId || null;
  scenarioLinkStatus.appliedAtMs = performance.now();
}
