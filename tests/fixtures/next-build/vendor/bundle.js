/* A stand-in for a vendored bundle (synthetic test fixture): one file that defines two globals, as the PptxGenJS
   bundle defines PptxGenJS and JSZip. Like PptxGenJS it holds the text "<script", a network-API name it never calls
   and a scheme URL; the fixture manifest pins all three in its allow block. */
window.BundleLib = { name: function () { return 'bundle'; }, tag: '<script' };
window.AliasLib = { name: function () { return 'alias of the bundle'; }, probe: typeof XMLHttpRequest, home: 'https://example.org/bundle' };
