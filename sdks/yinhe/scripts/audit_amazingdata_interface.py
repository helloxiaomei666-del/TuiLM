"""Static and semi-static symbol audit for the AmazingData SDK.

This script imports AmazingData from an isolated environment and uses pkgutil
plus inspect to read module and symbol metadata. It must not call SDK business
functions that may trigger login, network, market-data, download, subscription,
or trading behavior.
"""

from __future__ import annotations

import argparse
import contextlib
import importlib
import inspect
import json
import os
import platform
import pkgutil
import socket
import sys
import traceback
from pathlib import Path
from types import ModuleType
from typing import Any, Callable, Iterator


PACKAGE_NAME = "AmazingData"
DEFAULT_OUTPUT = Path(".runtime/yinhe-smoke/amazingdata-interface-audit.json")

CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "query": (
        "query",
        "search",
        "select",
        "fetch",
        "get",
        "list",
        "find",
        "lookup",
        "read",
        "calendar",
        "instrument",
        "security",
        "stock",
        "bond",
        "fund",
        "future",
        "option",
    ),
    "market_data": (
        "market",
        "quote",
        "snapshot",
        "kline",
        "bar",
        "tick",
        "price",
        "trade",
        "orderbook",
        "order_book",
        "行情",
        "快照",
        "日线",
        "分钟",
    ),
    "download": (
        "download",
        "export",
        "save",
        "file",
        "dataset",
        "write",
        "下载",
        "导出",
    ),
    "factor": (
        "factor",
        "alpha",
        "barra",
        "ic",
        "exposure",
        "因子",
    ),
    "portfolio": (
        "portfolio",
        "optimize",
        "optimizer",
        "allocation",
        "weight",
        "rebalance",
        "position",
        "组合",
        "优化",
    ),
    "performance": (
        "performance",
        "perf",
        "return",
        "drawdown",
        "sharpe",
        "annual",
        "risk",
        "绩效",
        "收益",
        "回撤",
    ),
    "attribution": (
        "attribution",
        "attribute",
        "brinson",
        "contribution",
        "归因",
        "贡献",
    ),
    "utils": (
        "util",
        "utils",
        "helper",
        "tool",
        "config",
        "constant",
        "date",
        "time",
        "cache",
        "log",
        "normalize",
        "parse",
        "format",
        "工具",
        "配置",
    ),
}
CATEGORY_ORDER = tuple(CATEGORY_KEYWORDS) + ("other_uncategorized",)


def first_doc_line(obj: Any) -> str:
    doc = inspect.getdoc(obj) or ""
    return doc.splitlines()[0].strip() if doc else ""


def safe_signature(obj: Any) -> str:
    try:
        return str(inspect.signature(obj))
    except Exception as exc:  # pragma: no cover - depends on SDK internals
        return f"<unavailable: {exc.__class__.__name__}: {exc}>"


def safe_file(obj: Any) -> str:
    try:
        return inspect.getfile(obj)
    except Exception:
        return getattr(obj, "__file__", "") or ""


def classify_text(*parts: str) -> str:
    haystack = " ".join(part or "" for part in parts).lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword.lower() in haystack for keyword in keywords):
            return category
    return "other_uncategorized"


def public_name(name: str) -> bool:
    return bool(name) and not name.startswith("_")


def is_amazingdata_origin(obj: Any) -> bool:
    module_name = getattr(obj, "__module__", "") or ""
    return module_name == PACKAGE_NAME or module_name.startswith(f"{PACKAGE_NAME}.")


def symbol_record(name: str, obj: Any, owner_module: str) -> dict[str, Any]:
    doc_first_line = first_doc_line(obj)
    origin_module = getattr(obj, "__module__", "")
    return {
        "name": name,
        "owner_module": owner_module,
        "origin_module": origin_module,
        "origin_file": safe_file(obj),
        "signature": safe_signature(obj),
        "doc_first_line": doc_first_line,
        "category": classify_text(owner_module, origin_module, name, doc_first_line),
        "local_to_amazingdata": is_amazingdata_origin(obj),
        "call_policy": "do_not_call_audit_only",
    }


def public_functions(module: ModuleType) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for name, obj in vars(module).items():
        if not public_name(name):
            continue
        if inspect.isfunction(obj) or inspect.isbuiltin(obj):
            rows.append(symbol_record(name, obj, module.__name__))
    return sorted(rows, key=lambda row: (row["category"], row["name"].lower()))


