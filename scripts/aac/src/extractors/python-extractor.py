#!/usr/bin/env python3
"""
Python Extractor - Extract AAC metadata from Python services

Uses Python's ast module to parse docstrings and extract AAC annotations
"""

import ast
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional


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

    # Extract function/method docstrings for endpoint metadata
    for node in ast.walk(tree):
        # Check for endpoint annotations in function docstrings
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            docstring = ast.get_docstring(node)
            if docstring and "@endpoint" in docstring:
                annotations = parse_annotations(docstring)

                if "endpoint" in annotations and current_service:
                    # Parse endpoint definition (e.g., "POST /endpoint")
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

        # Extract class metadata for components
        elif isinstance(node, ast.ClassDef):
            docstring = ast.get_docstring(node)
            exclude_from_diagram = False

            if docstring:
                annotations = parse_annotations(docstring)
                exclude_from_diagram = annotations.get("excludeFromDiagram", False)

            if current_service:
                component = {
                    "id": f"{current_service['id']}.{node.name}",
                    "name": node.name,
                    "serviceId": current_service["id"],
                    "type": "class",
                }

                if docstring and not exclude_from_diagram:
                    # Get first line as description
                    first_line = docstring.split("\n")[0].strip()
                    if first_line:
                        component["description"] = first_line

                if exclude_from_diagram:
                    component["excludeFromDiagram"] = True

                components.append(component)

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
