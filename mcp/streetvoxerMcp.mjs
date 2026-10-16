// StreetVoxer (https://www.streetvoxer.net/). MIT License, see LICENSE.
import { OSM_SHARDS, osmShardsForTile } from '../src/osmShards.js';
import { buildSpawnLink, buildScenarioLink, checkSpawnPose, checkScenario, decodeScenarioFragment,
         SCENARIO_LINK_SOFT_MAX_CHARS, SCENARIO_LINK_REWARD_MAX_CENTS,
         SCENARIO_LINK_PRELOAD_MAX_RADIUS_METERS, SCENARIO_LINK_PRELOAD_MAX_OFFSET_METERS } from '../src/scenarioLink.js';
import { QuestVerb, AUTHORABLE_SELECTORS, QUEST_SPEC_FIELDS, QUEST_SPEC_STEP_FIELDS, PARKABLE_SPEC_IDS } from '../src/questSpec.js';
import { CANONICAL_HOST } from '../src/deployConfig.js';

export const MCP_SERVER_NAME = 'streetvoxer';

export const MCP_SERVER_VERSION = '1.0.0';

export const MCP_PROTOCOL_VERSIONS = Object.freeze(['2025-06-18', '2025-03-26', '2024-11-05']);
export const DEFAULT_BASE_URL = 'https://' + CANONICAL_HOST.toLowerCase() + '/';

const COVERAGE_TILE_ZOOM = 15;

const INSTRUCTIONS =
  'StreetVoxer (www.streetvoxer.net) renders the real world as voxels in the browser from OpenStreetMap, '
  + 'elevation and aerial imagery; you can walk, drive and fly in it. These tools write LINKS for the user to '
  + 'open - nothing runs on the server. Use coverage to check a place has map data, make_spawn_link to open a '
  + 'place, and make_scenario_link to open it with a game (a quest of steps such as reach a point, drive '
  + 'through gates, stand on a park). A refused link comes back with the reason the game itself would give.';

const MODE_TO_CTRL = Object.freeze({ onFoot: 1, vehicle: 2, freeCamera: 0 });

const POSE_PROPERTIES = {
  lat: { type: 'number', description: 'Latitude, degrees (WGS84), within ±85.' },
  lon: { type: 'number', description: 'Longitude, degrees (WGS84), within ±180.' },
  bearingDeg: { type: 'number', description: 'Facing, degrees clockwise from north. Default: the page picks.' },
  mode: { type: 'string', enum: Object.keys(MODE_TO_CTRL),
          description: 'How the user arrives: onFoot (default), vehicle (in a car) or freeCamera (flying, above the ground).' },
  elevationMeters: { type: 'number', description: 'Metres above sea level. freeCamera: the altitude it flies at. '
          + 'onFoot / vehicle: where the ground search STARTS, so a value just above a floor puts the user inside that building '
          + 'rather than on its roof. Usually omit.' },
  pitchDeg: { type: 'number', description: 'Camera pitch for freeCamera only, degrees (0 level, -90 straight down).' },
};
const POSE_ARG_NAMES = Object.keys(POSE_PROPERTIES);

const QUEST_DESCRIPTION =
  'A defineQuest spec: {id, name?, reward?: {cents}, steps: [...]}. Each step is {verb, selector?, text?, ...}. '
  + 'Verbs: ' + Object.keys(QuestVerb).map(function(k){ return QuestVerb[k]; }).join(', ') + '. '
  + 'Selectors: ' + AUTHORABLE_SELECTORS.join(', ') + '. '
  + 'The place-naming ones: atGeo needs at:{lat, lon, radiusMeters, name?} and always resolves (use it for gates and '
  + 'meeting points); osmArea needs area:{bucket?, tag?, value?, id?} (e.g. {tag:"leisure", value:"park"}) and skips the '
  + 'step if nothing matches here; spawnedVehicle needs spawnParked:{specId} with specId one of '
  + PARKABLE_SPEC_IDS.join(', ') + '. reached and drivenTo need a place-naming selector. '
  + '`text` may use {target} for the resolved place name. Spec fields: ' + QUEST_SPEC_FIELDS.join(', ')
  + '. Step fields: ' + QUEST_SPEC_STEP_FIELDS.join(', ') + '. Unknown fields are refused, not ignored. '
  + 'A linked quest must be scope "once" (the default) and may pay at most ' + SCENARIO_LINK_REWARD_MAX_CENTS + ' cents. '
  + 'Example step: {"verb":"reached","selector":"atGeo","at":{"lat":32.7765,"lon":-79.9311,"radiusMeters":15,"name":"the fountain"},'
  + '"text":"Walk to {target}"}.';

