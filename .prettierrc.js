module.exports = {
  tabWidth: 2,
  semi: true,
  singleQuote: true,
  arrowParens: 'always',
  endOfLine: 'lf',
  plugins: [require.resolve('@trivago/prettier-plugin-sort-imports')],
  importOrder: ['^@core/(.*)$', '^@server/(.*)$', '^@ui/(.*)$', '^[./]'],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
};
