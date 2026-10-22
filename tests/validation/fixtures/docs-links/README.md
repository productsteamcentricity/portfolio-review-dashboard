# Fixture root

Fixture for `tests/validation/docs-links.test.mjs`. Some links below are broken on purpose.

Good: [guide](docs/guide.md), [section](docs/guide.md#second-section), [folder](docs/sub/),
[self](#fixture-root), [external](https://example.com/page), [mail](mailto:someone).

Broken: [missing](docs/missing.md), [bad anchor](docs/guide.md#no-such-heading), [case](docs/Guide.md).

```text
[inside a code block](docs/not-checked.md)
```

Inline code such as `[inside inline code](docs/also-not-checked.md)` is not a link.

[ref-good]: docs/sub/deep.md#deep-heading
[ref-bad]: docs/sub/nothere.md