export const TOOLS = Object.freeze([
  {
    name: 'coverage',
    title: 'Map coverage at a point',
    description: 'Whether StreetVoxer has OpenStreetMap data (buildings, roads, water, trees) at a coordinate, and from which '
      + 'regional archive. Terrain is worldwide either way. Call this before sending a user somewhere unfamiliar: an '
      + 'uncovered point opens as bare terrain.',
    inputSchema: { type: 'object', properties: { lat: POSE_PROPERTIES.lat, lon: POSE_PROPERTIES.lon },
                   required: ['lat', 'lon'], additionalProperties: false },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'make_spawn_link',
    title: 'Link to a place',
    description: 'A URL that opens StreetVoxer at a coordinate, on foot by default. Give it to the user to open in a '
      + 'desktop browser with WebGPU (current Chrome or Edge).',
    inputSchema: { type: 'object', properties: POSE_PROPERTIES, required: ['lat', 'lon'], additionalProperties: false },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'make_scenario_link',
    title: 'Link to a game at a place',
    description: 'A URL that opens StreetVoxer at a coordinate and starts a quest there once the world has loaded. The '
      + 'quest is checked by the same validator the game runs, so a link this returns is one the game accepts; a refusal '
      + 'says what to change. Optional preload warms the area first (it moves the camera for a few minutes).',
    inputSchema: {
      type: 'object',
      properties: Object.assign({}, POSE_PROPERTIES, {
        quest: { type: 'object', description: QUEST_DESCRIPTION },
        preload: { type: 'object', description: 'Optional {radiusMeters, lat?, lon?}: generate and cache the area before the '
          + 'quest starts. radiusMeters at most ' + SCENARIO_LINK_PRELOAD_MAX_RADIUS_METERS + '; the centre defaults to the '
          + 'spawn and may be at most ' + SCENARIO_LINK_PRELOAD_MAX_OFFSET_METERS + ' m from it. With a preload, quest may be omitted.',
          properties: { radiusMeters: { type: 'number' }, lat: { type: 'number' }, lon: { type: 'number' } },
          additionalProperties: false },
      }),
      required: ['lat', 'lon'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'read_scenario_link',
    title: 'Read a StreetVoxer link',
    description: 'Decode a StreetVoxer URL: where it opens, the quest and preload it carries, and whether the game would '
      + 'accept them. Use it to check a link someone else wrote.',
    inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'A StreetVoxer URL.' } },
                   required: ['url'], additionalProperties: false },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
]);

function unknownArg(args, known){
  for(const k of Object.keys(args)){
    if(args[k] !== undefined && known.indexOf(k) < 0) return 'unknown argument ' + JSON.stringify(k) + ' (known: ' + known.join(', ') + ')';
  }
  return null;
}

function lonLatToTile(lat, lon, z){
  const n = 1 << z;
  const x = Math.min(n - 1, Math.max(0, Math.floor((lon + 180) / 360 * n)));
  const r = lat * Math.PI / 180;
  const y = Math.min(n - 1, Math.max(0, Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)));
  return { x: x, y: y };
}

function poseFromArgs(args){
  const mode = args.mode === undefined ? 'onFoot' : args.mode;
  if(!Object.prototype.hasOwnProperty.call(MODE_TO_CTRL, mode)){
    return { ok: false, reason: 'mode must be one of ' + Object.keys(MODE_TO_CTRL).join(', ') };
  }
  if(args.pitchDeg !== undefined && mode !== 'freeCamera'){
    return { ok: false, reason: 'pitchDeg only applies to mode "freeCamera" (on foot and in a vehicle the camera follows the player)' };
  }
  const pose = { lat: args.lat, lon: args.lon, ctrl: MODE_TO_CTRL[mode] };
  if(args.bearingDeg !== undefined) pose.bear = args.bearingDeg;
  if(args.elevationMeters !== undefined) pose.elev = args.elevationMeters;
  if(args.pitchDeg !== undefined) pose.pitch = args.pitchDeg;
  const chk = checkSpawnPose(pose);
  if(!chk.ok) return { ok: false, reason: chk.reason.replace(/^bear\b/, 'bearingDeg').replace(/^elev\b/, 'elevationMeters').replace(/^pitch\b/, 'pitchDeg') };
  if(pose.bear !== undefined) pose.bear = Math.round((((pose.bear % 360) + 360) % 360) * 10) / 10;
  return { ok: true, pose: pose, mode: mode };
}

