const LinearTextur = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  const notDefinedFontName = 'Adobe NotDef';
  
  return {
    drawing: { canvas, context },
    storage: {
      fontStacks: {
        standard: getComputedStyle(document.documentElement).getPropertyValue('--ff-01'),
        notDefined: `"${notDefinedFontName}", monospace`,
      },
      notDefinedFontName: notDefinedFontName,
    },
    preferences: {'showFontName': true},
  };
})();
const LT = LinearTextur;

// Storage

const STORAGE_PREFIX = 'com.linear-textur.app';
const storage = window.localStorage;
const save = (key, value) => storage.setItem(key, JSON.stringify(value));
const load = (key) => {
  const value = storage.getItem(key);
  return value === null ? null : JSON.parse(value);
};

// Preferences

const CONFIG_KEY = STORAGE_PREFIX + '.preferences.config';

window['setPreference'] = (key, value) => {
  LT.preferences[key] = value;
  save(CONFIG_KEY, LT.preferences);
};

const initPreferences = load(CONFIG_KEY);

if (initPreferences !== null) {
  LT.preferences = initPreferences;
}

LT.preferenceForKey = key => LT.preferences[key];
