"""Response builders for Cloudflare Workers."""

import json
from typing import Any


class Response:
    """HTTP response builder with security headers."""

    def __init__(
        self,
        body: str,
        status: int = 200,
        headers: dict[str, str] | None = None,
    ) -> None:
        """Initialize response.

        Args:
            body: Response body
            status: HTTP status code (must be 100-599)
            headers: Optional response headers
        """
        if not 100 <= status <= 599:
            raise ValueError(f"Invalid status code: {status}")

        self.body = body
        self.status = status
        self.headers = self._build_headers(headers or {})

    def _build_headers(self, custom_headers: dict[str, str]) -> dict[str, str]:
        """Build headers with security defaults.

        Args:
            custom_headers: User-provided headers

        Returns:
            Headers dict with security defaults
        """
        headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
        }
        headers.update(custom_headers)
        return headers

    def to_workers_response(self) -> Any:
        """Convert to Cloudflare Workers Response object."""
        # Import Response from js namespace (Cloudflare Workers API)
        from js import Response as WorkersResponse

        # Create proper Workers Response object
        return WorkersResponse.new(
            self.body,
            {
                "status": self.status,
                "headers": self.headers,
            },
        )


class JsonResponse(Response):
    """JSON response builder with automatic serialization."""

    def __init__(
        self,
        data: Any,
        status: int = 200,
        headers: dict[str, str] | None = None,
    ) -> None:
        """Initialize JSON response.

        Args:
            data: Data to serialize to JSON
            status: HTTP status code
            headers: Optional response headers
        """
        json_headers = {"Content-Type": "application/json"}
        if headers:
            json_headers.update(headers)

        try:
            body = json.dumps(data, separators=(",", ":"))
        except (TypeError, ValueError) as e:
            raise ValueError(f"Cannot serialize to JSON: {e}") from e

        super().__init__(body=body, status=status, headers=json_headers)