function toolCoverage(args){
  const bad = unknownArg(args, ['lat', 'lon']);
  if(bad) return { ok: false, reason: bad };
  if(!Number.isFinite(args.lat) || Math.abs(args.lat) > 85) return { ok: false, reason: 'lat must be a number within ±85 degrees' };
  if(!Number.isFinite(args.lon) || Math.abs(args.lon) > 180) return { ok: false, reason: 'lon must be a number within ±180 degrees' };
  const t = lonLatToTile(args.lat, args.lon, COVERAGE_TILE_ZOOM);
  const shards = osmShardsForTile(COVERAGE_TILE_ZOOM, t.x, t.y);
  const out = {
    ok: true,
    lat: args.lat, lon: args.lon,
    tile: COVERAGE_TILE_ZOOM + '/' + t.x + '/' + t.y,
    covered: shards.length > 0,
    archives: shards.map(function(s){ return { id: s.id, label: s.label, vintage: s.vintage }; }),
  };
  if(shards.length > 1) out.note = 'This tile is on the border between two archives; the game reads both.';
  if(shards.length === 0){
    out.note = 'No map archive covers this point, so it opens as terrain with no buildings, roads or water. Open sea has '
      + 'no map data, and mainland China, Hong Kong and Macau are excluded on purpose.';
  }
  out.detail = 'How detailed it looks depends on how thoroughly OpenStreetMap is mapped here: building heights and '
    + 'parts come from OSM tags, and an unmapped town is flat boxes or nothing. Aerial imagery is sharp in the United States '
    + 'and coarse elsewhere.';
  return out;
}

function toolMakeSpawnLink(args, ctx){
  const bad = unknownArg(args, POSE_ARG_NAMES);
  if(bad) return { ok: false, reason: bad };
  const p = poseFromArgs(args);
  if(!p.ok) return p;
  const url = buildSpawnLink(ctx.baseUrl, p.pose);
  return { ok: true, url: url, mode: p.mode, covered: osmCoveredAt(p.pose.lat, p.pose.lon) };
}

function toolMakeScenarioLink(args, ctx){
  const bad = unknownArg(args, POSE_ARG_NAMES.concat(['quest', 'preload']));
  if(bad) return { ok: false, reason: bad };
  const p = poseFromArgs(args);
  if(!p.ok) return p;
  if(args.quest !== undefined && (args.quest === null || typeof args.quest !== 'object' || Array.isArray(args.quest))){
    return { ok: false, reason: 'quest must be an object (a defineQuest spec)' };
  }
  const extra = args.preload !== undefined ? { preload: args.preload } : null;
  const chk = checkScenario(args.quest || null, extra);
  if(!chk.ok) return { ok: false, reason: chk.reason };

  if(extra && Number.isFinite(extra.preload.lat) && Number.isFinite(extra.preload.lon)){
    const d = haversineMeters(p.pose.lat, p.pose.lon, extra.preload.lat, extra.preload.lon);
    if(d > SCENARIO_LINK_PRELOAD_MAX_OFFSET_METERS){
      return { ok: false, reason: 'preload centre is ' + Math.round(d) + ' m from the spawn; at most '
                                 + SCENARIO_LINK_PRELOAD_MAX_OFFSET_METERS + ' m' };
    }
  }
  const url = buildScenarioLink(ctx.baseUrl, p.pose, args.quest || null, extra);
  const out = { ok: true, url: url, chars: url.length, questId: chk.questId, mode: p.mode,
                covered: osmCoveredAt(p.pose.lat, p.pose.lon) };
  const warnings = chk.warnings.slice();
  if(url.length > SCENARIO_LINK_SOFT_MAX_CHARS){
    warnings.push('link is ' + url.length + ' characters; chat apps and messengers may truncate past ~' + SCENARIO_LINK_SOFT_MAX_CHARS);
  }
  if(!out.covered) warnings.push('no map archive covers the spawn: selectors that need map features (osmArea, nearest*) will skip');
  if(warnings.length) out.warnings = warnings;
  return out;
}

