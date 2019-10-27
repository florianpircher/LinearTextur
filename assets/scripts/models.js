LT.Interface = class Interface {
  constructor() {
    this.endpoints = {};
    this.queue = [];
  }
  
  addEndpoint(properties, scope) {
    this.queue.push({ properties, scope });
  }
  
  processQueue() {
    let item = null;
    
    while (item = this.queue.shift()) {
      const { properties, scope } = item;
      this.endpoints[properties] = scope(properties);
    }
  }
  
  init(draw, state) {
    state.drawingEnabled = false;
    this.processQueue();
    state.drawingEnabled = true;
    draw(state);
  }
};

LT.Cell = class Cell {
  constructor(spans) {
    this.spans = spans;  // [Text | AlignmentText]
  }
};

LT.Text = class Text {
  constructor(value, isAlignmentMarker = false) {
    this.value = value;  // string
    this.isAlignmentMarker = isAlignmentMarker;  // boolean
  }
};

/*
 * 
 * A font is an instance of a typeface. Its form closely models the font
 * description of CSS. The file to be used is selecte by the `name` and may be
 * altered by specifying a weight- and/or style-varient using the `config`. The
 * font configuration also allows to select OpenType display variants.
 * 
 * A label can be provided, which is used instead of the name for display
 * purposes. An optional scale-factor may be specified to scale text rendered
 * using the font. If no scale factor is provided a value of 1 (no scaling) is
 * to be assumed.
 * 
 * Note that font files may not be reachable before the document fully loaded.
 * Therefore some operations, such as measuring font metrics, might not work
 * during page load.
 * 
 * :font-weight = string{:ex ("400" "bold")}
 * :font-style = string{:ex ("italic" "oblique")}
 * :opentype-tag = string{:length 4, :ex ("smcp" "dlig")}
 * :font-features = map{:keys {:opentype-tag :boolean}}
 * :font-config = map{:keys {
 *   "weight" *font-weight
 *   "style" *font-style
 *   "features" *font-features}}
 * 
 * :font-name = string{
 *   :desc "CSS font-name, typically the PostScript name of the font"
 *   :ex ("Futura" "ArnoPro-Display")}
 * :font-label = string{:ex ("Futura" "Arno (Display)")}
 * :font-scale-factor = number{ 
 *   :ex (0.7, 1.0, 1.2)
 *   :desc "scale factor for when drawing the font"}
 * :font = map{:keys {
 *   "name" *font-name
 *   "label" *font-label
 *   "config" *font-config
 *   "scaleFactor" *font-scale-factor}}
 */

const fallbackFont = { name: LT.storage.fontStacks.standard };
const notDefinedFont = { name: LT.storage.fontStacks.notDefined };

// Font Tools

const containsCharacterCache = new Map();

const containsCharacter = (font, char) => {
  if (!containsCharacterCache.has(font.name)) {
    containsCharacterCache.set(font.name, new Map());
  }
  const charMap = containsCharacterCache.get(font.name);
  
  if (charMap.has(char)) return charMap.get(char);
  
  const width = LT.drawing.canvas.width;
  const height = LT.drawing.canvas.height;
  const ctx = LT.drawing.context;
  
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000';
  
  ctx.font = `${height}px ${font.name}, ${LT.storage.fontStacks.notDefined}`;
  ctx.fillText(char, 0, height);
  const refImg = ctx.getImageData(0, 0, width, height).data;
  
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000';
  
  ctx.font = `${height}px ${font.name}`;
  ctx.fillText(char, 0, height);
  const defImg = ctx.getImageData(0, 0, width, height).data;
  
  const isMatch = (() => {
    for (let y = 3; y < height; y += 6) {
      for (let x = 1; x < width; x += 6) {
        const index = 4 * (y * width + x);
        if (refImg[index] !== defImg[index]) return false;
      }
    }
    return true;
  })();
  
  charMap.set(char, isMatch);
  return isMatch;
};

const idFontCache = new Map();

const idFont = (font) => {
  if (idFontCache.has(font.name)) return idFontCache.get(font.name);
  
  LT.drawing.context.font = `32px ${font.name}`;
  
  const id = [...'xgh@AW*| &?', 'LVAW.Y+Ta']
    .map(x => LT.drawing.context.measureText(x).width)
    .reduce((acc, x) => acc + x, 0);
  
  idFontCache.set(font.name, id);
  return id;
};

const fontExists = (font) => {
  const testFont = { name: `${font.name}, ${LT.storage.fontStacks.notDefined}` };
  return idFont(testFont) !== idFont(notDefinedFont);
};

