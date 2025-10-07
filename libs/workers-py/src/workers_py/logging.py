"""Structured logging middleware for Cloudflare Workers.

Uses python-json-logger for lightweight JSON formatting with stdlib logging.
"""

from typing import Callable, Awaitable, Any, Optional
import logging
import time
from pythonjsonlogger import jsonlogger
from .request import Request
from .response import Response


class StructuredLogger:
    """Structured JSON logger following ADR-0013 standards.

    Uses python-json-logger for JSON formatting with stdlib logging.
    """

    def __init__(self, service: str) -> None:
        """Initialize logger.

        Args:
            service: Service name identifier
        """
        self.service = service
        self._logger = logging.getLogger(service)
        self._logger.setLevel(logging.INFO)

        # Only add handler if not already configured
        if not self._logger.handlers:
            handler = logging.StreamHandler()
            formatter = jsonlogger.JsonFormatter(
                "%(timestamp)s %(level)s %(service)s %(message)s",
                rename_fields={"levelname": "level"},
            )
            handler.setFormatter(formatter)
            self._logger.addHandler(handler)

    def _log(
        self,
        level: int,
        message: str,
        request_id: Optional[str] = None,
        **context: Any,
    ) -> None:
        """Output structured log entry.

        Args:
            level: Logging level (logging.INFO, logging.WARNING, etc.)
            message: Human-readable message
            request_id: Request correlation ID
            **context: Additional context fields
        """
        extra = {"service": self.service}

        if request_id:
            extra["requestId"] = request_id

        if context:
            extra["context"] = context

        self._logger.log(level, message, extra=extra)

    def info(
        self, message: str, request_id: Optional[str] = None, **context: Any
    ) -> None:
        """Log info message."""
        self._log(logging.INFO, message, request_id, **context)

    def warn(
        self, message: str, request_id: Optional[str] = None, **context: Any
    ) -> None:
        """Log warning message."""
        self._log(logging.WARNING, message, request_id, **context)

    def error(
        self, message: str, request_id: Optional[str] = None, **context: Any
    ) -> None:
        """Log error message."""
        self._log(logging.ERROR, message, request_id, **context)


class LoggingMiddleware:
    """Middleware for request/response logging."""

    def __init__(self, logger: StructuredLogger) -> None:
        """Initialize logging middleware.

        Args:
            logger: Structured logger instance
        """
        self.logger = logger

    async def __call__(
        self,
        request: Request,
        next_handler: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        """Log request and response.

        Args:
            request: Incoming request
            next_handler: Next handler in chain

        Returns:
            Response from handler
        """
        request_id = request.header("x-request-id")
        start_time = time.perf_counter()

        self.logger.info(
            "Request started",
            request_id=request_id,
            method=request.method,
            path=request.path,
        )

        try:
            response = await next_handler(request)
            duration_ms = int((time.perf_counter() - start_time) * 1000)

            self.logger.info(
                "Request completed",
                request_id=request_id,
                duration=duration_ms,
                status=response.status,
            )

            return response
        except Exception as e:
            duration_ms = int((time.perf_counter() - start_time) * 1000)

            self.logger.error(
                "Request failed",
                request_id=request_id,
                duration=duration_ms,
                error=str(e),
                error_type=type(e).__name__,
            )
            raise