def class_methods(cls: type[Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for name, obj in vars(cls).items():
        if not public_name(name):
            continue

        candidate = obj
        method_kind = "attribute"
        if isinstance(obj, staticmethod):
            candidate = obj.__func__
            method_kind = "staticmethod"
        elif isinstance(obj, classmethod):
            candidate = obj.__func__
            method_kind = "classmethod"
        elif inspect.isfunction(obj):
            method_kind = "method"
        elif inspect.ismethoddescriptor(obj) or inspect.isbuiltin(obj):
            method_kind = "method_descriptor"
        else:
            continue

        record = symbol_record(name, candidate, getattr(cls, "__module__", ""))
        record["method_kind"] = method_kind
        rows.append(record)

    return sorted(rows, key=lambda row: row["name"].lower())


def public_classes(module: ModuleType) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for name, obj in vars(module).items():
        if not public_name(name):
            continue
        if not inspect.isclass(obj):
            continue
        doc_first_line = first_doc_line(obj)
        rows.append(
            {
                "name": name,
                "owner_module": module.__name__,
                "origin_module": getattr(obj, "__module__", ""),
                "origin_file": safe_file(obj),
                "init_signature": safe_signature(getattr(obj, "__init__", obj)),
                "doc_first_line": doc_first_line,
                "category": classify_text(module.__name__, getattr(obj, "__module__", ""), name, doc_first_line),
                "local_to_amazingdata": is_amazingdata_origin(obj),
                "methods": class_methods(obj),
                "call_policy": "do_not_instantiate_audit_only",
            }
        )
    return sorted(rows, key=lambda row: (row["category"], row["name"].lower()))


def public_constants(module: ModuleType) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    scalar_types = (str, int, float, bool, type(None))
    for name, obj in vars(module).items():
        if not public_name(name):
            continue
        if inspect.ismodule(obj) or inspect.isroutine(obj) or inspect.isclass(obj):
            continue
        if isinstance(obj, scalar_types):
            value_repr = repr(obj)
        else:
            value_repr = f"<{type(obj).__module__}.{type(obj).__name__}>"
        rows.append(
            {
                "name": name,
                "type": f"{type(obj).__module__}.{type(obj).__name__}",
                "value_repr": value_repr[:300],
                "category": classify_text(module.__name__, name),
            }
        )
    return sorted(rows, key=lambda row: row["name"].lower())


@contextlib.contextmanager
def blocked_network() -> Iterator[None]:
    """Block common network exits during import-only auditing."""

    original_socket_connect = socket.socket.connect
    original_create_connection = socket.create_connection

    def deny_connect(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("network disabled during AmazingData interface audit")

    socket.socket.connect = deny_connect  # type: ignore[method-assign]
    socket.create_connection = deny_connect  # type: ignore[assignment]

    patched_requests: list[tuple[Any, Callable[..., Any]]] = []
    try:
        try:
            import requests  # type: ignore[import-not-found]

            original_request = requests.sessions.Session.request

            def deny_request(self: Any, method: str, url: str, **kwargs: Any) -> None:
                raise RuntimeError("HTTP disabled during AmazingData interface audit")

            requests.sessions.Session.request = deny_request
            patched_requests.append((requests.sessions.Session, original_request))
        except Exception:
            pass

        yield
    finally:
        socket.socket.connect = original_socket_connect  # type: ignore[method-assign]
        socket.create_connection = original_create_connection  # type: ignore[assignment]
        for session_cls, original_request in patched_requests:
            session_cls.request = original_request


def safe_import(module_name: str) -> tuple[ModuleType | None, str]:
    try:
        with blocked_network():
            return importlib.import_module(module_name), ""
    except Exception as exc:
        return None, "".join(traceback.format_exception_only(type(exc), exc)).strip()


def discover_modules(root_module: ModuleType) -> tuple[list[str], list[dict[str, str]]]:
    discovered = {root_module.__name__}
    discovery_errors: list[dict[str, str]] = []
    package_path = getattr(root_module, "__path__", None)
    if package_path is None:
        return sorted(discovered), discovery_errors

    def onerror(module_name: str) -> None:
        discovery_errors.append({"module": module_name, "error": "pkgutil.walk_packages discovery error"})

    try:
        with blocked_network():
            for module_info in pkgutil.walk_packages(package_path, prefix=f"{root_module.__name__}.", onerror=onerror):
                discovered.add(module_info.name)
    except Exception as exc:
        discovery_errors.append(
            {
                "module": root_module.__name__,
                "error": "".join(traceback.format_exception_only(type(exc), exc)).strip(),
            }
        )

    return sorted(discovered), discovery_errors


def module_record(module_name: str, module: ModuleType | None, import_error: str) -> dict[str, Any]:
    if module is None:
        return {
            "name": module_name,
            "imported": False,
            "import_error": import_error,
            "file": "",
            "category": classify_text(module_name),
            "public_symbol_count": 0,
            "functions": [],
            "classes": [],
            "constants": [],
        }

    public_symbols = [name for name in dir(module) if public_name(name)]
    doc_first_line = first_doc_line(module)
    return {
        "name": module_name,
        "imported": True,
        "import_error": "",
        "file": getattr(module, "__file__", "") or "",
        "category": classify_text(module_name, doc_first_line),
        "doc_first_line": doc_first_line,
        "public_symbol_count": len(public_symbols),
        "functions": public_functions(module),
        "classes": public_classes(module),
        "constants": public_constants(module),
    }


def summarize_categories(modules: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    summary: dict[str, dict[str, Any]] = {
        category: {"modules": [], "functions": [], "classes": []} for category in CATEGORY_ORDER
    }
    for module in modules:
        summary.setdefault(module["category"], {"modules": [], "functions": [], "classes": []})
        summary[module["category"]]["modules"].append(module["name"])
        for function in module["functions"]:
            summary.setdefault(function["category"], {"modules": [], "functions": [], "classes": []})
            summary[function["category"]]["functions"].append(
                {
                    "module": module["name"],
                    "name": function["name"],
                    "signature": function["signature"],
                    "doc_first_line": function["doc_first_line"],
                }
            )
        for cls in module["classes"]:
            summary.setdefault(cls["category"], {"modules": [], "functions": [], "classes": []})
            summary[cls["category"]]["classes"].append(
                {
                    "module": module["name"],
                    "name": cls["name"],
                    "init_signature": cls["init_signature"],
                    "doc_first_line": cls["doc_first_line"],
                    "method_count": len(cls["methods"]),
                }
            )
    return summary


def audit() -> dict[str, Any]:
    root_module, root_error = safe_import(PACKAGE_NAME)
    if root_module is None:
        return {
            "environment": environment_record(),
            "package": {"name": PACKAGE_NAME, "imported": False, "import_error": root_error},
            "discovered_module_count": 0,
            "imported_module_count": 0,
            "failed_import_count": 1,
            "discovery_errors": [],
            "modules": [module_record(PACKAGE_NAME, None, root_error)],
            "category_summary": summarize_categories([module_record(PACKAGE_NAME, None, root_error)]),
            "safety": safety_record(),
        }

    module_names, discovery_errors = discover_modules(root_module)
    modules: list[dict[str, Any]] = []
    for module_name in module_names:
        if module_name == PACKAGE_NAME:
            module = root_module
            import_error = ""
        else:
            module, import_error = safe_import(module_name)
        modules.append(module_record(module_name, module, import_error))

    return {
        "environment": environment_record(),
        "package": {
            "name": PACKAGE_NAME,
            "imported": True,
            "file": getattr(root_module, "__file__", "") or "",
            "path": list(getattr(root_module, "__path__", [])),
            "doc_first_line": first_doc_line(root_module),
        },
        "discovered_module_count": len(module_names),
        "imported_module_count": len([module for module in modules if module["imported"]]),
        "failed_import_count": len([module for module in modules if not module["imported"]]),
        "discovery_errors": discovery_errors,
        "modules": modules,
        "category_summary": summarize_categories(modules),
        "safety": safety_record(),
    }


def environment_record() -> dict[str, str]:
    return {
        "python_executable": sys.executable,
        "python_version": sys.version.replace(os.linesep, " "),
        "platform": platform.platform(),
        "machine": platform.machine(),
        "cwd": os.getcwd(),
    }


def safety_record() -> dict[str, Any]:
    return {
        "call_policy": "import_and_inspect_only",
        "network_guard": "socket.connect, socket.create_connection, and requests Session.request blocked during imports",
        "forbidden_runtime_actions": [
            "login",
            "market_data_request",
            "subscription",
            "download_request",
            "trading_request",
            "SDK business function invocation",
        ],
        "network_or_market_request_performed": False,
        "business_functions_called": False,
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit AmazingData package symbols without SDK runtime calls.")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"JSON output path. Default: {DEFAULT_OUTPUT}",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    print("[INFO] AmazingData interface audit starting.")
    print("[INFO] Boundary: import and inspect only; no login, no market-data query, no subscription, no download, no trading request.")
    result = audit()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"[PASS] Wrote audit JSON: {args.output}")
    print(f"[INFO] discovered modules: {result['discovered_module_count']}")
    print(f"[INFO] imported modules: {result['imported_module_count']}")
    print(f"[INFO] failed imports: {result['failed_import_count']}")
    print("[PASS] AmazingData interface audit finished without calling SDK runtime operations.")
    return 0 if result["package"]["imported"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
