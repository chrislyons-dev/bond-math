"""Route matching and handler registration."""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from .request import Request
from .response import Response


@dataclass(frozen=True)
class Route:
    """Immutable route definition."""

    path: str
    methods: frozenset[str]
    handler: Callable[[Request], Awaitable[Response]]

    def matches(self, method: str, path: str) -> bool:
        """Check if route matches request.

        Args:
            method: HTTP method
            path: Request path

        Returns:
            True if route matches
        """
        return method.upper() in self.methods and self._path_matches(path)

    def _path_matches(self, path: str) -> bool:
        """Check if path matches route pattern.

        Simple exact matching for now. Can be extended for path parameters.

        Args:
            path: Request path

        Returns:
            True if path matches
        """
        return self.path == path


class Router:
    """Route registry with efficient matching."""

    def __init__(self) -> None:
        """Initialize router."""
        self._routes: list[Route] = []

    def add_route(
        self,
        path: str,
        handler: Callable[[Request], Awaitable[Response]],
        methods: list[str] | None = None,
    ) -> None:
        """Register a route.

        Args:
            path: URL path pattern
            handler: Async handler function
            methods: Allowed HTTP methods (defaults to GET)
        """
        if not path.startswith("/"):
            raise ValueError(f"Path must start with '/': {path}")

        allowed_methods = frozenset(m.upper() for m in (methods if methods else ["GET"]))

        route = Route(path=path, methods=allowed_methods, handler=handler)
        self._routes.append(route)

    def find_route(self, method: str, path: str) -> Route | None:
        """Find matching route for request.

        Args:
            method: HTTP method
            path: Request path

        Returns:
            Matching route or None
        """
        for route in self._routes:
            if route.matches(method, path):
                return route
        return None
