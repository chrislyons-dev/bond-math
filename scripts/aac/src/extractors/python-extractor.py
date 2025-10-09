#!/usr/bin/env python3
"""
Python Extractor - Extract AAC metadata from Python services

Uses Python's ast module to parse docstrings and extract AAC annotations.
Supports functional programming constructs with purity classification.
"""

import ast
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Set


def parse_annotations(text: str) -> Dict[str, Any]:
    """Parse AAC annotations from docstring text"""
    annotations = {}
    lines = text.split("\n")

    for line in lines:
        line = line.strip()

        # Match @tag value patterns
        match = re.match(r"^@([\w-]+)\s+(.+)$", line)
        if not match:
            continue

        tag, value = match.groups()
        value = value.strip()

        # Convert kebab-case to camelCase for consistency
        camel_tag = re.sub(r"-([a-z])", lambda m: m.group(1).upper(), tag)

        if tag in [
            "service",
            "owner",
            "description",
            "endpoint",
            "gateway-route",
            "authentication",
            "scope",
            "rate-limit",
            "service-binding",
            "target",
            "purpose",
        ]:
            annotations[camel_tag] = value
        elif tag in ["type", "layer", "security-model", "sla-tier"]:
            annotations[camel_tag] = value
        elif tag in ["internal-routes", "public-routes", "dependencies"]:
            annotations[camel_tag] = value
        elif tag == "cacheable":
            annotations["cacheable"] = value.lower()
        elif tag == "cache-ttl":
            annotations["cacheTtl"] = value
        elif tag == "exclude-from-diagram":
            annotations["excludeFromDiagram"] = True

    return annotations


def parse_list(value: Optional[str]) -> Optional[List[str]]:
    """Parse comma-separated list from annotation value"""
    if not value:
        return None
    items = [s.strip() for s in value.split(",")]
    return [s for s in items if s and s != "none"]


def get_type_annotation(annotation: Optional[ast.expr]) -> str:
    """Extract type annotation as string"""
    if annotation is None:
        return "Any"

    if isinstance(annotation, ast.Name):
        return annotation.id
    elif isinstance(annotation, ast.Constant):
        return str(annotation.value)
    elif isinstance(annotation, ast.Subscript):
        # Handle generics like List[str], Optional[int]
        base = get_type_annotation(annotation.value)
        slice_type = get_type_annotation(annotation.slice)
        return f"{base}[{slice_type}]"
    elif isinstance(annotation, ast.Tuple):
        # Handle Tuple[int, str]
        types = [get_type_annotation(elt) for elt in annotation.elts]
        return f"Tuple[{', '.join(types)}]"
    elif isinstance(annotation, ast.BinOp):
        # Handle Union types with | operator (Python 3.10+)
        left = get_type_annotation(annotation.left)
        right = get_type_annotation(annotation.right)
        return f"{left} | {right}"
    elif isinstance(annotation, ast.Attribute):
        # Handle module.Type
        value = get_type_annotation(annotation.value)
        return f"{value}.{annotation.attr}"
    else:
        return "Any"


def classify_function_purity(node: ast.FunctionDef, body_text: str) -> str:
    """Classify a function as 'pure' or 'effectful'"""
    # Async functions are always effectful
    if isinstance(node, ast.AsyncFunctionDef):
        return "effectful"

    # Check return type for effectful patterns
    if node.returns:
        return_type = get_type_annotation(node.returns)
        effectful_types = ["Coroutine", "Awaitable", "Generator", "AsyncGenerator", "Iterator"]
        for etype in effectful_types:
            if etype in return_type:
                return "effectful"

    # Check for effectful patterns in body
    effectful_patterns = [
        "print(",
        "open(",
        "input(",
        "requests.",
        "urllib.",
        "datetime.now",
        "time.time",
        "random.",
        "os.",
        "sys.",
        ".write(",
        ".read(",
        "socket.",
        "http.",
        "sql",
        "db.",
        "cursor",
        "connection",
        "session",
    ]

    body_lower = body_text.lower()
    for pattern in effectful_patterns:
        if pattern in body_lower:
            return "effectful"

    # Check AST for effectful operations
    for child in ast.walk(node):
        # I/O operations
        if isinstance(child, ast.Call):
            if isinstance(child.func, ast.Name):
                if child.func.id in ["print", "open", "input", "exec", "eval"]:
                    return "effectful"
            elif isinstance(child.func, ast.Attribute):
                # Check for methods like file.write(), db.query()
                if child.func.attr in ["write", "read", "query", "execute", "commit"]:
                    return "effectful"

        # Global variable modifications
        if isinstance(child, (ast.Global, ast.Nonlocal)):
            return "effectful"

    return "pure"


