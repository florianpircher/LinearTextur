LT.Timeline = class Timeline {
	constructor(initValue = undefined) {
		this.time = new WeakMap();
		this.arrow = { time: 0 };
		
		if (initValue !== undefined) {
			this.commit(initValue);
		}
	}
	
	commit(state) {
		this.arrow = { time: this.arrow.time + 1 };
		this.time.set(this.arrow, state);
		return this.arrow;
	}
	
	has(arrow) {
		return this.time.has(arrow);
	}
	
	access(arrow = undefined) {
		if (arrow === undefined) {
			return this.time.get(this.arrow);
		}
		return this.time.get(arrow);
	}
	
	set(key, value) {
		return this.commit(this.access().set(key, value));
	}
	
	get(key) {
		return this.access().get(key);
	}
};

LT.Interface = class Interface {
	constructor() {
		this.endpoints = new IMap();
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
	
	init(draw, memory) {
		memory.set('drawingEnabled', false);
		this.processQueue();
		memory.set('drawingEnabled', true);
		draw(memory.access());
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

//
// Fonts
//

// FontConfiguration: Map
// - weight: string, e.g. "400" or "bold"
// - style: string, e.g. "italic" or "oblique"
// - features: Map{string : boolean}
//   - key: 4 character OpenType feature name
//   - value: whether the feature is enabled or disabled

// Font: Map
// - name: string, e.g. "Futura" or "ArnoPro-Display"
// - label: string
// - config: FontConfiguration
// - scaleFactor: number, scale factor for when drawing the font, > 0

const fallbackFont = IMap({ name: LT.storage.fontStacks.standard });
const notDefinedFont = IMap({ name: LT.storage.fontStacks.notDefined });

const idFont = (font) => {
	LT.drawing.context.font = `32px ${font.get('name')}, ${LT.storage.fontStacks.standard}`;
	return [...'xghAW.*|&?', 'LVAW.Y+T'].reduce((id, x) =>
		id + LT.drawing.context.measureText(x).width, 0);
};

const fontExists = (font) => {
	const testFont = IMap({ name: `${font.get('name')}, ${LT.storage.fontStacks.notDefined}` });
	return idFont(testFont) !== idFont(notDefinedFont);
};

const applyFontToElement = (font, element, fontStack) => {
	element.style.fontFamily = `${font.get('name')}, ${fontStack}`;
	element.style.fontSize = `${font.get('scaleFactor')}em`;
	
	if (font.has('config')) {
		const config = font.get('config');
		
		if (config.has('weight')) {
			element.style.fontWeight = config.get('weight');
		}
		if (config.has('style')) {
			element.style.fontStyle = config.get('style');
		}
		if (config.has('features')) {
			element.style.fontFeatureSettings = config.get('features')
				.map((enabled, tag) => `'${tag}' ${enabled ? 'on' : 'off'}`)
				.join(', ');
		}
	}
}

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

LT.State = Immutable.Record({
	drawEnabled: false,
	cells: IList(),
	fonts: IList(),
	matchHeightMethod: LT.MatchHeightMethod.bodyHeight,
});
