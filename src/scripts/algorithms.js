// Returns whether a is a prefix of b
const isPrefix = (a, b) => b.substring(0, a.length) === a;

// Completes a prefix to the first matching option, null else. A prefix of
// empty-string yilds null.
const complete = (prefix, options) => {
	if (prefix === '') { return null; }
	
	for (const option of options) {
		if (isPrefix(prefix, option)) {
			return option;
		}
	}
	return null;
};

// Returns the index of the entry with the highest value.
const indexMax = (xs) =>
	xs.reduce(([y, j], x, i) => x > y ? [x, i] : [y, j], [-Infinity, 0])[1];

const median = (xs) => {
	xs = [...xs].sort((a, b) => a - b);

	if (xs.length % 2 === 0) {
		return (xs[xs.length / 2] + xs[xs.length / 2 - 1]) / 2;
	}
	return xs[(xs.length + 1) / 2 - 1];
};