def extract_function_signature(node: ast.FunctionDef) -> Dict[str, Any]:
    """Extract function signature with parameters and return type"""
    parameters = []

    for arg in node.args.args:
        param = {
            "name": arg.arg,
            "type": get_type_annotation(arg.annotation),
            "isOptional": False,
        }
        parameters.append(param)

    # Handle optional parameters with defaults
    defaults_offset = len(node.args.args) - len(node.args.defaults)
    for i, default in enumerate(node.args.defaults):
        param_index = defaults_offset + i
        if param_index < len(parameters):
            parameters[param_index]["isOptional"] = True

    return_type = get_type_annotation(node.returns) if node.returns else "None"

    return {
        "parameters": parameters,
        "returnType": return_type,
        "isAsync": isinstance(node, ast.AsyncFunctionDef),
    }


def has_decorator(node: ast.FunctionDef, decorator_names: List[str]) -> bool:
    """Check if function has any of the given decorators"""
    for decorator in node.decorator_list:
        if isinstance(decorator, ast.Name) and decorator.id in decorator_names:
            return True
        elif isinstance(decorator, ast.Attribute) and decorator.attr in decorator_names:
            return True
    return False


def is_dataclass(node: ast.ClassDef) -> bool:
    """Check if class is a dataclass"""
    return has_decorator(node, ["dataclass"])


