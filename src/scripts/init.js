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
			measureText: 'xghAW.*|&?',
		},
	};
})();
const LT = LinearTextur;
