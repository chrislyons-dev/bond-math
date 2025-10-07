"""Request wrapper for Cloudflare Workers."""

import json
from typing import Any


class Request:
    """Wrapper for Cloudflare Workers Request object with security features."""

    def __init__(self, raw_request: Any) -> None:
        """Initialize request wrapper.

        Args:
            raw_request: Raw Cloudflare Workers request object
        """
        self._request = raw_request
        self._parsed_json: dict[str, Any] | None = None

    @property
    def method(self) -> str:
        """Get HTTP method."""
        return str(self._request.method).upper()

    @property
    def url(self) -> str:
        """Get full request URL."""
        return str(self._request.url)

    @property
    def path(self) -> str:
        """Get request path without query string."""
        url_obj = self._request.url
        return str(url_obj.split("?")[0].split("#")[0])

    def header(self, name: str, default: str | None = None) -> str | None:
        """Get header value with safe defaults.

        Args:
            name: Header name (case-insensitive)
            default: Default value if header not found

        Returns:
            Header value or default
        """
        headers = self._request.headers
        value: Any = headers.get(name.lower(), default)
        return str(value) if value is not None else default

    async def json(self) -> dict[str, Any]:
        """Parse JSON body with validation.

        Returns:
            Parsed JSON object

        Raises:
            ValueError: If body is not valid JSON
        """
        if self._parsed_json is not None:
            return self._parsed_json

        try:
            body_text = await self._request.text()
            self._parsed_json = json.loads(body_text)

            if not isinstance(self._parsed_json, dict):
                raise ValueError("Request body must be a JSON object")

            return self._parsed_json
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON: {e}") from e

    async def text(self) -> str:
        """Get raw request body as text."""
        text: Any = await self._request.text()
        return str(text)