def extract_from_python_file(file_path: Path, service_id: str) -> Dict[str, Any]:
    """Extract AAC metadata from a Python file"""
    with open(file_path, "r", encoding="utf-8") as f:
        source = f.read()

    try:
        tree = ast.parse(source, filename=str(file_path))
    except SyntaxError as e:
        print(f"Error parsing {file_path}: {e}", file=sys.stderr)
        return {"services": [], "components": []}

    services = []
    components = []
    endpoints = []
    current_service = None

    # Extract module-level docstring for service metadata
    module_docstring = ast.get_docstring(tree)
    if module_docstring:
        annotations = parse_annotations(module_docstring)

        if "service" in annotations:
            # Found service-level metadata
            service_name = annotations["service"]
            current_service = {
                "id": service_name,
                "name": " ".join(
                    word.capitalize() for word in service_name.split("-")
                ),
                "type": annotations.get("type", "cloudflare-worker-python"),
                "layer": annotations.get("layer", "business-logic"),
                "description": annotations.get("description", ""),
            }

            # Optional fields
            if "owner" in annotations:
                current_service["owner"] = annotations["owner"]
            if "sourcePath" in annotations:
                current_service["sourcePath"] = annotations["sourcePath"]
            if "internalRoutes" in annotations:
                current_service["internalRoutes"] = parse_list(
                    annotations["internalRoutes"]
                )
            if "publicRoutes" in annotations:
                current_service["publicRoutes"] = parse_list(
                    annotations["publicRoutes"]
                )
            if "dependencies" in annotations:
                current_service["dependencies"] = parse_list(
                    annotations["dependencies"]
                )
            if "securityModel" in annotations:
                current_service["securityModel"] = annotations["securityModel"]
            if "slaTier" in annotations:
                current_service["slaTier"] = annotations["slaTier"]

            current_service["endpoints"] = []
            services.append(current_service)

    # Collect top-level functions for module component
    module_functions = []

    # Process top-level nodes
    for node in tree.body:
        # Extract endpoint metadata and top-level functions
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            docstring = ast.get_docstring(node)

            # Check for endpoint annotation
            if docstring and "@endpoint" in docstring:
                annotations = parse_annotations(docstring)

                if "endpoint" in annotations and current_service:
                    parts = annotations["endpoint"].split(None, 1)
                    if len(parts) == 2:
                        method, path = parts
                        endpoint = {
                            "method": method.upper(),
                            "path": path,
                        }

                        # Optional endpoint fields
                        if "gatewayRoute" in annotations:
                            endpoint["gatewayRoute"] = annotations["gatewayRoute"]
                        if "authentication" in annotations:
                            endpoint["authentication"] = annotations["authentication"]
                        if "scope" in annotations:
                            endpoint["scope"] = annotations["scope"]
                        if "rateLimit" in annotations:
                            endpoint["rateLimit"] = annotations["rateLimit"]
                        if "cacheable" in annotations:
                            endpoint["cacheable"] = (
                                annotations["cacheable"] == "true"
                            )
                        if "cacheTtl" in annotations:
                            endpoint["cacheTtl"] = int(annotations["cacheTtl"])

                        endpoints.append(endpoint)

            # Extract as module function if top-level
            if current_service and not node.name.startswith("_"):
                signature = extract_function_signature(node)
                purity = classify_function_purity(node, source)

                function_info = {
                    "name": node.name,
                    "returnType": signature["returnType"],
                    "parameters": signature["parameters"],
                    "isAsync": signature["isAsync"],
                    "isExported": True,  # Top-level functions are exported
                    "stereotype": purity,
                }
                module_functions.append(function_info)

        # Extract classes with full details
        elif isinstance(node, ast.ClassDef):
            docstring = ast.get_docstring(node)
            exclude_from_diagram = False

            if docstring:
                annotations = parse_annotations(docstring)
                exclude_from_diagram = annotations.get("excludeFromDiagram", False)

            if current_service:
                # Determine stereotype
                stereotype = None
                if is_dataclass(node):
                    stereotype = "immutable"

                component = {
                    "id": f"{current_service['id']}.{node.name}",
                    "name": node.name,
                    "serviceId": current_service["id"],
                    "type": "class",
                    "properties": [],
                    "methods": [],
                }

                if stereotype:
                    component["stereotype"] = stereotype

                # Extract properties (class attributes)
                for item in node.body:
                    if isinstance(item, ast.AnnAssign):
                        # Annotated attribute (e.g., name: str)
                        if isinstance(item.target, ast.Name):
                            prop = {
                                "name": item.target.id,
                                "type": get_type_annotation(item.annotation),
                                "isOptional": False,
                                "isReadonly": False,
                            }
                            component["properties"].append(prop)

                # Extract methods
                for item in node.body:
                    if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        # Skip private methods, __init__, and special methods
                        if item.name.startswith("__"):
                            continue

                        signature = extract_function_signature(item)
                        method_purity = classify_function_purity(item, source)

                        # Filter out 'self' parameter
                        params = [p for p in signature["parameters"] if p["name"] != "self"]

                        method = {
                            "name": item.name,
                            "returnType": signature["returnType"],
                            "parameters": params,
                            "isAsync": signature["isAsync"],
                            "stereotype": method_purity,
                        }

                        # Determine visibility
                        if item.name.startswith("_"):
                            method["visibility"] = "private"
                        else:
                            method["visibility"] = "public"

                        component["methods"].append(method)

                if docstring and not exclude_from_diagram:
                    first_line = docstring.split("\n")[0].strip()
                    if first_line:
                        component["description"] = first_line

                if exclude_from_diagram:
                    component["excludeFromDiagram"] = True

                components.append(component)

    # Create module component for top-level functions
    if current_service and module_functions:
        file_name = file_path.stem  # e.g., "main" from "main.py"
        module_component = {
            "id": f"{current_service['id']}.{file_name}",
            "name": file_name,
            "serviceId": current_service["id"],
            "type": "module",
            "description": f"Module: {file_name}",
            "excludeFromDiagram": False,
            "functions": module_functions,
        }

        # Determine module stereotype based on functions
        has_effectful = any(f["stereotype"] == "effectful" for f in module_functions)
        module_component["stereotype"] = "effectful" if has_effectful else "pure"

        components.append(module_component)

    # Add endpoints to service
    if current_service and endpoints:
        current_service["endpoints"] = endpoints

    return {"services": services, "components": components}


def main():
    """CLI entry point"""
    if len(sys.argv) < 3:
        print("Usage: python-extractor.py <file-path> <service-id>", file=sys.stderr)
        sys.exit(1)

    file_path = Path(sys.argv[1])
    service_id = sys.argv[2]

    if not file_path.exists():
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        sys.exit(1)

    result = extract_from_python_file(file_path, service_id)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
