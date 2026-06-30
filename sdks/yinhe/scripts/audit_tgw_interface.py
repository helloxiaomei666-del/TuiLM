"""Static symbol audit for tgw.interface.

This script imports TGW modules from an isolated environment and uses inspect to
read symbols, signatures, docstrings, and class method names. It must not call
Login, Subscribe, QueryKline, QuerySnapshot, ReplayKline, or any other SDK
operation that may trigger login, network, market-data, subscription, or trading
behavior.
"""

from __future__ import annotations

import inspect
import json
import os
import platform
import sys
import traceback
from pathlib import Path
from types import ModuleType
from typing import Any


RUNTIME_OUTPUT = Path(".runtime/yinhe-smoke/tgw-interface-audit.json")
MODULE_NAMES = ("tgw", "tgw.interface", "tgw.base_struct", "tgw.server_spi")

CONNECTION_LOGIN = {"Login", "Close", "UpdatePassWord", "SetThirdInfoParam"}
MARKET_QUERY = {
    "QueryKline",
    "QuerySnapshot",
    "QueryOrderQueue",
    "QueryTickExecution",
    "QueryTickOrder",
    "QueryCodeTable",
    "QuerySecuritiesInfo",
    "QueryETFInfo",
    "QueryExFactorTable",
    "QueryFactor",
    "QueryHQFactor",
    "QueryThirdInfo",
}
SUBSCRIPTION = {
    "Subscribe",
    "SubFactor",
    "UnSubscribe",
    "UnSubFactor",
    "SubscribeDerivedData",
}
REPLAY = {"ReplayKline", "ReplayRequest", "CancelTask"}
VERSION_TOOL = {"GetVersion", "GetTaskID", "SetLogSpi"}


def first_doc_line(obj: Any) -> str:
    doc = inspect.getdoc(obj) or ""
    return doc.splitlines()[0].strip() if doc else ""


def safe_signature(obj: Any) -> str:
    try:
        return str(inspect.signature(obj))
    except Exception as exc:
        return f"<unavailable: {exc.__class__.__name__}: {exc}>"


def classify_function(name: str) -> str:
    if name in CONNECTION_LOGIN:
        return "connection_login"
    if name in MARKET_QUERY or name.startswith("Query"):
        return "market_query"
    if name in SUBSCRIPTION or "Subscribe" in name or "Sub" in name:
        return "subscription"
    if name in REPLAY or name.startswith("Replay"):
        return "replay"
    if name in VERSION_TOOL or "Version" in name or name.startswith("Get"):
        return "version_tool"
    return "other_uncategorized"


def public_functions(module: ModuleType) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for name, obj in inspect.getmembers(module, inspect.isfunction):
        if name.startswith("_"):
            continue
        rows.append(
            {
                "name": name,
                "signature": safe_signature(obj),
                "doc_first_line": first_doc_line(obj),
                "category": classify_function(name),
                "call_policy": "do_not_call_audit_only",
            }
        )
    return sorted(rows, key=lambda row: row["name"].lower())


def public_classes(module: ModuleType) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for name, obj in inspect.getmembers(module, inspect.isclass):
        if name.startswith("_"):
            continue
        if getattr(obj, "__module__", "").split(".")[0] != "tgw":
            continue
        methods = [
            method_name
            for method_name, method_obj in inspect.getmembers(obj, inspect.isfunction)
            if not method_name.startswith("_")
        ]
        rows.append(
            {
                "name": name,
                "module": getattr(obj, "__module__", ""),
                "init_signature": safe_signature(getattr(obj, "__init__", obj)),
                "doc_first_line": first_doc_line(obj),
                "methods": sorted(methods),
            }
        )
    return sorted(rows, key=lambda row: row["name"].lower())


def build_category_summary(functions: list[dict[str, str]]) -> dict[str, list[dict[str, str]]]:
    categories = {
        "connection_login": [],
        "market_query": [],
        "subscription": [],
        "replay": [],
        "version_tool": [],
        "other_uncategorized": [],
    }
    for func in functions:
        categories.setdefault(func["category"], []).append(func)
    return categories


def audit() -> dict[str, Any]:
    import tgw
    import tgw.base_struct as base_struct
    import tgw.interface as interface
    import tgw.server_spi as server_spi

    modules = {
        "tgw": tgw,
        "tgw.interface": interface,
        "tgw.base_struct": base_struct,
        "tgw.server_spi": server_spi,
    }

    interface_functions = public_functions(interface)
    base_struct_classes = public_classes(base_struct)
    server_spi_classes = public_classes(server_spi)

    return {
        "environment": {
            "python_executable": sys.executable,
            "python_version": sys.version.replace(os.linesep, " "),
            "platform": platform.platform(),
            "machine": platform.machine(),
            "cwd": os.getcwd(),
        },
        "modules": {
            name: {
                "file": getattr(module, "__file__", ""),
                "public_symbol_count": len([symbol for symbol in dir(module) if not symbol.startswith("_")]),
            }
            for name, module in modules.items()
        },
        "interface_functions": interface_functions,
        "interface_categories": build_category_summary(interface_functions),
        "base_struct_classes": base_struct_classes,
        "server_spi_classes": server_spi_classes,
        "safety": {
            "call_policy": "inspect_only",
            "forbidden_calls": [
                "Login",
                "Subscribe",
                "UnSubscribe",
                "QueryKline",
                "QuerySnapshot",
                "ReplayKline",
                "ReplayRequest",
                "Close",
            ],
            "network_or_market_request_performed": False,
        },
    }


def main() -> int:
    print("[INFO] TGW interface audit starting.")
    print("[INFO] Boundary: inspect only; no login, no market-data query, no subscription, no trading request.")
    try:
        result = audit()
        RUNTIME_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        RUNTIME_OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as exc:
        print(f"[FAIL] TGW interface audit failed: {exc.__class__.__name__}: {exc}")
        print("".join(traceback.format_exception(type(exc), exc, exc.__traceback__)))
        return 1

    print(f"[PASS] Wrote audit JSON: {RUNTIME_OUTPUT}")
    print(f"[INFO] interface function count: {len(result['interface_functions'])}")
    print(f"[INFO] base_struct class count: {len(result['base_struct_classes'])}")
    print(f"[INFO] server_spi class count: {len(result['server_spi_classes'])}")
    print("[PASS] TGW interface audit finished without calling SDK runtime operations.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