const applyFontToElement = (font, element, fontStack, normalize = true) => {
  element.style.fontFamily = `${font.name}, ${fontStack}`;
  
  if (normalize) {
    element.style.fontSize = `${font.scaleFactor}em`;
  }
  
  if (font.config !== undefined) {
    const config = font.config;
    
    // use string accessors to allow for advanced optimization mode
    if (config.weight !== undefined) {
      element.style['fontWeight'] = config.weight;
    }
    if (config.style !== undefined) {
      element.style['fontStyle'] = config.style;
    }
    if (config.features !== undefined) {
      element.style['fontFeatureSettings'] = Array.from(config.features.entries())
        .map(([tag, enabled]) => `'${tag}' ${enabled ? 'on' : 'off'}`)
        .join(', ');
    }
  }
};

// Microsoft Edge does not support the description field on symbols.
const DescriptionSymbol = (description) => ({ description });

LT.MatchHeightMethod = {
  bodyHeight: DescriptionSymbol('body-height'),
  capHeight: DescriptionSymbol('cap-height'),
  xHeight: DescriptionSymbol('x-height'),
};

LT.Rendering = class Rendering {
  constructor(cell, font, element, textWrapper, spanNodes, spanRects = undefined) {
    this.cell = cell;  // Cell
    this.font = font;  // Font
    this.element = element;  // [HTMLElement]
    this.textWrapper = textWrapper;  // [HTMLElement]
    this.spanNodes = spanNodes;  // [HTMLElement]
    this.spanRects = spanRects;  // [DOMRect]?
  }
  
  get alignmentWidth() {
    return this.spanRects[1].width;
  }
  
  get offsetLeft() {
    return this.spanRects[1].left;
  }
};

LT.Row = class Row {
  constructor(font, renderings) {
    this.font = font;
    this.renderings = renderings;
  }
};

LT.Matrix = class Matrix {
  constructor(rows) {
    this.rows = rows;  // [[RenderingView]]
  }
  
  * [Symbol.iterator]() {
    for (let i = 0; i < this.columnCount; i++) {
      yield this.columnAt(i);
    }
  }
  
  get columnCount() {
    if (this.rows.length === 0) {
      return 0;
    }
    return this.rows[0].length;
  }
  
  columnAt(index) {
    if (index < 0 || index >= this.columnCount) {
      return undefined;
    }
    return new LT.Column(this.rows.map(x => x[index]));
  }
};

LT.Column = class Column {
  constructor(renderings) {
    this.renderings = renderings;  // [Rendering]
  }
  
  get spans() {
    return this.renderings[0].cell.spans;
  }
  
  get textValue() {
    return this.spans.map(x => x.value).join('');
  }
};

LT.Symbols = class Symbols {
  constructor(symbols) {
    this.symbols = symbols;
  }
  
  get length() {
    return this.symbols.length;
  }
  
  get absLength() {
    let distance = 0;
    
    for (let i = 0; i < this.symbols.length; i++) {
      distance += this.symbols[i].length;
    }
    
    return distance;
  }
  
  flatMap(handler) {
    return new LT.Symbols(this.symbols.map(handler).filter(x => x !== null));
  }
  
  slice(begin, end) {
    return new LT.Symbols(this.symbols.slice(begin, end));
  }
  
  indexOf(symbol) {
    return this.symbols.indexOf(symbol);
  }
  
  insertAtAbs(index, symbol) {
    let distance = 0;
    
    for (let i = 0; i <= this.symbols.length; i++) {
      if (distance >= index) {
        this.symbols.splice(i, 0, symbol);
        return;
      }
      
      if (i !== this.symbols.length) {
        distance += this.symbols[i].length;
      }
    }
  }
  
  trim() {
    const xs = [...this.symbols];
    
    while (xs.length > 1 && /^\s+$/.test(xs[0])) {
      xs.shift();
    }
    while (xs.length > 1 && /^\s+$/.test(xs[xs.length - 1])) {
      xs.pop();
    }
    
    return new LT.Symbols(xs);
  }
  
  absRangeFromTo(beginSymbol, endSymbol) {
    let distance = 0;
    let beginIndex = null;
    
    for (const [i, x] of this.symbols.entries()) {
      if (this.symbols[i] === beginSymbol) {
        beginIndex = distance;
      }
      if (this.symbols[i] === endSymbol) {
        return { beginIndex, endIndex: distance };
      }
      
      distance += x.length;
    }
    return { beginIndex, endIndex: null };
  }
  
  split(seperator) {
    const array = [];
    const len = this.symbols.length;
    let splitBegin = 0;
    
    for (let i = 0; i < len; i++) {
      if (this.symbols[i] === seperator) {
        array.push(new LT.Symbols(this.symbols.slice(splitBegin, i)));
        splitBegin = i + 1;
      }
    }
    
    if (splitBegin !== len) {
      array.push(new LT.Symbols(this.symbols.slice(splitBegin, len)));
    }
    
    return array;
  }
  
  toString() {
    return this.symbols.join('');
  }
};
