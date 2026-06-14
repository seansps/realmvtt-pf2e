// Shared sandbox setup for loading PF2e rollhandler scripts in a VM context.
//
// common.js is the commonScript; the per-roll-type handlers share the same
// global scope at runtime. common.js's getEffectsAndModifiersForToken() calls
// getFeaturesFromRunes(), which lives in PF2e.js, so we load both into one
// context (matching how the live ruleset shares scope).
const fs = require("fs");
const vm = require("vm");

const rollhandlersDir = __dirname + "/../rollhandlers";

function createSandbox() {
  // state.lastSet captures the most recent api.setValuesOnTokenById payload so
  // tests can read the resulting curhp (and thus the damage actually applied).
  const state = { lastSet: null, messages: [], effects: [] };

  const api = {
    getValue: () => null,
    setValue: () => {},
    setValues: () => {},
    setValuesOnRecord: () => {},
    getRecord: () => {},
    getValueOnRecord: () => null,
    showNotification: () => {},
    showPrompt: () => {},
    sendMessage: (message) => {
      state.messages.push(message);
    },
    editMessage: () => {},
    getSetting: () => null,
    getTargets: () => [],
    getToken: () => null,
    getOtherTokens: () => [],
    getSelectedTokens: () => [],
    getSelectedOwnedTokens: () => [],
    getSelectedOrDroppedToken: () => [],
    getDistance: () => 5,
    roll: () => {},
    promptRoll: () => {},
    promptRollForToken: () => {},
    rollInstant: () => ({ total: 0 }),
    addEffect: (name) => {
      state.effects.push(name);
    },
    addEffects: (names) => {
      state.effects.push(...names);
    },
    floatText: () => {},
    playAnimation: () => {},
    openRecord: () => {},
    addValue: () => {},
    removeValue: () => {},
    setHidden: () => {},
    getCombatTracker: () => {},
    setValuesOnToken: () => {},
    setValuesOnTokenById: (id, recordType, values, cb) => {
      state.lastSet = values;
      if (cb) cb();
    },
  };

  const sandbox = {
    api,
    console,
    isGM: true,
    record: { data: {}, fields: {}, type: "characters", _id: "test" },
    dataPath: "",
    getNearestParentDataPath: () => "",
    __state: state,
  };
  const ctx = vm.createContext(sandbox);

  for (const file of ["common.js", "PF2e.js"]) {
    const code = fs.readFileSync(rollhandlersDir + "/" + file, "utf8");
    new vm.Script(code, { filename: file }).runInContext(ctx);
  }

  return ctx;
}

module.exports = { createSandbox };
