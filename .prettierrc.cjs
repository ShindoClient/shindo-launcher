module.exports = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'lf',

  plugins: ['prettier-plugin-svelte', 'prettier-plugin-tailwindcss'],

  // Svelte
  svelteSortOrder: 'scripts-styles-options-markup',
  svelteStrictMode: false,
  svelteAllowShorthand: true,
  svelteBracketNewLine: true,

  // Tailwind só no renderer
  tailwindConfig: './packages/renderer/tailwind.config.js',

  // Arquivos que o Prettier deve formatar
  overrides: [
    {
      files: 'packages/renderer/**/*.{svelte,css,ts,js}',
      options: {},
    },
  ],
};
