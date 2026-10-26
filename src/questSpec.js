// StreetVoxer (https://www.streetvoxer.net/). MIT License, see LICENSE.
"use strict";

export const QuestVerb = Object.freeze({
  Move:     'moved',
  Look:     'looked',
  Reach:    'reached',
  Interact: 'interacted',
  Take:     'taken',
  Build:    'edited',

  Occupy:   'occupied',

  DriveTo:  'drivenTo',

  Lock:     'pointerLocked',
  FirstPerson: 'firstPerson',

  Defeat:   'defeated',

  Board:    'boarded',
});

export const Selector = Object.freeze({
  None:            'none',
  NearestPOI:      'nearestPOI',
  NearestVehicle:  'nearestVehicle',
  AnyEdit:         'anyEdit',

  NearestErrand:   'nearestErrand',

  OfferedVendor:   'offeredVendor',

  OfferedDropoff:  'offeredDropoff',

  QuestGiver:      'questGiver',

  OSMArea:         'osmArea',

  AtGeo:           'atGeo',

  SpawnedVehicle:  'spawnedVehicle',

  BountyTarget:    'bountyTarget',

  SkirmishAllyBase: 'skirmishAllyBase',
  SkirmishFoes:     'skirmishFoes',

  TutorialGuide:   'tutorialGuide',

  TaxiFare:        'taxiFare',
});

export const QuestScope = Object.freeze({

  Once:     'once',

  PerGiver: 'perGiver',

  Repeatable: 'repeatable',
});

export const AUTHORED_QUEST_IDS = Object.freeze(['tutorial', 'mail-run', 'courier-run', 'bounty', 'skirmish', 'taxi']);

export const PARKABLE_SPEC_IDS = Object.freeze(['humvee', 'motorcycle', 'boat', 'humvee-turret', 'humvee-turret-gl', 'tank',
  'taxi', 'helicopter', 'plane']);

export const QUEST_SPEC_FIELDS = Object.freeze(['id', 'name', 'scope', 'steps', 'reward', 'giverLines', 'giverLineKeys', 'race']);
export const QUEST_SPEC_STEP_FIELDS = Object.freeze(['verb', 'selector', 'text', 'textKey', 'short', 'area', 'at', 'spawnParked', 'pin',
  'physicalDeliveryOnly', 'npcOnly', 'arrivalMeters', 'applicable', 'grants', 'consumes', 'craft']);

export const INTERNAL_SELECTORS = Object.freeze([Selector.OfferedVendor, Selector.OfferedDropoff, Selector.BountyTarget,
  Selector.SkirmishAllyBase, Selector.SkirmishFoes, Selector.TaxiFare]);

export const AUTHORABLE_SELECTORS = Object.freeze(Object.keys(Selector).map(function(k){ return Selector[k]; })
  .filter(function(s){ return INTERNAL_SELECTORS.indexOf(s) < 0; }));

function unknownKeys(obj, known){
  for(const k of Object.keys(obj)){
    if(obj[k] !== undefined && known.indexOf(k) < 0) return '"' + k + '"';
  }
  return null;
}

