"""FamilyRunner — desktop GUI for xlsx-rename and xlsx-to-csv scripts."""

import asyncio
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
    page.window.width = 860
    page.window.height = 680
    page.window.resizable = True
    page.padding = 24
    page.theme = ft.Theme(color_scheme_seed=ACCENT)

    # ── State ──────────────────────────────────────────────────────────────

    selected_provider = ["MAX"]
    selected_action: list[Action | None] = [None]
    picked_path: list[str] = [""]
    year_value: list[int | None] = [None]

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
        initial = runner.get_xlsx_base(selected_provider[0])
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

    year_field = ft.TextField(
        label="Year",
        hint_text="e.g. 2026",
        width=120,
        bgcolor=SURFACE,
        color=TEXT,
        label_style=ft.TextStyle(color=TEXT_DIM),
        border_color=ACCENT_INACTIVE,
        focused_border_color=ACCENT,
        visible=False,
        on_change=lambda e: _parse_year(e.control.value),
    )

    def _parse_year(val: str):
        try:
            year_value[0] = int(val) if val.strip() else None
        except ValueError:
            year_value[0] = None

    input_row = ft.Row(
        [pick_button, path_display, year_field],
        spacing=12,
        vertical_alignment=ft.CrossAxisAlignment.CENTER,
    )

    # ── Action tiles ────────────────────────────────────────────────────────

    tile_refs: dict[str, ft.Card] = {}

    def select_action(action: Action):
        selected_action[0] = action
        picked_path[0] = ""
        path_display.value = "No file selected"
        year_field.value = ""
        year_value[0] = None

        for key, card in tile_refs.items():
            card.bgcolor = ACCENT if key == action.key else SURFACE

        if action.batch:
            pick_button.content = "Choose Folder…"
            pick_button.on_click = pick_folder
            year_field.visible = True
        else:
            pick_button.content = "Choose File…"
            pick_button.on_click = pick_file
            year_field.visible = False

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
        wrap=False,
    )

    # ── Provider chips ──────────────────────────────────────────────────────

    provider_chips: dict[str, ft.Chip] = {}

    def select_provider(provider: str):
        selected_provider[0] = provider
        for p, chip in provider_chips.items():
            chip.bgcolor = ACCENT if p == provider else SURFACE
            chip.label = ft.Text(p, color="#000000" if p == provider else TEXT)
        page.update()

    for p in ["MAX", "CAL"]:
        is_default = p == "MAX"
        chip = ft.Chip(
            label=ft.Text(p, color="#000000" if is_default else TEXT),
            bgcolor=ACCENT if is_default else SURFACE,
            on_click=lambda _, prov=p: select_provider(prov),
            padding=ft.padding.Padding(left=16, top=6, right=16, bottom=6),
        )
        provider_chips[p] = chip

    provider_row = ft.Row(
        [
            ft.Text("Provider:", color=TEXT_DIM, size=14),
            *provider_chips.values(),
        ],
        spacing=12,
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
        if not picked_path[0]:
            add_log("Pick a file or folder first.", INFO_COLOR)
            return
        if action.batch and year_value[0] is None:
            add_log("Enter a valid year for batch mode.", INFO_COLOR)
            return

        clear_log()
        provider = selected_provider[0]
        add_log(f"Starting: {action.label.replace(chr(10), ' ')} | {provider}", INFO_COLOR)

        run_button.disabled = True
        page.update()

        def _blocking():
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

    # ── Layout ──────────────────────────────────────────────────────────────

    page.add(
        ft.Column(
            [
                ft.Text("FamilyRunner", size=22, weight=ft.FontWeight.BOLD, color=TEXT),
                ft.Divider(color=ACCENT_INACTIVE, height=1),
                provider_row,
                ft.Text("Select Action:", color=TEXT_DIM, size=13),
                tiles_row,
                ft.Text("File / Folder:", color=TEXT_DIM, size=13),
                input_row,
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
