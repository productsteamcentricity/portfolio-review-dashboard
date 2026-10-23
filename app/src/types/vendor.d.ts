// A module imports a vendored library (app/vendor/MANIFEST.json) as `import Lib from 'vendor:<name>'`.
// scripts/build.mjs resolves it to the library's global and inlines the library only when it is imported.
// The library's own types are declared where it is first used.
declare module 'vendor:*' {
  const lib: unknown;
  export default lib;
}
