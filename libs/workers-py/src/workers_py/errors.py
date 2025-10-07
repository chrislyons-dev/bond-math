"""Error handling utilities and custom exceptions."""

from typing import Optional


class HttpError(Exception):
    """Base exception for HTTP errors with status codes."""

    def __init__(
        self,
        message: str,
        status: int = 500,
        error_code: Optional[str] = None,
    ) -> None:
        """Initialize HTTP error.

        Args:
            message: Error message
            status: HTTP status code
            error_code: Optional error code for client use
        """
        super().__init__(message)
        self.message = message
        self.status = status
        self.error_code = error_code


class BadRequestError(HttpError):
    """400 Bad Request error."""

    def __init__(
        self, message: str = "Bad Request", error_code: Optional[str] = None
    ) -> None:
        """Initialize bad request error."""
        super().__init__(message, status=400, error_code=error_code)


class UnauthorizedError(HttpError):
    """401 Unauthorized error."""

    def __init__(
        self, message: str = "Unauthorized", error_code: Optional[str] = None
    ) -> None:
        """Initialize unauthorized error."""
        super().__init__(message, status=401, error_code=error_code)


class ForbiddenError(HttpError):
    """403 Forbidden error."""

    def __init__(
        self, message: str = "Forbidden", error_code: Optional[str] = None
    ) -> None:
        """Initialize forbidden error."""
        super().__init__(message, status=403, error_code=error_code)


class NotFoundError(HttpError):
    """404 Not Found error."""

    def __init__(
        self, message: str = "Not Found", error_code: Optional[str] = None
    ) -> None:
        """Initialize not found error."""
        super().__init__(message, status=404, error_code=error_code)


class ValidationError(HttpError):
    """422 Unprocessable Entity error for validation failures."""

    def __init__(
        self,
        message: str = "Validation Failed",
        error_code: Optional[str] = None,
    ) -> None:
        """Initialize validation error."""
        super().__init__(message, status=422, error_code=error_code)
