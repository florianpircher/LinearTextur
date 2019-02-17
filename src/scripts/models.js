LT.Settings = class Settings {
	constructor() {
		this.drawEnabled = true;  // boolean
		this.cells = [];  // [Cell]
		this.fonts = [];  // [Font]
		this.matchHeightMethod = LT.MatchHeightMethod.bodyHeight;  // LT.MatchHeightMethod
		this.autosizeFontSettings = false;  // boolean
		this.showFontLabels = false;  // boolean
	}
};

LT.Interface = class Interface {
	constructor() {
		this.endpoints = new Map();
		this.queue = [];
	}
	
	addEndpoint(properties, scope) {
		this.queue.push({ properties, scope });
	}
	
	processQueue() {
		let item = null;
		
		while (item = this.queue.shift()) {
			const { properties, scope } = item;
			this.endpoints.set(properties, scope(properties));
		}
	}
	
	init(draw, settings) {
		settings.drawEnabled = false;
		this.processQueue();
		settings.drawEnabled = true;
		draw(settings);
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

LT.FontFeature = class FontFeature {
	constructor(tag, enabled) {
		this.tag = tag;  // string
		this.enabled = enabled;  // boolean
	}
	
	toCSS() {
		return `'${this.tag}' ${this.enabled ? 'on' : 'off'}`;
	}
};

LT.FontConfiguration = class FontConfiguration {
	constructor(weight, style, features) {
		this.weight = weight;  // string?, e.g. "400" or "bold"
		this.style = style;  // string?, e.g. "italic" or "oblique"
		this.features = features;  // [FontFeature]
	}
	
	static get none() {
		return new LT.FontConfiguration(null, null, []);
	}
};

LT.Font = class Font {
	constructor(name, label, config) {
		this.name = name;  // string, e.g. "Futura" or "ArnoPro-Display"
		this.label = label;  // string?
		this.config = config;  // FontConfiguration
		this.scaleFactor = 1;  // number, scale factor for when drawing the font
	}
	
	static plain(name) {
		return new LT.Font(name, null, LT.FontConfiguration.none);
	}
	
	static get fallbackFont() {
		return LT.Font.plain(LT.storage.fontStacks.standard);
	}
	
	static get notDefinedFont() {
		return LT.Font.plain(LT.storage.fontStacks.notDefined);
	}
	
	get id() {
		let id = 0;
		
		LT.drawing.context.font = `32px ${this.name}, ${LT.storage.fontStacks.standard}`;
		
		for (const char of [...LT.storage.measureText, LT.storage.measureText]) {
			const measure = LT.drawing.context.measureText(char);
			
			id += measure.width;
		}
		
		return id;
	}
	
	get exists() {
		const testFont = LT.Font.plain(`${this.name}, ${LT.storage.fontStacks.notDefined}`);
		return testFont.id !== LT.Font.notDefinedFont.id;
	}
	
	applyTo(element, { fallback = LT.storage.fontStacks.notDefined } = {}) {
		element.style.fontFamily = `${this.name}, ${fallback}`;
		element.style.fontSize = `${this.scaleFactor}em`;
		
		if (this.config.weight !== null) {
			element.style.fontWeight = this.config.weight;
		}
		if (this.config.style !== null) {
			element.style.fontStyle = this.config.style;
		}
		
		element.style.fontFeatureSettings = this.config.features
			.map(x => x.toCSS())
			.join(', ');
	}
};

LT.MatchHeightMethod = {
	bodyHeight: Symbol('body-height'),
	capHeight: Symbol('cap-height'),
	xHeight: Symbol('x-height'),
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
	
	static parse(string, parser) {
		const symbols = [];
		
		for (let i = 0; i < string.length; i++) {
			const slice = string.substring(i, string.length);
			const symbolDistance = parser(slice);
			const symbol = string.substr(i, symbolDistance);
			
			symbols.push(symbol);
			i += symbolDistance - 1;
		}
		
		return new LT.Symbols(symbols);
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
