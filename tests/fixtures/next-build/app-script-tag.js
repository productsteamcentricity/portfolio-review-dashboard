// Test entry whose own code holds the text "<script": the build must refuse it, because the app script keeps the
// strict inline rule (only a vendored file, which cannot be edited, meets the narrower HTML parsing rule).
document.body.dataset.tag = '<script>';
