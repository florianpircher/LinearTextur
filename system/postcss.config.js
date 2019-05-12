'use strict';

module.exports = {
  plugins: [
    require('css-declaration-sorter'),
    require('autoprefixer'),
    require('cssnano')({
      preset: 'advanced',
    }),
  ],
};
