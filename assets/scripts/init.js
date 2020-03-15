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
    preferences: new Map([['showFontName', true]]),
  };
})();
const LT = LinearTextur;

window['setPreference'] = (key, value) => {
  LT.preferences.set(key, value);
};

LT.preferenceForKey = key => LT.preferences.get(key);