export function validateQuestSpec(spec, opts){
  if(!spec || typeof spec !== 'object') return { ok: false, reason: 'no spec' };
  const id = spec.id;
  if(typeof id !== 'string' || id.length === 0) return { ok: false, reason: 'id must be a non-empty string' };

  if(id.indexOf('@') >= 0) return { ok: false, reason: "id may not contain '@' (instance-key separator)" };
  if(AUTHORED_QUEST_IDS.indexOf(id) >= 0) return { ok: false, reason: 'cannot redefine authored quest "' + id + '"' };
  if(!Array.isArray(spec.steps) || spec.steps.length === 0) return { ok: false, reason: 'steps must be a non-empty array' };
  const scope = spec.scope || QuestScope.Once;
  if(scope !== QuestScope.Once && scope !== QuestScope.PerGiver){
    return { ok: false, reason: 'scope must be "once" or "perGiver"' };
  }
  const isParkable = (opts && typeof opts.isParkableSpecId === 'function') ? opts.isParkableSpecId
    : function(specId){ return PARKABLE_SPEC_IDS.indexOf(specId) >= 0; };

  const unknownTop = unknownKeys(spec, QUEST_SPEC_FIELDS);
  if(unknownTop) return { ok: false, reason: 'unknown field ' + unknownTop + ' (known: ' + QUEST_SPEC_FIELDS.join(', ') + ')' };
  if(spec.reward !== undefined && spec.reward !== null
     && !(spec.reward && Number.isFinite(spec.reward.cents) && spec.reward.cents > 0)){
    return { ok: false, reason: 'reward must be {cents: <positive number>} (got ' + JSON.stringify(spec.reward) + ')' };
  }
  const verbs = new Set(Object.keys(QuestVerb).map(function(k){ return QuestVerb[k]; }));
  const selectors = new Set(Object.keys(Selector).map(function(k){ return Selector[k]; }));
  const steps = [];

  const warnings = [];
  for(let i = 0; i < spec.steps.length; i++){
    const s = spec.steps[i];
    if(!s || typeof s !== 'object') return { ok: false, reason: 'step ' + i + ' is not an object' };
    const unknownStep = unknownKeys(s, QUEST_SPEC_STEP_FIELDS);
    if(unknownStep) return { ok: false, reason: 'step ' + i + ': unknown field ' + unknownStep + ' (known: ' + QUEST_SPEC_STEP_FIELDS.join(', ') + ')' };
    if(!verbs.has(s.verb)) return { ok: false, reason: 'step ' + i + ': unknown verb "' + s.verb + '"' };
    const selector = s.selector || Selector.None;
    if(!selectors.has(selector)) return { ok: false, reason: 'step ' + i + ': unknown selector "' + selector + '"' };
    if(INTERNAL_SELECTORS.indexOf(selector) >= 0){
      return { ok: false, reason: 'step ' + i + ': selector "' + selector + '" belongs to a generated quest (courier, bounty or '
                                  + 'skirmish) and reads that quest\'s own state; for an authored step use atGeo, osmArea, '
                                  + 'spawnedVehicle, questGiver or a nearest* selector' };
    }

    if((s.verb === QuestVerb.Reach || s.verb === QuestVerb.DriveTo)
       && (selector === Selector.None || selector === Selector.AnyEdit)){
      return { ok: false, reason: 'step ' + i + ': verb "' + s.verb + '" measures distance to a target, so it needs a '
                                  + 'selector that names a place (atGeo, osmArea, nearestVehicle, ...) — with "'
                                  + selector + '" it can never complete' };
    }

    if(s.at !== undefined && selector !== Selector.AtGeo){
      return { ok: false, reason: 'step ' + i + ': `at` is only read by selector "atGeo" (this step uses "' + selector + '")' };
    }
    if(s.area !== undefined && selector !== Selector.OSMArea){
      return { ok: false, reason: 'step ' + i + ': `area` is only read by selector "osmArea" (this step uses "' + selector + '")' };
    }
    if(s.spawnParked !== undefined && selector !== Selector.SpawnedVehicle){
      return { ok: false, reason: 'step ' + i + ': `spawnParked` is only read by selector "spawnedVehicle" (this step uses "' + selector + '")' };
    }

    if(s.craft !== undefined){
      if(s.verb !== QuestVerb.DriveTo){
        return { ok: false, reason: 'step ' + i + ': `craft` is only read by verb "' + QuestVerb.DriveTo + '"' };
      }
      if(s.craft !== 'ground' && s.craft !== 'air' && s.craft !== 'any'){
        return { ok: false, reason: 'step ' + i + ': craft must be "ground", "air" or "any"' };
      }
    }
    if(s.arrivalMeters !== undefined && !(Number.isFinite(s.arrivalMeters) && s.arrivalMeters > 0)){
      return { ok: false, reason: 'step ' + i + ': arrivalMeters must be a number > 0' };
    }
    if(s.text !== undefined && s.text !== null && typeof s.text !== 'string'){
      return { ok: false, reason: 'step ' + i + ': text must be a string' };
    }
    if(selector === Selector.OSMArea && !s.area){
      return { ok: false, reason: 'step ' + i + ': selector osmArea needs an `area` criteria object' };
    }

    if(selector === Selector.AtGeo){
      if(!s.at || !Number.isFinite(s.at.lat) || !Number.isFinite(s.at.lon)){
        return { ok: false, reason: 'step ' + i + ': selector atGeo needs `at:{lat, lon, radiusMeters}`' };
      }

      if(Math.abs(s.at.lat) > 90 || Math.abs(s.at.lon) > 180){
        return { ok: false, reason: 'step ' + i + ': atGeo lat must be within ±90 and lon within ±180 (degrees)' };
      }
      if(!(s.at.radiusMeters > 0)){
        return { ok: false, reason: 'step ' + i + ': atGeo `radiusMeters` is required and must be > 0'
                                    };
      }

      const g = s.at.gate, b = s.at.box;
      if((g !== undefined || b !== undefined) && s.verb !== QuestVerb.DriveTo){
        return { ok: false, reason: 'step ' + i + ': atGeo `gate` / `box` are only read by verb "' + QuestVerb.DriveTo + '"' };
      }
      if(g !== undefined && b !== undefined){
        return { ok: false, reason: 'step ' + i + ': atGeo takes a `gate` OR a `box`, not both' };
      }
      if(g !== undefined && !(g && Number.isFinite(g.headingDeg) && g.halfWidthMeters > 0)){
        return { ok: false, reason: 'step ' + i + ': atGeo `gate` must be {headingDeg, halfWidthMeters > 0, altitude?}' };
      }

      const band = g && g.altitude;
      if(band !== undefined && !(band && Number.isFinite(band.minMeters) && Number.isFinite(band.maxMeters)
         && band.maxMeters > band.minMeters && (band.ref === undefined || band.ref === 'agl' || band.ref === 'msl'))){
        return { ok: false, reason: 'step ' + i + ': atGeo `gate.altitude` must be {minMeters, maxMeters > minMeters, ref?: "agl" | "msl"}' };
      }
      if(b !== undefined && !(b && Number.isFinite(b.headingDeg) && b.lengthMeters > 0 && b.halfWidthMeters > 0
         && (b.maxSpeedMps === undefined || (Number.isFinite(b.maxSpeedMps) && b.maxSpeedMps >= 0))
         && (b.dwellSeconds === undefined || (Number.isFinite(b.dwellSeconds) && b.dwellSeconds >= 0)))){
        return { ok: false, reason: 'step ' + i + ': atGeo `box` must be {headingDeg, lengthMeters > 0, halfWidthMeters > 0, '
                                    + 'maxSpeedMps? >= 0, dwellSeconds? >= 0}' };
      }
    }

    if(selector === Selector.SpawnedVehicle){
      if(!s.spawnParked || typeof s.spawnParked.specId !== 'string' || !isParkable(s.spawnParked.specId)){
        return { ok: false, reason: 'step ' + i + ': selector spawnedVehicle needs `spawnParked:{specId}` naming a '
                                    + 'parkable machine (a vehicleTypes.js id, or the helicopter)' };
      }
    }

    const out = { verb: s.verb, selector: selector,

                  textKey: (typeof s.textKey === 'string') ? s.textKey : null,

                  text: typeof s.text === 'string' ? s.text : null };
    if(s.area && typeof s.area === 'object') out.area = s.area;
    if(s.at && typeof s.at === 'object') out.at = s.at;
    if(s.spawnParked && typeof s.spawnParked === 'object'){
      out.spawnParked = { specId: s.spawnParked.specId,
        distanceMeters: s.spawnParked.distanceMeters, offsetBearingDeg: s.spawnParked.offsetBearingDeg,
        bearingDeg: s.spawnParked.bearingDeg };
    }

    if(s.pin) out.pin = true;

    if(typeof s.short === 'string' && s.short.trim()) out.short = s.short.trim().slice(0, 80);

    if(s.physicalDeliveryOnly) out.physicalDeliveryOnly = true;
    if(s.npcOnly) out.npcOnly = true;
    if(typeof s.arrivalMeters === 'number') out.arrivalMeters = s.arrivalMeters;
    if(typeof s.craft === 'string') out.craft = s.craft;
    if(typeof s.applicable === 'function') out.applicable = s.applicable;

    if(Array.isArray(s.grants)){
      const g = s.grants.filter(function(x){ return x && typeof x.key === 'string' && x.key.length > 0; });
      if(g.length > 0) out.grants = g;
      if(g.length < s.grants.length) warnings.push('step ' + i + ': dropped ' + (s.grants.length - g.length) + ' grants entr' + ((s.grants.length - g.length) === 1 ? 'y' : 'ies') + ' with no string `key`');
    }
    if(Array.isArray(s.consumes)){
      const c = s.consumes.filter(function(x){ return x && typeof x.key === 'string' && x.key.length > 0; });
      if(c.length > 0) out.consumes = c;
      if(c.length < s.consumes.length) warnings.push('step ' + i + ': dropped ' + (s.consumes.length - c.length) + ' consumes entr' + ((s.consumes.length - c.length) === 1 ? 'y' : 'ies') + ' with no string `key`');
    }
    steps.push(out);
  }
  return { ok: true, id: id, name: (typeof spec.name === 'string' && spec.name) || id, scope: scope,
           steps: steps, warnings: warnings };
}
