((LT) => {
	const STRING_KEY = 'lineartextur.app.data.string';
	const FONTS_KEY = 'lineartextur.app.data.fonts';
	const FONT_SIZE_KEY = 'lineartextur.app.preferences.font-size';
	const COLUMN_SPACING_KEY = 'lineartextur.app.preferences.column-spacing';
	const ROW_SPACING_KEY = 'lineartextur.app.preferences.row-spacing';
	const MATCH_X_HEIGHT_KEY = 'lineartextur.app.preferences.match-x-height';
	const AUTOSIZE_FONT_SETTINGS_KEY = 'lineartextur.app.preferences.autosize-font-settings';
	
	// Utilitys
	
	const isPrefix = (a, b) => b.substring(0, a.length) === a;
	
	const complete = (value, options) => {
		if (value === '') { return null; }
		
		let matches = [];
		
		for (const option of options) {
			if (isPrefix(value, option)) {
				matches.push(option);
			}
		}
		
		if (matches.length >= 1) {
			return matches.shift();
		}
		return null;
	};
	
	const removeAllChildren = (node) => {  // Node -> undefined
		while (node.hasChildNodes()) {
			node.removeChild(node.lastChild);
		}
	};
	
	const indexMax = (xs) => {  // [number] -> number, the index of the max item
		let idx = 0;
		let max = -Infinity;
		
		for (let i = 0; i < xs.length; i++) {
			if (xs[i] > max) {
				max = xs[i];
				idx = i;
			}
		}
		
		return idx;
	};
	
	// Storage
	
	const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
	const load = (key) => JSON.parse(localStorage.getItem(key));
	const initField = (key, set, update) => {
		const initialValue = load(key);
		
		if (initialValue !== null) {
			set(initialValue);
			update();
		} else {
			update();
		}
	};
	const settings = new LT.Settings();
	const interface = new LT.Interface();
	
	// DOM Nodes
	
	const matrixNode = document.getElementById('matrix');
	const metricsNode = document.getElementById('metrics');
	const displayStringField = document.getElementById('display-string-field');
	const fontSettingsField = document.getElementById('font-settings-field');
	const fontSizeField = document.getElementById('font-size-slider');
	const columnSpacingField = document.getElementById('column-spacing-slider');
	const rowSpacingField = document.getElementById('row-spacing-slider');
	const matchXHeightOption = document.getElementById('match-x-height-option');
	const autosizeFontSettingsOption = document.getElementById('autosize-font-settings-option');
	
	// Parsing
	
	const displayStringParser = (slice) => {
		if (slice[0] === '\\' && ['\\', '<', '>', '*'].includes(slice[1])) {
			return 2;
		}
		return 1;
	};
	
	const flattenDisplaySymbols = (symbol) => {
		if (symbol.length === 2 && symbol[0] === '\\' && ['\\', '<', '>', '*'].includes(symbol[1])) {
			return symbol[1];
		}
		return symbol;
	};
	
	const parseDisplayString = string => LT.Symbols.parse(string, displayStringParser)
		.split('*')
		.map(x => x.trim())
		.map((code) => {
			const alignBegin = code.symbols.indexOf('<');
			
			if (alignBegin !== -1) {
				let alignEnd = code.symbols.indexOf('>');
				
				if (alignEnd === -1) {
					alignEnd = code.length;
				}
				
				return new LT.Cell([
					new LT.Text(code.slice(0, alignBegin).flatMap(flattenDisplaySymbols).toString()),
					new LT.AlignmentText(code.slice(alignBegin + 1, alignEnd).flatMap(flattenDisplaySymbols).toString()),
					new LT.Text(code.slice(alignEnd + 1, code.length).flatMap(flattenDisplaySymbols).toString()),
				]);
			}
			return new LT.Cell([new LT.Text(code.flatMap(flattenDisplaySymbols).toString())]);
		});
	
	const parseFontConfiguration = (string, defaultConfig) => {
		const parts = string
			.replace(/(\d)([^\d\s])/g, '$1|$2')
			.replace(/([^\d\s])(\d)/g, '$1|$2')
			.split(/[\s,]*\|[\s,]*|[\s,]+/);
		let weight = defaultConfig.weight;
		let style = defaultConfig.style;
		const features = [...defaultConfig.features];
		
		for (const part of parts) {
			let completeWeight;
			let completeStyle;
			
			if ((completeWeight = complete(part, ['bold'])) !== null) {
				weight = completeWeight;
			}
			if (/^\d+$/.test(part)) {
				weight = part;
			}
			else if ((completeStyle = complete(part, ['italic', 'oblique'])) !== null) {
				style = completeStyle;
			}
			else if (/^[+-]\S{4}$/.test(part)) {
				const tag = part.slice(1, 5);
				const enabled = part[0] === '+';
				features.push(new LT.FontFeature(tag, enabled));
			}
		}
		
		return new LT.FontConfiguration(weight, style, features);
	};
	
	const parseFontsString = (string) => {
		const matches = string.split(/[\n;]/)
			.map(x => x.match(/^([^:]*)(?::(.*))?/))
			.filter(x => x !== null);
		let defaultConfig = LT.FontConfiguration.none;
		
		return matches.map((match) => {
			const fontName = match[1].trim();
			const fontConfig = match[2] !== undefined
				? parseFontConfiguration(match[2].trim(), defaultConfig)
				: defaultConfig;
			
			if (fontName === '') {
				defaultConfig = fontConfig;
				return null;
			}
			return new LT.Font(fontName, null, fontConfig);
		}).filter(x => x !== null);
	};
	
	// Drawing
	
	const render = (cells, font) => cells.map((cell) => {
		const cellNode = document.createElement('td');
		cellNode.classList.add('cell-view');
		
		const cellTextNode = document.createElement('div');
		cellTextNode.classList.add('cell-text-view');
		cellNode.appendChild(cellTextNode);
		
		if (font.exists) {
			font.applyTo(cellTextNode);
		} else {
			LT.Font.standardFont.applyTo(cellTextNode);
			cellTextNode.classList.add('fallback-font');
		}
		
		const spanNodes = cell.spans.map((span) => {
			const spanNode = document.createElement('span');
			spanNode.classList.add('span-view');
			spanNode.classList.add(span instanceof LT.AlignmentText
				? 'alignment-span'
				: 'text-span');
			spanNode.textContent = span.value;
			cellTextNode.appendChild(spanNode);
			
			return spanNode;
		});
		
		return new LT.Rendering(cell, font, cellNode, cellTextNode, spanNodes);
	});
	
	const drawRow = (renderings) => new Promise((resolve) => {
		const rowNode = document.createElement('tr');
		rowNode.classList.add('row-view');
		
		for (const rendering of renderings) {
			rowNode.appendChild(rendering.cellNode);
		}
		
		const observer = new MutationObserver(() => {
			if (matrixNode.contains(rowNode)) {
				resolve(renderings.map((rendering) => {
					const rects = rendering.spanNodes.map(x => x.getBoundingClientRect());
					return new LT.RenderingView(rendering, rects);
				}));
				observer.disconnect();
			}
		});
		observer.observe(matrixNode, {
			attributes: false,
			childList: true,
			characterData: false,
			subtree: true,
		});
		matrixNode.appendChild(rowNode);
	});
	
	const matchXHeight = (fonts) => {
		removeAllChildren(metricsNode);
		
		const exNodes = fonts.map((font) => {
			const exNode = document.createElement('div');
			font.applyTo(exNode, { fallback: LT.storage.fontStacks.standard });
			exNode.style.height = '1ex';
			return exNode;
		});
		const metricsPromise = new Promise((resolve) => {
			const observer = new MutationObserver(() => {
				if (exNodes.every(node => metricsNode.contains(node))) {
					const rects = exNodes.map(x => x.getBoundingClientRect());
					const hs = rects.map(x => x.height);
					const medianXHeight = (() => {
						hs.sort((a, b) => a < b);
						
						if (hs.length % 2 === 0) {
							return (hs[hs.length / 2] + hs[hs.length / 2 - 1]) / 2;
						}
						return hs[(hs.length + 1) / 2 - 1];
					})();
					
					for (let i = 0; i < fonts.length; i++) {
						fonts[i].scaleFactor = medianXHeight / rects[i].height;
					}
					
					resolve(fonts);
					observer.disconnect();
				}
			});
			observer.observe(metricsNode, {
				attributes: false,
				childList: true,
				characterData: false,
				subtree: true,
			});
		});
		
		for (const node of exNodes) {
			metricsNode.appendChild(node);
		}
		
		return metricsPromise;
	};
	
	const draw = async (settings) => {
		if (settings.cells === null || settings.fonts === null) {
			return;
		}
		
		removeAllChildren(matrixNode);
		
		for (const font of settings.fonts) {
			font.scaleFactor = 1; // reset scale factors
		}
		
		if (settings.matchXHeight) {
			settings.fonts = await matchXHeight(settings.fonts);
		}
		
		const renderings = settings.fonts.map(font => render(settings.cells, font));
		const rows = await Promise.all(renderings.map(drawRow));
		const matrix = new LT.Matrix(rows);
		
		for (const column of matrix) {
			if (column.spans.some(x => x instanceof LT.AlignmentText)) {
				const vs = column.renderingViews;
				// the alignment span is at index 1
				const maxIndex = indexMax(vs.map(x => x.offsetLeft))
				const maxView = vs[maxIndex];
				const maxLeft = maxView.offsetLeft;
				
				for (const v of vs) {
					const deltaAlign = maxLeft - v.offsetLeft;
					const deltaCenter = (maxView.alignmentWidth - v.alignmentWidth) / 2;
					const delta = deltaAlign + deltaCenter;
					
					v.rendering.cellTextNode.style.marginLeft = `${delta}px`;
				}
			}
		}
	};
	
	// Display Text Field
	
	interface.addEndpoint(displayStringField, (field) => {
		const update = () => {
			settings.cells = parseDisplayString(field.value);
			draw(settings);
			save(STRING_KEY, field.value);
		};
		
		field.addEventListener('input', update);
		field.addEventListener('focus', () => {
			document.documentElement.classList.add('active-display-field');
		});
		field.addEventListener('blur', () => {
			document.documentElement.classList.remove('active-display-field');
		});
		field.addEventListener('keydown', (event) => {
			const key = event.which || event.keyCode;
			
			switch (key) {
			case 13: // [return]
				event.preventDefault();
				
				const s = field.selectionStart;
				const e = field.selectionEnd;
				let symbols = LT.Symbols.parse(field.value, displayStringParser);
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
	
	interface.addEndpoint(fontSettingsField, (field) => {
		const autosize = () => {
			if (settings.autosizeFontSettings) {
				field.style.height = 'auto';
				field.style.height = field.scrollHeight + 'px';
			} else {
				field.style.removeProperty('height');
			}
		};
		
		const update = () => {
			settings.fonts = parseFontsString(field.value);
			draw(settings);
			autosize();
			save(FONTS_KEY, field.value);
		};
		
		field.style.height = field.scrollHeight + 'px';
		field.addEventListener('input', update);
		initField(FONTS_KEY, x => field.value = x, update);
		
		return { autosize };
	});
	
	// Controls
	
	((fz, cs, rs) => {
		const updateFontSize = () => {
			const value = fz.valueAsNumber;
			matrixNode.style.setProperty('--setting-font-size', value + 'rem');
			save(FONT_SIZE_KEY, value);
			draw(settings);
		};
		const updateColumnSpacing = () => {
			const value = cs.valueAsNumber;
			matrixNode.style.setProperty('--setting-column-spacing', value + 'em');
			save(COLUMN_SPACING_KEY, value);
			draw(settings);
		};
		const updateRowSpacing = () => {
			const value = rs.valueAsNumber;
			matrixNode.style.setProperty('--setting-row-spacing', value + 'em');
			save(ROW_SPACING_KEY, value);
			draw(settings);
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
	})(fontSizeField, columnSpacingField, rowSpacingField);
	
	// Options
	
	interface.addEndpoint(matchXHeightOption, (field) => {
		const update = () => {
			settings.matchXHeight = field.checked;
			draw(settings);
			save(MATCH_X_HEIGHT_KEY, field.checked);
		};
		
		field.addEventListener('change', update);
		initField(MATCH_X_HEIGHT_KEY, x => field.checked = x, update);
	});
	interface.addEndpoint(autosizeFontSettingsOption, (field) => {
		const update = () => {
			settings.autosizeFontSettings = field.checked;
			fontSettingsField.classList.toggle('autosize', field.checked);
			interface.endpoints.get(fontSettingsField).autosize();
			save(AUTOSIZE_FONT_SETTINGS_KEY, field.checked);
		};
		
		field.addEventListener('change', update);
		initField(AUTOSIZE_FONT_SETTINGS_KEY, x => field.checked = x, update);
	});
})(LinearTextur);
