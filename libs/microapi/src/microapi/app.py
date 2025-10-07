"""Main application class for Cloudflare Python Workers."""

from collections.abc import Awaitable, Callable
from typing import Any, cast

from .middleware import Middleware, NextHandler
from .request import Request
from .response import JsonResponse, Response
from .router import Router


class App:
    """Micro API framework for Cloudflare Python Workers.

    Follows SOLID principles:
    - Single Responsibility: Routing and middleware coordination
    - Open/Closed: Extensible via decorators and middleware
    - Liskov Substitution: Middleware protocol allows substitution
    - Interface Segregation: Minimal protocol interfaces
    - Dependency Inversion: Depends on protocols, not concrete types
    """

    def __init__(self) -> None:
        """Initialize application."""
        self._router = Router()
        self._middleware: list[Middleware] = []
        self._error_handler: Callable[[Exception], Awaitable[Response]] | None = None

    def route(self, path: str, methods: list[str] | None = None) -> Callable[
        [Callable[[Request], Awaitable[Response]]],
        Callable[[Request], Awaitable[Response]],
    ]:
        """Decorator to register a route.

        Args:
            path: URL path pattern
            methods: Allowed HTTP methods (defaults to GET)

        Returns:
            Decorator function

        Example:
            @app.route("/health", methods=["GET"])
            async def health(request: Request) -> Response:
                return JsonResponse({"status": "healthy"})
        """

        def decorator(
            handler: Callable[[Request], Awaitable[Response]],
        ) -> Callable[[Request], Awaitable[Response]]:
            self._router.add_route(path, handler, methods)
            return handler

        return decorator

    def use(self, middleware: Middleware) -> None:
        """Register middleware.

        Middleware executes in registration order.

        Args:
            middleware: Middleware function
        """
        self._middleware.append(middleware)

    def error_handler(
        self, handler: Callable[[Exception], Awaitable[Response]]
    ) -> Callable[[Exception], Awaitable[Response]]:
        """Register global error handler.

        Args:
            handler: Error handler function

        Returns:
            Handler function (for decorator usage)
        """
        self._error_handler = handler
        return handler

    async def handle(self, raw_request: Any) -> Response:
        """Handle incoming request.

        This is the main entry point called by Cloudflare Workers runtime.

        Args:
            raw_request: Raw Cloudflare Workers request

        Returns:
            Response object
        """
        request = Request(raw_request)

        try:
            # Build middleware chain
            handler = self._build_handler(request)
            return await handler(request)
        except Exception as e:
            return await self._handle_error(e)

    def _build_handler(self, request: Request) -> Callable[[Request], Awaitable[Response]]:
        """Build middleware chain with route handler.

        Args:
            request: Request object

        Returns:
            Final handler function
        """
        # Find route
        route = self._router.find_route(request.method, request.path)

        if route is None:
            return self._not_found_handler

        # Build middleware chain from end to start
        handler: Callable[[Request], Awaitable[Response]] = route.handler

        for middleware in reversed(self._middleware):
            handler = self._wrap_middleware(middleware, handler)

        return handler

    def _wrap_middleware(
        self,
        middleware: Middleware,
        next_handler: Callable[[Request], Awaitable[Response]],
    ) -> Callable[[Request], Awaitable[Response]]:
        """Wrap handler with middleware.

        Args:
            middleware: Middleware to apply
            next_handler: Next handler in chain

        Returns:
            Wrapped handler
        """

        async def wrapped(request: Request) -> Response:
            return await middleware(request, cast(NextHandler, next_handler))

        return wrapped

    async def _not_found_handler(self, request: Request) -> Response:
        """Default 404 handler.

        Args:
            request: Request object

        Returns:
            404 response
        """
        return JsonResponse(
            {"error": "Not Found", "path": request.path},
            status=404,
        )

    async def _handle_error(self, error: Exception) -> Response:
        """Handle errors with custom or default handler.

        Args:
            error: Exception that occurred

        Returns:
            Error response
        """
        if self._error_handler:
            try:
                return await self._error_handler(error)
            except Exception:
                # Error handler itself failed, use default
                pass

        # Default error response
        return JsonResponse(
            {"error": "Internal Server Error", "message": str(error)},
            status=500,
        )
