// Storage Keys
const STRING_KEY = 'lineartextur.app.data.string';
const FONTS_KEY = 'lineartextur.app.data.fonts';
const FONT_SIZE_KEY = 'lineartextur.app.preferences.font-size';
const COLUMN_SPACING_KEY = 'lineartextur.app.preferences.column-spacing';
const ROW_SPACING_KEY = 'lineartextur.app.preferences.row-spacing';
const MATCH_HEIGHT_METHOD_KEY = 'lineartextur.app.preferences.match-height';

// Storage
const storage = window.localStorage;
const save = (key, value) => storage.setItem(key, JSON.stringify(value));
const load = (key) => {
	const value = storage.getItem(key);
	return value === null ? null : JSON.parse(value);
};

// Utilitys
const removeAllChildren = (node) => {  // (Node) -> ()
	while (node.hasChildNodes()) {
		node.removeChild(node.lastChild);
	}
};

// State
const initField = (key, set, update, defaultValue = null) => {
	const initialValue = load(key);
	
	if (initialValue !== null) {
		set(initialValue);
	} else if (defaultValue !== null) {
		set(defaultValue);
	}
	update();
};
const main = new LT.Interface();
const state = LT.State = {
	drawEnabled: false,
	cells: {},
	fonts: {},
	matchHeightMethod: LT.MatchHeightMethod.bodyHeight,
};

// DOM Nodes
const elements = {
	matrix: document.getElementById('matrix'),
	metrics: document.getElementById('metrics'),
	input: document.getElementById('input-field'),
	fontSettings: document.getElementById('font-settings-field'),
	fontSize: document.getElementById('font-size-slider'),
	columnSpacing: document.getElementById('column-spacing-slider'),
	rowSpacing: document.getElementById('row-spacing-slider'),
	matchBodyHeight: document.getElementById('match-body-height-option'),
	matchCapHeight: document.getElementById('match-cap-height-option'),
	matchXHeight: document.getElementById('match-x-height-option'),
};
// Flags for observing a deep node structure using MutationObserver
const observeNodeTree = {
	attributes: false,
	childList: true,
	characterData: false,
	subtree: true,
};

//
// Drawing
//

const renderTestNode = (height) => (font) => {
	const testNode = document.createElement('div');
	applyFontToElement(font, testNode, LT.storage.fontStacks.standard, false);
	testNode.style.height = height;
	
	return testNode;
};

const manuelMatchFontsXHeight = (fonts) => {
	const testNodesParent = elements.metrics;
	const testNodes = fonts.map(renderTestNode('1ex'));
	
	const observer = new Promise((resolve) => {
		// Await Rendering did Complete
		const observer = new MutationObserver(() => {
			if (testNodes.some(node => !testNodesParent.contains(node))) return;
			
			// All test nodes are in the DOM and can be measured
			const rects = testNodes.map(x => x.getBoundingClientRect());
			const medianXHeight = median(rects.map(x => x.height));
			const scalars = rects.map(rect => medianXHeight / rect.height);
			
			observer.disconnect();
			resolve(scalars);
		});
		observer.observe(testNodesParent, observeNodeTree);
	})
	
	// Render
	removeAllChildren(testNodesParent);
	
	for (const node of testNodes) {
		testNodesParent.appendChild(node);
	}
	
	return observer;
};

const scanGlyphsHeight = (glyphs, defaultHeight) => (font) => {
	const width = LT.drawing.canvas.width;
	const height = LT.drawing.canvas.height;
	const area = width * height;
	const ctx = LT.drawing.context;
	
	// Clear Context
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, width, height);
	ctx.fillStyle = '#000';
	ctx.font = `${height}px ${font.name}, ${LT.storage.fontStacks.standard}`;
	
	// Draw glyphs on top of each other
	for (const glyph of glyphs) {
		ctx.fillText(glyph, 0, height);
	}
	
	// Find first non-white pixel and use its position to compute the height
	const subpixels = ctx.getImageData(0, 0, width, height).data;
	const positionFirstNonWhitePixel = (() => {
		for (let c = 0, limit = subpixels.length; c < limit; c += 4) {
			if (subpixels[c] !== 255) return c / 4;
		}
		return defaultHeight * area;
	})();
	
	// Return precentage
	return 1 - (positionFirstNonWhitePixel / area);
};

const manualMatchFontsGlyphsHeight = (fonts, glyphs, defaultHeight) => {
	const heights = fonts.map(scanGlyphsHeight(glyphs, defaultHeight));
	const medianHeight = median(heights);
	return heights.map(x => medianHeight / x);
};

const manuelMatchFontsCapHeight = fonts =>
	manualMatchFontsGlyphsHeight(fonts, ['H', 'X', 'V'], 0.7);

