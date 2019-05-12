//
// Generic
//

const nextSymbol = ([a, b], escapeChar, specialChars) =>
  a === escapeChar && specialChars.includes(b) ? 2 : 1;

const flattenSymbol = (symbol, escapeChar, specialChars) => {
  const [a, b] = symbol;
  if (a === escapeChar && specialChars.includes(b)) {
    return b;
  }
  return symbol;
}

const parseSymbols = (string, parser) => {
  const symbols = [];
  
  for (let i = 0; i < string.length; i++) {
    const slice = string.substring(i, string.length);
    const distance = parser(slice);
    const symbol = string.substr(i, distance);
    
    symbols.push(symbol);
    i += distance - 1;
  }
  
  return new LT.Symbols(symbols);
};

//
// Display String
//

const specialInputCharacters = ['\\', '<', '>', '*'];

const nextInputSymbol = string =>
  nextSymbol(string, '\\', specialInputCharacters);

const flattenInputSymbol = symbol =>
  flattenSymbol(symbol, '\\', specialInputCharacters);

const parseInput = string =>
  parseSymbols(string, nextInputSymbol);

const flattenInput = x =>
  x.flatMap(flattenInputSymbol).toString();

const constructTextCells = symbols =>
  symbols.split('*')
  .map(x => x.trim())
  .map((cell) => {
    // check, whether the cell contains an opening alignment marker
    const alignBegin = cell.indexOf('<');
    
    if (alignBegin !== -1) {
      // opening alignment marker found, search for closing alignment marker
      let alignEnd = cell.indexOf('>');
    
      if (alignEnd === -1) {
        // no closing alignment marker, use end of string as end of alignment
        alignEnd = cell.length;
      }
      
      return new LT.Cell([
        new LT.Text(flattenInput(cell.slice(0, alignBegin))),
        new LT.Text(flattenInput(cell.slice(alignBegin + 1, alignEnd)), true),
        new LT.Text(flattenInput(cell.slice(alignEnd + 1, cell.length))),
      ]);
    }
    return new LT.Cell([new LT.Text(flattenInput(cell))]);
  });

//
// Font Settings
//

const cloneConfig = (sourceConfig) => {
  const config = Object.assign({}, sourceConfig);
  
  if (config.features !== undefined) {
    config.features = new Map(config.features);
  }
  
  return config;
};

const parseFontConfiguration = (string, defaultConfig) => {
  const parts = string.split(/[\s,]+/).filter(x => x !== '');
  const config = cloneConfig(defaultConfig);
  
  for (const part of parts) {
    let completeWeight;
    let completeStyle;
    
    if ((completeWeight = complete(part, ['bold'])) !== null) {
      // weight keyword
      config.weight = completeWeight;
    }
    else if (/^\d{3}$/.test(part)) {
      // weight number
      config.weight = part;
    }
    else if ((completeStyle = complete(part, ['italic', 'oblique'])) !== null) {
      // style keyword
      config.style = completeStyle;
    }
    else if (/^[+-]\S{4}$/.test(part)) {
      // OpenType feature tag
      const tag = part.slice(1, 5);
      const enabled = part[0] === '+';
      if (config.features === undefined) config.features = new Map();
      config.features.set(tag, enabled);
    }
  }
  
  return config;
};

const parseFontsString = (string) => string.split(/[\n;]/)
  .filter(x => !/^\s*(?:#|\/\/)/.test(x))
  .map(x => x.match(/^([^:(]*)(?:\(([^):]*)\)\s*)?(?:(?:\(.*)?:(.*))?/))
  .filter(x => x !== null)
  .reduce(([matches, defaultConfig], [, rawName, rawLabel, rawConfig]) => {
    const font = {
      name: rawName.trim(),
      config: defaultConfig,
    };
    
    if (rawLabel !== undefined) {
      font.label = rawLabel.trim();
    }
    if (rawConfig !== undefined) {
      font.config = parseFontConfiguration(rawConfig.trim(), defaultConfig);
    }
    
    if (font.name === '') {
      return [matches, font.config];
    }
    return [matches.concat(font), defaultConfig];
  }, [[], {}])[0];
