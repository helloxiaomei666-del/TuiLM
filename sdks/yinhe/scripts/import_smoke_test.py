"""Offline import smoke test for local Yinhe SDK wheels.

This script intentionally checks only package metadata, importability, and
symbol presence. It must not perform login, market-data queries, subscriptions,
trading requests, or network calls.
"""

from __future__ import annotations

import importlib
import importlib.metadata
import os
import platform
import sys
import traceback
from types import ModuleType
from typing import Iterable


PACKAGES = ("tgw", "AmazingData")
TGW_SYMBOLS = (
    "GetVersion",
    "Login",
    "Close",
    "QueryKline",
    "QuerySnapshot",
    "Subscribe",
)


def emit(level: str, message: str) -> None:
    print(f"[{level}] {message}")


def emit_exception(prefix: str, exc: BaseException) -> None:
    emit("FAIL", f"{prefix}: {exc.__class__.__name__}: {exc}")
    formatted = "".join(traceback.format_exception_only(type(exc), exc)).strip()
    if formatted:
        emit("FAIL", f"{prefix} detail: {formatted}")


def print_environment() -> None:
    emit("INFO", f"Python executable: {sys.executable}")
    emit("INFO", f"Python version: {sys.version.replace(os.linesep, ' ')}")
    emit("INFO", f"Platform: {platform.platform()}")
    emit("INFO", f"Machine: {platform.machine()}")
    emit("INFO", f"Current working directory: {os.getcwd()}")


def read_metadata(distribution_name: str) -> bool:
    try:
        dist = importlib.metadata.distribution(distribution_name)
    except importlib.metadata.PackageNotFoundError:
        emit("WARN", f"Distribution metadata not found: {distribution_name}")
        return False
    except Exception as exc:  # pragma: no cover - defensive reporting path
        emit_exception(f"Failed reading metadata for {distribution_name}", exc)
        return False

    metadata = dist.metadata
    emit("PASS", f"Distribution metadata found: {distribution_name}")
    for key in ("Name", "Version", "Summary", "Requires-Python"):
        value = metadata.get(key)
        if value:
            emit("INFO", f"{distribution_name} {key}: {value}")

    requires = metadata.get_all("Requires-Dist") or []
    if requires:
        for requirement in requires:
            emit("INFO", f"{distribution_name} Requires-Dist: {requirement}")
    else:
        emit("INFO", f"{distribution_name} Requires-Dist: none declared")

    return True


def safe_import(module_name: str) -> tuple[bool, ModuleType | None, BaseException | None]:
    try:
        module = importlib.import_module(module_name)
    except Exception as exc:
        return False, None, exc
    return True, module, None


def check_tgw(module: ModuleType) -> None:
    emit("PASS", "import tgw succeeded")
    for symbol in TGW_SYMBOLS:
        if hasattr(module, symbol):
            emit("PASS", f"tgw symbol exists: {symbol}")
        else:
            emit("WARN", f"tgw symbol missing: {symbol}")
    emit("INFO", "No tgw callable was invoked; symbol checks used hasattr only.")


def public_names(module: ModuleType, limit: int = 30) -> list[str]:
    names = sorted(name for name in dir(module) if not name.startswith("_"))
    return names[:limit]


def check_amazing_data(module: ModuleType) -> None:
    emit("PASS", "import AmazingData succeeded")
    names = sorted(name for name in dir(module) if not name.startswith("_"))
    emit("INFO", f"AmazingData public/top-level attribute count: {len(names)}")
    sample = public_names(module)
    if sample:
        emit("INFO", "AmazingData public/top-level attribute sample: " + ", ".join(sample))
    else:
        emit("WARN", "AmazingData exposes no public/top-level attributes via dir().")
    emit("INFO", "No AmazingData login, query, download, or subscribe function was invoked.")


def check_metadata() -> None:
    for package in PACKAGES:
        read_metadata(package)


def check_imports() -> int:
    tgw_ok, tgw_module, tgw_exc = safe_import("tgw")
    amazing_ok, amazing_module, amazing_exc = safe_import("AmazingData")

    if tgw_ok and tgw_module is not None:
        check_tgw(tgw_module)
    elif tgw_exc is not None:
        emit_exception("import tgw failed", tgw_exc)

    if amazing_ok and amazing_module is not None:
        check_amazing_data(amazing_module)
    elif amazing_exc is not None:
        emit("WARN", f"import AmazingData failed: {amazing_exc.__class__.__name__}: {amazing_exc}")
        emit(
            "WARN",
            "AmazingData import failure may be caused by missing optional/local dependencies "
            "such as pydantic, numba, scipy, statsmodels, or their transitive dependencies.",
        )

    if tgw_ok:
        emit("PASS", "Final result: at least tgw imported successfully.")
        return 0

    if not tgw_ok and not amazing_ok:
        emit("FAIL", "Final result: both tgw and AmazingData failed to import.")
        return 1

    emit("WARN", "Final result: AmazingData imported but tgw failed; review dependency state.")
    return 1


def main(argv: Iterable[str] | None = None) -> int:
    del argv
    emit("INFO", "Yinhe SDK import smoke test starting.")
    emit("INFO", "Boundary: no login, no market-data query, no subscription, no trading request.")
    print_environment()
    check_metadata()
    exit_code = check_imports()
    emit("INFO", f"Yinhe SDK import smoke test finished with exit code {exit_code}.")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
