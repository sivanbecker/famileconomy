"""
Load and run xlsx-rename and xlsx-to-csv script logic without subprocess.
Scripts use hyphens in filenames, so we load them via importlib.
"""

import importlib.util
import sys
from pathlib import Path

_SCRIPTS_DIR = Path(__file__).parent.parent.parent / "scripts"
_CONFIG_PATH = Path(__file__).parent.parent.parent / "config" / "providers.json"


def _load_script(name: str):
    """Load a script module by filename (hyphens allowed)."""
    path = _SCRIPTS_DIR / name
    spec = importlib.util.spec_from_file_location(name.replace("-", "_").replace(".py", ""), path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _get_config(provider: str) -> tuple[dict, list[str]]:
    rename_mod = _load_script("xlsx-rename.py")
    config = rename_mod.load_config(_CONFIG_PATH)
    provider_config = config.get(provider, {})
    valid_cards = provider_config.get("valid_cards", [])
    return config, valid_cards


def get_xlsx_base(provider: str) -> str | None:
    """Return the xlsx_base path for the given provider, or None if not configured."""
    config, _ = _get_config(provider)
    path = config.get(provider, {}).get("xlsx_base")
    if path and Path(path).exists():
        return path
    return None


def rename_single(
    file_path: str,
    provider: str,
    year: int | None = None,
) -> tuple[bool, str]:
    """Rename a single XLSX file."""
    mod = _load_script("xlsx-rename.py")
    _, valid_cards = _get_config(provider)
    return mod.process_single_file(Path(file_path), provider, valid_cards, year)


def rename_batch(
    folder_path: str,
    provider: str,
    year: int,
) -> list[tuple[bool, str]]:
    """Rename all XLSX files in a folder."""
    mod = _load_script("xlsx-rename.py")
    _, valid_cards = _get_config(provider)
    folder = Path(folder_path)
    xlsx_files = sorted(folder.glob("*.xlsx"))
    if not xlsx_files:
        return [(False, f"No XLSX files found in {folder}")]
    results = []
    for f in xlsx_files:
        results.append(mod.process_single_file(f, provider, valid_cards, year))
    return results


def convert_single(
    file_path: str,
    provider: str,
    year: int | None = None,
) -> tuple[bool, str]:
    """Convert a single XLSX file to CSV."""
    mod = _load_script("xlsx-to-csv.py")
    config, valid_cards = _get_config(provider)
    provider_config = config.get(provider, {})
    output_base = Path(provider_config.get("csv_base", ""))
    return mod.process_single_file(Path(file_path), output_base, provider, valid_cards, year)


def convert_batch(
    folder_path: str,
    provider: str,
    year: int,
) -> list[tuple[bool, str]]:
    """Convert all XLSX files in a folder to CSV."""
    mod = _load_script("xlsx-to-csv.py")
    config, valid_cards = _get_config(provider)
    provider_config = config.get(provider, {})
    output_base = Path(provider_config.get("csv_base", ""))
    folder = Path(folder_path)
    xlsx_files = sorted(folder.glob("*.xlsx"))
    if not xlsx_files:
        return [(False, f"No XLSX files found in {folder}")]
    results = []
    for f in xlsx_files:
        results.append(mod.process_single_file(f, output_base, provider, valid_cards, year))
    return results
