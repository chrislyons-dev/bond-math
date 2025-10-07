"""Tests for WorkersApp core functionality."""

import pytest
from workers_py import WorkersApp, Request, JsonResponse
from workers_py.errors import BadRequestError, NotFoundError


class MockRequest:
    """Mock Cloudflare Workers request."""

    def __init__(
        self, method: str = "GET", url: str = "http://example.com/test", headers=None
    ):
        self.method = method
        self.url = url
        self.headers = headers or {}

    async def text(self):
        return '{"test": "data"}'


@pytest.mark.asyncio
async def test_route_registration():
    """Test basic route registration and handling."""
    app = WorkersApp()

    @app.route("/test", methods=["GET"])
    async def test_handler(request: Request) -> JsonResponse:
        return JsonResponse({"status": "ok"})

    request = MockRequest(method="GET", url="http://example.com/test")
    response = await app.handle(request)

    assert response.status == 200
    assert '"status":"ok"' in response.body


@pytest.mark.asyncio
async def test_not_found():
    """Test 404 for unknown routes."""
    app = WorkersApp()

    request = MockRequest(method="GET", url="http://example.com/unknown")
    response = await app.handle(request)

    assert response.status == 404
    assert "Not Found" in response.body


@pytest.mark.asyncio
async def test_method_not_allowed():
    """Test route with specific methods."""
    app = WorkersApp()

    @app.route("/test", methods=["POST"])
    async def test_handler(request: Request) -> JsonResponse:
        return JsonResponse({"status": "ok"})

    # GET should not match POST-only route
    request = MockRequest(method="GET", url="http://example.com/test")
    response = await app.handle(request)

    assert response.status == 404


@pytest.mark.asyncio
async def test_error_handling():
    """Test global error handler."""
    app = WorkersApp()

    @app.route("/error", methods=["GET"])
    async def error_handler(request: Request) -> JsonResponse:
        raise BadRequestError("Test error")

    @app.error_handler
    async def handle_error(error: Exception) -> JsonResponse:
        if isinstance(error, BadRequestError):
            return JsonResponse({"error": str(error)}, status=400)
        return JsonResponse({"error": "Unknown"}, status=500)

    request = MockRequest(method="GET", url="http://example.com/error")
    response = await app.handle(request)

    assert response.status == 400
    assert "Test error" in response.body


@pytest.mark.asyncio
async def test_middleware_execution():
    """Test middleware chain execution."""
    app = WorkersApp()
    execution_log = []

    async def test_middleware(request, next_handler):
        execution_log.append("before")
        response = await next_handler(request)
        execution_log.append("after")
        return response

    app.use(test_middleware)

    @app.route("/test", methods=["GET"])
    async def test_handler(request: Request) -> JsonResponse:
        execution_log.append("handler")
        return JsonResponse({"status": "ok"})

    request = MockRequest(method="GET", url="http://example.com/test")
    await app.handle(request)

    assert execution_log == ["before", "handler", "after"]


@pytest.mark.asyncio
async def test_multiple_middleware():
    """Test multiple middleware in order."""
    app = WorkersApp()
    execution_log = []

    async def middleware1(request, next_handler):
        execution_log.append("m1_before")
        response = await next_handler(request)
        execution_log.append("m1_after")
        return response

    async def middleware2(request, next_handler):
        execution_log.append("m2_before")
        response = await next_handler(request)
        execution_log.append("m2_after")
        return response

    app.use(middleware1)
    app.use(middleware2)

    @app.route("/test", methods=["GET"])
    async def test_handler(request: Request) -> JsonResponse:
        execution_log.append("handler")
        return JsonResponse({"status": "ok"})

    request = MockRequest(method="GET", url="http://example.com/test")
    await app.handle(request)

    # Middleware executes in registration order
    assert execution_log == [
        "m1_before",
        "m2_before",
        "handler",
        "m2_after",
        "m1_after",
    ]
