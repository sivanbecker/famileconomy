# FamilyRunner

Native desktop GUI for running the `xlsx-rename` and `xlsx-to-csv` scripts without a terminal.

## Requirements

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) package manager

## Install & run

```bash
cd apps/desktop
uv sync
uv run flet run main.py
```

## Actions

| Tile                       | What it does                                                                 |
| -------------------------- | ---------------------------------------------------------------------------- |
| Rename Single File         | Rename one XLSX with standardized name (provider-month-year-timestamp-cards) |
| Rename All in Folder       | Batch rename all XLSX files in a folder (requires year)                      |
| Convert Single File to CSV | Rename + convert one XLSX to CSV(s)                                          |
| Convert All in Folder      | Batch rename + convert all XLSX files in a folder (requires year)            |

## Config

Reads `config/providers.json` from the repo root automatically. No separate config needed.

## Build standalone .app (macOS)

```bash
cd apps/desktop
uv run flet build macos
```

Output: `build/macos/FamilyRunner.app`
