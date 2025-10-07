# Installing microapi

The `microapi` package is a local Python package used by the Bond Math services.

## For Development (Editable Install)

Install microapi in development mode so changes are immediately reflected:

```bash
cd libs/microapi
pip install -e .
```

This creates a symlink to the source code, so any edits you make are immediately
available without reinstalling.

## For Services

The Bond Math Python services (`bond-valuation`, `metrics`, `pricing`)
automatically install microapi as a dependency when you install them:

```bash
# Install a service (automatically installs microapi)
cd services/bond-valuation
pip install -e .
```

## For Production

When deploying to Cloudflare Workers, the build process will bundle microapi
with your service code. No separate installation is needed.

## Verifying Installation

Check that microapi is installed correctly:

```bash
python -c "import microapi; print(microapi.__version__)"
# Output: 0.1.0
```

## Dependencies

microapi has only one runtime dependency:

- `python-json-logger>=2.0.0` (~2KB)

Development dependencies (optional):

- `pytest>=7.4.0`
- `pytest-asyncio>=0.21.0`
- `pytest-cov>=4.1.0`
- `black>=23.0.0`
- `ruff>=0.1.0`
- `mypy>=1.7.0`

Install dev dependencies:

```bash
cd libs/microapi
pip install -e ".[dev]"
```

## Uninstalling

```bash
pip uninstall microapi
```

## Publishing to PyPI (Future)

Currently, microapi is a local package. To publish to PyPI in the future:

1. Update version in `pyproject.toml`
2. Build the package: `python -m build`
3. Upload to PyPI: `python -m twine upload dist/*`

**Note:** Before publishing to PyPI, consider renaming to a more specific
package name like `cloudflare-microapi` or `bond-math-microapi` to avoid naming
conflicts.