const scalarsForMatchingFonts = (fonts, matchMethod) => {
	switch (matchMethod) {
	case LT.MatchHeightMethod.bodyHeight:
		return new Array(fonts.length).fill(1);
	case LT.MatchHeightMethod.capHeight:
		// TODO: test for support for advanced text metrics
		return manuelMatchFontsCapHeight(fonts);
	case LT.MatchHeightMethod.xHeight:
		// TODO: test for support for advanced text metrics
		return manuelMatchFontsXHeight(fonts);
	default:
		console.error('Illegal match method.', matchMethod);
		throw new Error('Illegal match method.');
	}
};

const matchFonts = async (fonts, matchMethod) => {
	const scalars = await scalarsForMatchingFonts(fonts, matchMethod);
	return fonts.map((font, idx) => {
		font.scaleFactor = scalars[idx];
		return font;
	});
};

const renderSpan = (span) => {
	const element = document.createElement('span');
	element.classList.add('span-view');
	element.classList.add(span.isAlignmentMarker
		? 'alignment-span'
		: 'text-span');
	element.textContent = span.value;
	return element;
};

const render = (cells, font) => new LT.Row(font, cells.map((cell) => {
	const element = document.createElement('td');
	element.classList.add('cell-view');
	
	const textWrapper = document.createElement('div');
	textWrapper.classList.add('cell-text-view');
	element.appendChild(textWrapper);
	
	if (fontExists(font)) {
		// set cell using the requested font
		applyFontToElement(font, textWrapper, LT.storage.fontStacks.notDefined);
	} else {
		// set the sell using the fallback font
		applyFontToElement(fallbackFont, textWrapper, LT.storage.fontStacks.standard);
		textWrapper.classList.add('fallback-font');
	}
	
	const spans = cell.spans.map(renderSpan);
	for (const span of spans) textWrapper.appendChild(span);
	
	return new LT.Rendering(cell, font, element, textWrapper, spans);
}));

const measureRendering = (rendering) => {
	const rects = rendering.spanNodes.map(x => x.getBoundingClientRect());
	rendering.spanRects = rects;
	return rendering;
};

const drawRow = (row) => new Promise((resolve) => {
	const rowNode = document.createElement('tr');
	rowNode.classList.add('row-view');
	
	for (const rendering of row.renderings) {
		rowNode.appendChild(rendering.element);
	}
	
	const observer = new MutationObserver(() => {
		if (elements.matrix.contains(rowNode)) {
			observer.disconnect();
			resolve(row.renderings.map(measureRendering));
		}
	});
	observer.observe(elements.matrix, observeNodeTree);
	elements.matrix.appendChild(rowNode);
});

const alignColumn = (column) => {
	const views = column.renderings;
	const maxIndex = indexMax(views.map(x => x.offsetLeft));
	const maxView = views[maxIndex];
	const maxLeft = maxView.offsetLeft;
	
	for (const view of views) {
		const deltaAlign = maxLeft - view.offsetLeft;
		const deltaCenter = (maxView.alignmentWidth - view.alignmentWidth) / 2;
		const delta = deltaAlign + deltaCenter;
		
		view.textWrapper.style.marginLeft = `${delta}px`;
	}
};

const draw = async (state) => {
	if (!state.drawingEnabled) return;
	
	const unmatchedFonts = state.fonts;
	const matchMethod = state.matchHeightMethod;
	const fonts = await matchFonts(unmatchedFonts, matchMethod);
	
	removeAllChildren(elements.matrix);
	
	const cells = state.cells;
	const renderings = fonts.map(font => render(cells, font));
	const rows = await Promise.all(renderings.map(drawRow));
	const matrix = new LT.Matrix(rows);
	
	for (const column of matrix) {
		if (column.spans.some(x => x.isAlignmentMarker)) {
			alignColumn(column);
		}
	}
};

// Display Text Field

main.addEndpoint(elements.input, (field) => {
	const update = () => {
		const dsSymbols = parseInput(field.value);
		state.cells = constructTextCells(dsSymbols);
		draw(state);
		save(STRING_KEY, field.value);
	};
	
	field.addEventListener('input', update);
	field.addEventListener('keydown', (event) => {
		const key = event.which || event.keyCode;
		
		switch (key) {
		case 13: // [return]
			event.preventDefault();
			
			const s = field.selectionStart;
			const e = field.selectionEnd;
			let symbols = parseInput(field.value);
			const symbolsColumns = symbols.split('*');
			const columnRanges = symbolsColumns.reduce(({ distance, ranges }, xs) => ({
				distance: distance + 1 + xs.absLength,
				ranges: [...ranges, { begin: distance + 1, end: distance + 1 + xs.absLength }],
			}), { distance: -1, ranges: [] }).ranges;
			const columnIndex = columnRanges.findIndex(x => s >= x.begin && e <= x.end);
			
			if (columnIndex !== -1) {
				const range = columnRanges[columnIndex];
				let colSymbols = symbolsColumns[columnIndex];
				colSymbols.insertAtAbs(e - range.begin, 'END');
				colSymbols.insertAtAbs(s - range.begin, 'BEGIN');
				colSymbols = colSymbols.flatMap((symbol) => {
					if (symbol === '<' || symbol === '>') { return null; }
					if (symbol === 'BEGIN') { return '<'; }
					if (symbol === 'END') { return '>'; }
					return symbol;
				});
				const { beginIndex, endIndex } = colSymbols.absRangeFromTo('<', '>');
				
				symbolsColumns.splice(columnIndex, 1, colSymbols);
				field.value = symbolsColumns.map(x => x.toString()).join('*');
				update();
				field.setSelectionRange(beginIndex + range.begin, endIndex + 1 + range.begin);
			}
		}
	});
	
	const initialValue = load(STRING_KEY);
	initField(STRING_KEY, x => field.value = x, update);
});

