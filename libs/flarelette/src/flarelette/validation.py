"""Lightweight request validation decorators for Cloudflare Workers.

Provides schema-based validation without heavy dependencies like pydantic.
"""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from .errors import ValidationError
from .request import Request
from .response import Response


@dataclass
class Field:
    """Field validation rules.

    Validate one field.
    """

    type: type | tuple[type, ...]
    required: bool = True
    min_length: int | None = None
    max_length: int | None = None
    min_value: int | float | None = None
    max_value: int | float | None = None
    enum: list[Any] | None = None
    pattern: str | None = None

    def validate(self, field_name: str, value: Any) -> None:
        """Validate field value against rules.

        Args:
            field_name: Name of field being validated
            value: Value to validate

        Raises:
            ValidationError: If validation fails
        """
        # Type validation
        if not isinstance(value, self.type):
            type_name = self.type.__name__ if isinstance(self.type, type) else str(self.type)
            raise ValidationError(
                f"Field '{field_name}' must be {type_name}, " f"got {type(value).__name__}"
            )

        # Length validation (for strings, lists, dicts)
        if self.min_length is not None:
            if hasattr(value, "__len__"):
                if len(value) < self.min_length:
                    raise ValidationError(
                        f"Field '{field_name}' must have at least " f"{self.min_length} items"
                    )

        if self.max_length is not None:
            if hasattr(value, "__len__"):
                if len(value) > self.max_length:
                    raise ValidationError(
                        f"Field '{field_name}' must have at most " f"{self.max_length} items"
                    )

        # Numeric range validation
        if self.min_value is not None:
            if isinstance(value, (int, float)):
                if value < self.min_value:
                    raise ValidationError(f"Field '{field_name}' must be at least {self.min_value}")

        if self.max_value is not None:
            if isinstance(value, (int, float)):
                if value > self.max_value:
                    raise ValidationError(f"Field '{field_name}' must be at most {self.max_value}")

        # Enum validation
        if self.enum is not None:
            if value not in self.enum:
                raise ValidationError(
                    f"Field '{field_name}' must be one of: "
                    f"{', '.join(str(v) for v in self.enum)}"
                )

        # Pattern validation (for strings)
        if self.pattern is not None:
            if isinstance(value, str):
                import re

                if not re.match(self.pattern, value):
                    raise ValidationError(f"Field '{field_name}' does not match required pattern")


def validate_body(schema: dict[str, Field]) -> Callable[
    [Callable[[Request], Awaitable[Response]]],
    Callable[[Request], Awaitable[Response]],
]:
    """Decorator to validate request body against schema.

    Low cyclomatic complexity - single validation loop.

    Args:
        schema: Dictionary mapping field names to Field validators

    Returns:
        Decorator function

    Example:
        @app.route("/count", methods=["POST"])
        @validate_body({
            "pairs": Field(type=list, required=True, min_length=1),
            "convention": Field(type=str, required=True,
                              enum=["ACT_360", "ACT_365F"]),
        })
        async def handler(request: Request) -> Response:
            body = await request.json()  # Already validated
            return JsonResponse({"ok": True})
    """

    def decorator(
        handler: Callable[[Request], Awaitable[Response]],
    ) -> Callable[[Request], Awaitable[Response]]:
        async def wrapper(request: Request) -> Response:
            # Parse JSON body
            try:
                body = await request.json()
            except ValueError as e:
                raise ValidationError(f"Invalid JSON: {e}") from e

            # Validate each field in schema
            for field_name, field_spec in schema.items():
                if field_name not in body:
                    if field_spec.required:
                        raise ValidationError(f"Missing required field: {field_name}")
                    continue

                field_value = body[field_name]
                field_spec.validate(field_name, field_value)

            # Call original handler
            return await handler(request)

        return wrapper

    return decorator


def validate_query(schema: dict[str, Field]) -> Callable[
    [Callable[[Request], Awaitable[Response]]],
    Callable[[Request], Awaitable[Response]],
]:
    """Decorator to validate query parameters.

    Args:
        schema: Dictionary mapping parameter names to Field validators

    Returns:
        Decorator function

    Example:
        @app.route("/search", methods=["GET"])
        @validate_query({
            "limit": Field(type=int, required=False, min_value=1, max_value=100),
            "offset": Field(type=int, required=False, min_value=0),
        })
        async def search(request: Request) -> Response:
            # Query params already validated
            return JsonResponse({"results": []})
    """

    def decorator(
        handler: Callable[[Request], Awaitable[Response]],
    ) -> Callable[[Request], Awaitable[Response]]:
        async def wrapper(request: Request) -> Response:
            # Parse query string (implementation depends on Workers API)
            # For now, this is a placeholder
            query_params: dict[str, str] = {}

            # Validate each field in schema
            for field_name, field_spec in schema.items():
                if field_name not in query_params:
                    if field_spec.required:
                        raise ValidationError(f"Missing required query parameter: {field_name}")
                    continue

                # Type coercion for query params (always strings)
                raw_value = query_params[field_name]
                try:
                    typed_value: Any
                    if field_spec.type == int:
                        typed_value = int(raw_value)
                    elif field_spec.type == float:
                        typed_value = float(raw_value)
                    elif field_spec.type == bool:
                        typed_value = raw_value.lower() in ("true", "1", "yes")
                    else:
                        typed_value = raw_value

                    field_spec.validate(field_name, typed_value)
                except (ValueError, TypeError) as e:
                    raise ValidationError(
                        f"Invalid type for query parameter '{field_name}': {e}"
                    ) from e

            # Call original handler
            return await handler(request)

        return wrapper

    return decorator