function toolReadScenarioLink(args){
  const bad = unknownArg(args, ['url']);
  if(bad) return { ok: false, reason: bad };
  if(typeof args.url !== 'string' || !args.url) return { ok: false, reason: 'url must be a string' };
  let u;
  try { u = new URL(args.url); } catch(e){ return { ok: false, reason: 'not a URL' }; }
  const pose = {};
  for(const k of ['lat', 'lon', 'bear', 'ctrl', 'elev', 'pitch']){
    const v = u.searchParams.get(k);
    if(v !== null && v !== '') pose[k] = Number(v);
  }
  const out = { ok: true, pose: pose };
  const poseChk = checkSpawnPose(pose);
  if(!poseChk.ok) out.poseProblem = poseChk.reason;
  else out.covered = osmCoveredAt(pose.lat, pose.lon);
  const decoded = decodeScenarioFragment(u.hash);
  if(!decoded.present){ out.scenario = null; return out; }
  if(!decoded.ok){ out.scenario = { accepted: false, reason: decoded.reason }; return out; }
  const chk = checkScenario(decoded.quest, decoded.preload ? { preload: decoded.preload } : null);
  out.scenario = { accepted: chk.ok, quest: decoded.quest, preload: decoded.preload };
  if(!chk.ok) out.scenario.reason = chk.reason;
  else if(chk.warnings.length) out.scenario.warnings = chk.warnings;
  return out;
}

function osmCoveredAt(lat, lon){
  const t = lonLatToTile(lat, lon, COVERAGE_TILE_ZOOM);
  return osmShardsForTile(COVERAGE_TILE_ZOOM, t.x, t.y).length > 0;
}

function haversineMeters(lat1, lon1, lat2, lon2){
  const R = 6371008.8, r = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

const TOOL_IMPLS = { coverage: toolCoverage, make_spawn_link: toolMakeSpawnLink,
                     make_scenario_link: toolMakeScenarioLink, read_scenario_link: toolReadScenarioLink };

export function callTool(name, args, opts){
  const impl = TOOL_IMPLS[name];
  if(!impl) return { ok: false, reason: 'unknown tool ' + JSON.stringify(name) };
  return impl(args || {}, { baseUrl: (opts && opts.baseUrl) || DEFAULT_BASE_URL });
}

function rpcResult(id, result){ return { jsonrpc: '2.0', id: id, result: result }; }
function rpcError(id, code, message){ return { jsonrpc: '2.0', id: id === undefined ? null : id, error: { code: code, message: message } }; }

function handleOne(msg, opts){
  if(!msg || typeof msg !== 'object' || Array.isArray(msg) || msg.jsonrpc !== '2.0'){
    return rpcError(null, -32600, 'invalid JSON-RPC 2.0 message');
  }
  const isRequest = typeof msg.method === 'string' && msg.id !== undefined && msg.id !== null;

  if(!isRequest){
    if(typeof msg.method === 'string' || msg.result !== undefined || msg.error !== undefined) return null;
    return rpcError(msg.id, -32600, 'invalid JSON-RPC 2.0 message');
  }
  const params = (msg.params && typeof msg.params === 'object') ? msg.params : {};
  switch(msg.method){
    case 'initialize': {
      const asked = params.protocolVersion;
      return rpcResult(msg.id, {
        protocolVersion: MCP_PROTOCOL_VERSIONS.indexOf(asked) >= 0 ? asked : MCP_PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: MCP_SERVER_NAME, title: 'StreetVoxer', version: MCP_SERVER_VERSION },
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return rpcResult(msg.id, {});
    case 'tools/list':
      return rpcResult(msg.id, { tools: TOOLS });
    case 'tools/call': {
      const name = params.name;
      if(!TOOL_IMPLS[name]) return rpcError(msg.id, -32602, 'unknown tool ' + JSON.stringify(name));
      const args = params.arguments === undefined ? {} : params.arguments;
      if(!args || typeof args !== 'object' || Array.isArray(args)) return rpcError(msg.id, -32602, 'arguments must be an object');
      let res;
      try { res = callTool(name, args, opts); }
      catch(e){ res = { ok: false, reason: 'internal error: ' + ((e && e.message) || e) }; }
      if(!res.ok) return rpcResult(msg.id, { content: [{ type: 'text', text: res.reason }], isError: true });
      const body = Object.assign({}, res);
      delete body.ok;
      return rpcResult(msg.id, { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }], structuredContent: body });
    }
    default:
      return rpcError(msg.id, -32601, 'method not found: ' + msg.method);
  }
}

export function handleMcpPayload(payload, opts){
  if(Array.isArray(payload)){
    if(payload.length === 0) return rpcError(null, -32600, 'empty batch');
    const out = [];
    for(const m of payload){ const r = handleOne(m, opts); if(r) out.push(r); }
    return out.length ? out : null;
  }
  return handleOne(payload, opts);
}

export function describeArchives(){
  return OSM_SHARDS.map(function(s){ return { id: s.id, label: s.label, vintage: s.vintage }; });
}
