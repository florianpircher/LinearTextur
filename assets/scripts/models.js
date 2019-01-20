const LinearTextur = (() => {
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');
	const notDefinedFontName = 'Adobe NotDef';
	
	return {
		utility: { canvas, context },
		storage: {
			fontStacks: {
				standard: getComputedStyle(document.documentElement).getPropertyValue('--ff-01'),
				notDefined: `"${notDefinedFontName}", monospace`,
			},
			notDefinedFontName: notDefinedFontName,
			measureText: 'xghAW.*|&?',
		},
	};
})();

((LT) => {
	LT.Settings = class Settings {
		constructor() {
			this.cells = null;  // [Cell]?
			this.fonts = null;  // [Font]?
			this.matchXHeight = false;  // boolean
			this.autosizeFontSettings = false;  // boolean
			this.showFontLabels = false;  // boolean
		}
	};
	
	LT.Interface = class Interface {
		constructor() {
			this.endpoints = new Map();
		}
		
		addEndpoint(field, scope) {
			this.endpoints.set(field, scope(field));
		}
	}
	
	LT.Cell = class Cell {
		constructor(spans) {
			this.spans = spans;  // [Text | AlignmentText]
		}
	};
	
	LT.Text = class Text {
		constructor(value) {
			this.value = value;  // string
		}
	};
	
	LT.AlignmentText = class AlignmentText extends LT.Text {};
	
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
			this.name = name;  // string, e.g. "Frutiger" or "Arno Pro Display"
			this.label = label;  // string?
			this.config = config;  // FontConfiguration
			this.scaleFactor = 1;  // number, scale factor for when drawing the font
		}
		
		static plain(name) {
			return new LT.Font(name, null, LT.FontConfiguration.none);
		}
		
		static get standardFont() {
			return LT.Font.plain(LT.storage.fontStacks.standard);
		}
		
		static get notDefinedFont() {
			return LT.Font.plain(LT.storage.fontStacks.notDefined);
		}
		
		get id() {
			let id = 0;
			
			LT.utility.context.font = `32px ${this.name}, ${LT.storage.fontStacks.standard}`;
			
			for (const char of [...LT.storage.measureText, LT.storage.measureText]) {
				const measure = LT.utility.context.measureText(char);
				
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
	
	LT.Rendering = class Rendering {
		constructor(cell, font, cellNode, cellTextNode, spanNodes) {
			this.cell = cell;  // Cell
			this.font = font;  // Font
			this.cellNode = cellNode;  // [HTMLElement]
			this.cellTextNode = cellTextNode;  // [HTMLElement]
			this.spanNodes = spanNodes;  // [HTMLElement]
		}
	};
	
	LT.RenderingView = class RenderingView {
		constructor(rendering, spanRects) {
			this.rendering = rendering;  // Rendering
			this.spanRects = spanRects;  // [DOMRect]
		}
		
		get alignmentWidth() {
			return this.spanRects[1].width;
		}
		
		get offsetLeft() {
			return this.spanRects[1].left;
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
		constructor(renderingViews) {
			this.renderingViews = renderingViews;  // [RenderingView]
		}
		
		get spans() {
			return this.renderingViews[0].rendering.cell.spans;
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
			let endIndex = null;
			
			for (let i = 0; i <= this.symbols.length; i++) {
				if (this.symbols[i] === beginSymbol) {
					beginIndex = distance;
				}
				if (this.symbols[i] === endSymbol) {
					endIndex = distance;
				}
				
				if (i !== this.symbols.length) {
					distance += this.symbols[i].length;
				}
			}
			
			return { beginIndex, endIndex };
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
	}
})(LinearTextur);
