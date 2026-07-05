# papercusp-ui — check contracts

Portable, app-parameterized checks (P-007 convention): copied verbatim into a
composed app, driven by the JSON config named by `TEMPLATE_CHECKS_CONFIG`
(schema: `@papercusp/template-kit` `TemplateChecksConfig`). Unconfigured, a
check SKIPS.

## components-integrated

Section: `components`

```jsonc
{
  "components": {
    // npm package names the composed app must declare (dependencies or
    // devDependencies). List what you KEPT — note papergrid is a
    // meta-package: list the grid SUB-packages you actually import
    // (@papercusp/grid-core / @papercusp/bloom-grid / @papercusp/grid).
    "packages": ["@papercusp/ui-primitives", "@papercusp/grid-core", "@papercusp/dock-workbench", "@papercusp/lexicon"],
    // package.json paths to search, app-root-relative (default: ["package.json"])
    "manifests": ["package.json", "apps/desktop/package.json"]
  }
}
```

Green means: every listed package is a declared dependency of at least one of
the app's manifests — the composition is wired for real, not on paper.
