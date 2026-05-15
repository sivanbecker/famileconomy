"""FamilyRunner — desktop GUI for xlsx-rename and xlsx-to-csv scripts."""

import asyncio
from pathlib import Path
from typing import Callable

import flet as ft

import runner

# ─── Action definitions ──────────────────────────────────────────────────────


class Action:
    def __init__(self, key: str, label: str, icon: str, batch: bool, run: Callable):
        self.key = key
        self.label = label
        self.icon = icon
        self.batch = batch
        self.run = run


ACTIONS = [
    Action(
        key="rename_single",
        label="Rename\nSingle File",
        icon=ft.Icons.DRIVE_FILE_RENAME_OUTLINE,
        batch=False,
        run=runner.rename_single,
    ),
    Action(
        key="rename_batch",
        label="Rename All\nin Folder",
        icon=ft.Icons.FOLDER_OPEN,
        batch=True,
        run=runner.rename_batch,
    ),
    Action(
        key="convert_single",
        label="Convert Single\nFile to CSV",
        icon=ft.Icons.TABLE_CHART_OUTLINED,
        batch=False,
        run=runner.convert_single,
    ),
    Action(
        key="convert_batch",
        label="Convert All\nin Folder",
        icon=ft.Icons.TABLE_CHART,
        batch=True,
        run=runner.convert_batch,
    ),
    Action(
        key="summary_batch",
        label="Monthly\nSummary",
        icon=ft.Icons.SUMMARIZE,
        batch=True,
        run=runner.summarise_batch,
    ),
]

# ─── Colours ─────────────────────────────────────────────────────────────────

BG = "#1e1e2e"
SURFACE = "#2a2a3e"
ACCENT = "#4caf50"
ACCENT_INACTIVE = "#3a3a50"
TEXT = "#e0e0e0"
TEXT_DIM = "#888899"
SUCCESS_COLOR = "#4caf50"
ERROR_COLOR = "#ef5350"
INFO_COLOR = "#64b5f6"


# ─── App ─────────────────────────────────────────────────────────────────────


