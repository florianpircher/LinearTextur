// Returns whether a is a prefix of b
const isPrefix = (a, b) => b.substring(0, a.length) === a;

// Returns the the first matching completion for a prefix, else returns null. A
// prefix of an empty-string returns null.
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
  xs = Array.from(xs).sort((a, b) => a - b);
  
  if (xs.length % 2 === 0) {
    return (xs[xs.length / 2] + xs[xs.length / 2 - 1]) / 2;
  }
  return xs[(xs.length + 1) / 2 - 1];
};
