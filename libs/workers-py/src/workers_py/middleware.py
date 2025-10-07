"""Middleware support for request/response processing."""

from typing import Protocol, Awaitable
from .request import Request
from .response import Response


class Middleware(Protocol):
    """Protocol for middleware components."""

    async def __call__(
        self, request: Request, next_handler: "NextHandler"
    ) -> Response:
        """Process request and optionally call next handler.

        Args:
            request: Incoming request
            next_handler: Next handler in chain

        Returns:
            Response object
        """
        ...


class NextHandler(Protocol):
    """Protocol for next handler in middleware chain."""

    async def __call__(self, request: Request) -> Response:
        """Call next handler.

        Args:
            request: Request to process

        Returns:
            Response from handler
        """
        ...