async def main(page: ft.Page):
    page.title = "FamilyRunner"
    page.bgcolor = BG
    page.window.maximized = True
    page.window.resizable = True
    page.padding = 24
    page.theme = ft.Theme(color_scheme_seed=ACCENT)

    # ── State ──────────────────────────────────────────────────────────────

    selected_provider = ["MAX"]
    selected_action: list[Action | None] = [None]
    picked_path: list[str] = [""]
    year_value: list[int | None] = [None]
    per_card_value: list[bool] = [False]

    # ── Output log ─────────────────────────────────────────────────────────

    log_list = ft.ListView(expand=True, spacing=2, auto_scroll=True)

    def add_log(text: str, color: str = TEXT):
        log_list.controls.append(
            ft.Text(text, color=color, size=13, font_family="monospace", selectable=True)
        )
        page.update()

    def clear_log():
        log_list.controls.clear()
        page.update()

    # ── File / folder pickers ──────────────────────────────────────────────

    path_display = ft.Text("No file selected", color=TEXT_DIM, size=13, expand=True)
    file_picker = ft.FilePicker()
    folder_picker = ft.FilePicker()

    async def pick_file(_=None):
        base = runner.get_xlsx_base(selected_provider[0])
        if base and year_value[0] is not None:
            candidate = str(Path(base) / str(year_value[0]))
            initial = candidate if Path(candidate).exists() else base
        else:
            initial = base
        files = await file_picker.pick_files(
            allowed_extensions=["xlsx"],
            allow_multiple=False,
            file_type=ft.FilePickerFileType.CUSTOM,
            initial_directory=initial,
        )
        if files:
            picked_path[0] = files[0].path
            path_display.value = files[0].path
            page.update()

    async def pick_folder(_=None):
        initial = runner.get_xlsx_base(selected_provider[0])
        path = await folder_picker.get_directory_path(initial_directory=initial)
        if path:
            picked_path[0] = path
            path_display.value = path
            page.update()

    pick_button = ft.Button(
        "Browse…",
        icon=ft.Icons.FOLDER_OPEN,
        bgcolor=SURFACE,
        color=TEXT,
        style=ft.ButtonStyle(shape=ft.RoundedRectangleBorder(radius=8)),
    )

    per_card_checkbox = ft.Checkbox(
        label="Per card",
        value=False,
        visible=False,
        fill_color=ACCENT,
        check_color="#000000",
        label_style=ft.TextStyle(color=TEXT),
        on_change=lambda e: per_card_value.__setitem__(0, e.control.value),
    )

    # ── Shared chip style ──────────────────────────────────────────────────
    CHIP_W = 90
    CHIP_H = 40
    CHIP_RADIUS = 20

    def _make_chip(text: str, selected: bool, on_click) -> ft.Container:
        label = ft.Text(
            text,
            color="#000000" if selected else TEXT,
            size=14,
            weight=ft.FontWeight.W_600,
            text_align=ft.TextAlign.CENTER,
        )
        return ft.Container(
            content=label,
            bgcolor=ACCENT if selected else SURFACE,
            border_radius=CHIP_RADIUS,
            width=CHIP_W,
            height=CHIP_H,
            alignment=ft.alignment.Alignment(0, 0),
            on_click=on_click,
            ink=True,
        )

    # ── Year chips ─────────────────────────────────────────────────────────

    _year_chip_refs: dict[int, ft.Container] = {}

    year_label = ft.Text("Year:", color=TEXT_DIM, size=14, visible=False)
    year_chips_row = ft.Row([], spacing=8, visible=False, wrap=True)

    def _select_year(year: int):
        year_value[0] = year
        for y, chip in _year_chip_refs.items():
            is_sel = y == year
            chip.bgcolor = ACCENT if is_sel else SURFACE
            chip.content.color = "#000000" if is_sel else TEXT
        page.update()

    def _build_year_chips(provider: str, default_year: int | None = None):
        years = runner.get_available_years(provider)
        year_chips_row.controls.clear()
        _year_chip_refs.clear()
        year_value[0] = None

        if not years:
            year_chips_row.controls.append(
                ft.Text("No year folders found", color=TEXT_DIM, size=12)
            )
            return

        selected = default_year if default_year in years else years[-1]
        year_value[0] = selected

        for y in reversed(years):  # newest first
            chip = _make_chip(str(y), y == selected, lambda _e, year=y: _select_year(year))
            _year_chip_refs[y] = chip
            year_chips_row.controls.append(chip)

    file_folder_label = ft.Text("File / Folder:", color=TEXT_DIM, size=13, visible=False)

    input_row = ft.Row(
        [pick_button, path_display],
        spacing=12,
        vertical_alignment=ft.CrossAxisAlignment.CENTER,
        visible=False,
    )

    # ── Action tiles ────────────────────────────────────────────────────────

    tile_refs: dict[str, ft.Card] = {}

    def select_action(action: Action):
        selected_action[0] = action
        picked_path[0] = ""
        path_display.value = "No file selected"
        year_value[0] = None
        per_card_value[0] = False
        per_card_checkbox.value = False

        for key, card in tile_refs.items():
            card.bgcolor = ACCENT if key == action.key else SURFACE

        is_summary = action.key.startswith("summary_")

        if action.batch:
            # Batch and summary: year chips only, folder resolved from config
            file_folder_label.visible = False
            input_row.visible = False
        else:
            # Single file: show file picker
            file_folder_label.visible = True
            input_row.visible = True
            pick_button.content = "Choose File…"
            pick_button.on_click = pick_file

        year_label.visible = True
        year_chips_row.visible = True
        _build_year_chips(selected_provider[0])

        per_card_checkbox.visible = is_summary

        page.update()

    def make_tile(action: Action) -> ft.Card:
        card = ft.Card(
            content=ft.Container(
                content=ft.Column(
                    [
                        ft.Icon(action.icon, color=TEXT, size=32),
                        ft.Text(
                            action.label,
                            color=TEXT,
                            size=13,
                            text_align=ft.TextAlign.CENTER,
                            weight=ft.FontWeight.W_500,
                        ),
                    ],
                    horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                    alignment=ft.MainAxisAlignment.CENTER,
                    spacing=10,
                ),
                padding=20,
                width=160,
                height=120,
                on_click=lambda _, a=action: select_action(a),
                ink=True,
            ),
            bgcolor=SURFACE,
            elevation=2,
        )
        tile_refs[action.key] = card
        return card

    tiles_row = ft.Row(
        [make_tile(a) for a in ACTIONS],
        spacing=12,
        wrap=True,
    )

    # ── Provider chips ──────────────────────────────────────────────────────

    provider_chips: dict[str, ft.Container] = {}

    def select_provider(provider: str):
        selected_provider[0] = provider
        for p, chip in provider_chips.items():
            is_sel = p == provider
            chip.bgcolor = ACCENT if is_sel else SURFACE
            chip.content.color = "#000000" if is_sel else TEXT
        if year_chips_row.visible:
            _build_year_chips(provider)
        page.update()

    for p in ["MAX", "CAL"]:
        chip = _make_chip(p, p == "MAX", lambda _e, prov=p: select_provider(prov))
        provider_chips[p] = chip

    provider_row = ft.Row(
        [
            ft.Text("Provider:", color=TEXT_DIM, size=14),
            *provider_chips.values(),
        ],
        spacing=8,
        vertical_alignment=ft.CrossAxisAlignment.CENTER,
    )

    # ── RUN button ──────────────────────────────────────────────────────────

    run_button = ft.Button(
        content=ft.Row(
            [
                ft.Icon(ft.Icons.PLAY_ARROW_ROUNDED, color="#000000"),
                ft.Text("RUN", color="#000000", size=16, weight=ft.FontWeight.BOLD),
            ],
            spacing=6,
            tight=True,
        ),
        bgcolor=ACCENT,
        style=ft.ButtonStyle(shape=ft.RoundedRectangleBorder(radius=12)),
        height=52,
        width=140,
    )

    async def _run(_=None):
        action = selected_action[0]
        if not action:
            add_log("Select an action first.", INFO_COLOR)
            return

        is_summary = action.key.startswith("summary_")

        if action.batch:
            if year_value[0] is None:
                add_log("Select a year first.", INFO_COLOR)
                return
        else:
            if not picked_path[0]:
                add_log("Pick a file first.", INFO_COLOR)
                return

        clear_log()
        provider = selected_provider[0]
        add_log(f"Starting: {action.label.replace(chr(10), ' ')} | {provider}", INFO_COLOR)

        run_button.disabled = True
        page.update()

        def _blocking():
            if is_summary:
                return action.run(None, provider, year_value[0], per_card_value[0])
            if action.batch:
                # Resolve folder from config using selected year
                folder = runner.get_year_folder(provider, year_value[0])
                if not folder:
                    raise ValueError(f"Folder not found for {provider} / {year_value[0]}")
                return action.run(folder, provider, year_value[0])
            return action.run(picked_path[0], provider, year_value[0])

        try:
            result = await asyncio.to_thread(_blocking)
            if action.batch:
                for ok, msg in result:
                    add_log(msg, SUCCESS_COLOR if ok else ERROR_COLOR)
                total = len(result)
                ok_count = sum(1 for ok, _ in result if ok)
                add_log(
                    f"\nDone: {ok_count}/{total} succeeded.",
                    SUCCESS_COLOR if ok_count == total else ERROR_COLOR,
                )
            else:
                ok, msg = result
                add_log(msg, SUCCESS_COLOR if ok else ERROR_COLOR)
        except Exception as exc:
            add_log(f"Unexpected error: {exc}", ERROR_COLOR)
        finally:
            run_button.disabled = False
            page.update()

    run_button.on_click = _run

    async def _on_keyboard(e: ft.KeyboardEvent):
        if e.key == "Enter":
            await _run()

    page.on_keyboard_event = _on_keyboard

    # ── Layout ──────────────────────────────────────────────────────────────

    page.add(
        ft.Column(
            [
                ft.Text("FamilyRunner", size=22, weight=ft.FontWeight.BOLD, color=TEXT),
                ft.Divider(color=ACCENT_INACTIVE, height=1),
                provider_row,
                ft.Row([year_label, year_chips_row], spacing=10, vertical_alignment=ft.CrossAxisAlignment.CENTER),
                ft.Text("Select Action:", color=TEXT_DIM, size=13),
                tiles_row,
                file_folder_label,
                input_row,
                ft.Row([per_card_checkbox], spacing=16),
                ft.Row([run_button], alignment=ft.MainAxisAlignment.END),
                ft.Text("Output & Results:", color=TEXT_DIM, size=13),
                ft.Container(
                    content=log_list,
                    bgcolor=SURFACE,
                    border_radius=10,
                    padding=12,
                    expand=True,
                    border=ft.border.Border(
                        left=ft.border.BorderSide(1, ACCENT_INACTIVE),
                        top=ft.border.BorderSide(1, ACCENT_INACTIVE),
                        right=ft.border.BorderSide(1, ACCENT_INACTIVE),
                        bottom=ft.border.BorderSide(1, ACCENT_INACTIVE),
                    ),
                ),
            ],
            spacing=14,
            expand=True,
        )
    )


ft.run(main)