// Font Settings Field

main.addEndpoint(elements.fontSettings, (field) => {
	const update = () => {
		state.fonts = parseFontsString(field.value);
		draw(state);
		save(FONTS_KEY, field.value);
	};
	
	field.style.height = field.scrollHeight + 'px';
	field.addEventListener('input', update);
	initField(FONTS_KEY, x => field.value = x, update);
});

// Controls

main.addEndpoint([elements.fontSize, elements.columnSpacing, elements.rowSpacing], ([fz, cs, rs]) => {
	const updateFontSize = () => {
		const value = fz.valueAsNumber;
		elements.matrix.style.setProperty('--setting-font-size', value + 'em');
		save(FONT_SIZE_KEY, value);
		draw(state);
	};
	const updateColumnSpacing = () => {
		const value = cs.valueAsNumber;
		elements.matrix.style.setProperty('--setting-column-spacing', value + 'em');
		save(COLUMN_SPACING_KEY, value);
	};
	const updateRowSpacing = () => {
		const value = rs.valueAsNumber;
		elements.matrix.style.setProperty('--setting-row-spacing', value + 'em');
		save(ROW_SPACING_KEY, value);
	};
	
	const setFontSize = (value) => {
		fz.value = value;
		updateFontSize();
	};
	const setColumnSpacing = (value) => {
		cs.value = value;
		updateColumnSpacing();
	};
	const setRowSpacing = (value) => {
		rs.value = value;
		updateRowSpacing();
	};
	
	const controlHandlerMap = new WeakMap([
		[fz, { set: setFontSize, update: updateFontSize }],
		[cs, { set: setColumnSpacing, update: updateColumnSpacing }],
		[rs, { set: setRowSpacing, update: updateRowSpacing }],
	]);
	
	const updateControl = (event) => {
		const control = event.currentTarget;
		controlHandlerMap.get(control).update();
	};
	
	fz.addEventListener('input', updateControl);
	cs.addEventListener('input', updateControl);
	rs.addEventListener('input', updateControl);
	
	const resetControl = (event) => {
		const control = event.currentTarget;
		controlHandlerMap.get(control).set(control.dataset.default);
	};
	
	fz.addEventListener('dblclick', resetControl);
	cs.addEventListener('dblclick', resetControl);
	rs.addEventListener('dblclick', resetControl);
	
	initField(FONT_SIZE_KEY, x => fz.value = x, controlHandlerMap.get(fz).update);
	initField(COLUMN_SPACING_KEY, x => cs.value = x, controlHandlerMap.get(cs).update);
	initField(ROW_SPACING_KEY, x => rs.value = x, controlHandlerMap.get(rs).update);
});

// Options

main.addEndpoint([elements.matchBodyHeight, elements.matchCapHeight, elements.matchXHeight], ([bodyHeight, capHeight, xHeight]) => {
	const update = () => {
		let method = null;
		
		if (capHeight.checked) {
			method = LT.MatchHeightMethod.capHeight;
		} else if (xHeight.checked) {
			method = LT.MatchHeightMethod.xHeight;
		} else {
			method = LT.MatchHeightMethod.bodyHeight;
		}
		
		state.matchHeightMethod = method;
		draw(state);
		save(MATCH_HEIGHT_METHOD_KEY, method.description);
	};
	
	bodyHeight.addEventListener('change', update);
	capHeight.addEventListener('change', update);
	xHeight.addEventListener('change', update);
	initField(MATCH_HEIGHT_METHOD_KEY, (initValue) => {
		if (initValue === LT.MatchHeightMethod.capHeight.description) {
			capHeight.checked = true;
		} else if (initValue === LT.MatchHeightMethod.xHeight.description) {
			xHeight.checked = true;
		} else {
			bodyHeight.checked = true;
		}
	}, update, LT.MatchHeightMethod.bodyHeight);
});

// Init

window.addEventListener('load', () => {
	document.documentElement.classList.remove('no-transitions');
});
main.init(draw, state);
