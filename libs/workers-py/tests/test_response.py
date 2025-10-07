"""Tests for Response classes."""

import pytest
from workers_py import Response, JsonResponse


def test_response_creation():
    """Test basic response creation."""
    response = Response("test body", status=200)

    assert response.body == "test body"
    assert response.status == 200
    assert "X-Content-Type-Options" in response.headers


def test_response_security_headers():
    """Test security headers are added by default."""
    response = Response("test")

    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-XSS-Protection"] == "1; mode=block"


def test_response_custom_headers():
    """Test custom headers override defaults."""
    response = Response("test", headers={"X-Custom": "value"})

    assert response.headers["X-Custom"] == "value"
    # Security headers still present
    assert "X-Content-Type-Options" in response.headers


def test_response_invalid_status():
    """Test invalid status code raises error."""
    with pytest.raises(ValueError, match="Invalid status code"):
        Response("test", status=999)

    with pytest.raises(ValueError, match="Invalid status code"):
        Response("test", status=0)


def test_json_response():
    """Test JSON response serialization."""
    data = {"key": "value", "number": 42}
    response = JsonResponse(data)

    assert response.status == 200
    assert response.headers["Content-Type"] == "application/json"
    assert '"key":"value"' in response.body
    assert '"number":42' in response.body


def test_json_response_custom_status():
    """Test JSON response with custom status."""
    response = JsonResponse({"error": "Not Found"}, status=404)

    assert response.status == 404
    assert "error" in response.body


def test_json_response_invalid_data():
    """Test JSON response with non-serializable data."""

    class NotSerializable:
        pass

    with pytest.raises(ValueError, match="Cannot serialize to JSON"):
        JsonResponse({"obj": NotSerializable()})
