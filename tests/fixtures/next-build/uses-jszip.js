// Test entry (M1.4) that imports only JSZip, an alias of the PptxGenJS bundle in app/vendor/MANIFEST.json: the build
// must inline the PptxGenJS file, which defines JSZip, and no other library.
import JSZip from 'vendor:jszip';

document.body.dataset.jszip = typeof JSZip;
