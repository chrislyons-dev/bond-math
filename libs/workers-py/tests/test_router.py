"""Tests for Router functionality."""

import pytest
from workers_py.router import Router
from workers_py import Request, JsonResponse


async def dummy_handler(request: Request) -> JsonResponse:
    """Dummy handler for testing."""
    return JsonResponse({"test": "ok"})


def test_route_registration():
    """Test basic route registration."""
    router = Router()
    router.add_route("/test", dummy_handler)

    route = router.find_route("GET", "/test")
    assert route is not None
    assert route.path == "/test"
    assert "GET" in route.methods


def test_route_multiple_methods():
    """Test route with multiple HTTP methods."""
    router = Router()
    router.add_route("/test", dummy_handler, methods=["GET", "POST"])

    route_get = router.find_route("GET", "/test")
    route_post = router.find_route("POST", "/test")

    assert route_get is not None
    assert route_post is not None
    assert route_get == route_post  # Same route


def test_route_not_found():
    """Test route not found returns None."""
    router = Router()
    router.add_route("/test", dummy_handler)

    route = router.find_route("GET", "/unknown")
    assert route is None


def test_route_method_mismatch():
    """Test method mismatch returns None."""
    router = Router()
    router.add_route("/test", dummy_handler, methods=["POST"])

    route = router.find_route("GET", "/test")
    assert route is None


def test_route_invalid_path():
    """Test invalid path raises error."""
    router = Router()

    with pytest.raises(ValueError, match="Path must start with"):
        router.add_route("invalid", dummy_handler)


def test_route_case_insensitive_methods():
    """Test HTTP methods are case-insensitive."""
    router = Router()
    router.add_route("/test", dummy_handler, methods=["get", "PoSt"])

    route_get = router.find_route("GET", "/test")
    route_post = router.find_route("POST", "/test")

    assert route_get is not None
    assert route_post is not None


def test_multiple_routes():
    """Test multiple distinct routes."""
    router = Router()
    router.add_route("/users", dummy_handler)
    router.add_route("/posts", dummy_handler)

    users_route = router.find_route("GET", "/users")
    posts_route = router.find_route("GET", "/posts")

    assert users_route is not None
    assert posts_route is not None
    assert users_route != posts_route
