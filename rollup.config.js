import plaid from '@gera2ld/plaid';
import pkg from './package.json' assert { type: 'json' };

const { defaultOptions, getRollupExternal, getRollupPlugins } = plaid;

const DIST = defaultOptions.distDir;
const FILENAME = 'index';
const BANNER = `/*! ${pkg.name} v${pkg.version} | ${pkg.license} License */`;

const external = getRollupExternal();
const bundleOptions = {
  extend: true,
  esModule: false,
};
const rollupConfig = [
  {
    input: 'src/index.ts',
    plugins: getRollupPlugins({
      minimize: false,
      esm: true,
      extensions: defaultOptions.extensions,
    }),
    external,
    output: {
      format: 'esm',
      file: `${DIST}/${FILENAME}.mjs`,
    },
  },
  {
    input: 'src/index.ts',
    plugins: getRollupPlugins({
      minimize: false,
      esm: true,
      extensions: defaultOptions.extensions,
    }),
    output: {
      format: 'iife',
      file: `${DIST}/${FILENAME}.js`,
      name: 'tarjs',
      ...bundleOptions,
    },
  },
];

rollupConfig.forEach((item) => {
  item.output = {
    indent: false,
    // If set to false, circular dependencies and live bindings for external imports won't work
    externalLiveBindings: false,
    ...item.output,
    ...(BANNER && {
      banner: BANNER,
    }),
  };
});

export default rollupConfig;
