"""Tests for validation decorators and Field class."""

import pytest
from workers_py import Field, validate_body, Request, JsonResponse
from workers_py.errors import ValidationError


class MockRequest:
    """Mock Cloudflare Workers request."""

    def __init__(self, body: str):
        self._body = body
        self.method = "POST"
        self.url = "http://example.com/test"
        self.headers = {}

    async def text(self):
        return self._body


# Field validation tests


def test_field_type_validation():
    """Test Field validates types correctly."""
    field = Field(type=str)
    field.validate("test", "valid string")  # Should not raise

    with pytest.raises(ValidationError, match="must be str"):
        field.validate("test", 123)


def test_field_min_length():
    """Test Field min_length validation."""
    field = Field(type=str, min_length=5)
    field.validate("test", "valid")  # Should not raise

    with pytest.raises(ValidationError, match="at least 5 items"):
        field.validate("test", "bad")


def test_field_max_length():
    """Test Field max_length validation."""
    field = Field(type=str, max_length=10)
    field.validate("test", "valid")  # Should not raise

    with pytest.raises(ValidationError, match="at most 10 items"):
        field.validate("test", "this is too long")


def test_field_min_value():
    """Test Field min_value validation."""
    field = Field(type=int, min_value=0)
    field.validate("test", 5)  # Should not raise

    with pytest.raises(ValidationError, match="at least 0"):
        field.validate("test", -5)


def test_field_max_value():
    """Test Field max_value validation."""
    field = Field(type=int, max_value=100)
    field.validate("test", 50)  # Should not raise

    with pytest.raises(ValidationError, match="at most 100"):
        field.validate("test", 150)


def test_field_enum_validation():
    """Test Field enum validation."""
    field = Field(type=str, enum=["ACT_360", "ACT_365F"])
    field.validate("convention", "ACT_360")  # Should not raise

    with pytest.raises(ValidationError, match="must be one of"):
        field.validate("convention", "INVALID")


def test_field_pattern_validation():
    """Test Field pattern validation."""
    field = Field(type=str, pattern=r"^\d{4}-\d{2}-\d{2}$")
    field.validate("date", "2025-01-15")  # Should not raise

    with pytest.raises(ValidationError, match="does not match required pattern"):
        field.validate("date", "invalid-date")


# validate_body decorator tests


@pytest.mark.asyncio
async def test_validate_body_success():
    """Test validate_body with valid data."""
    schema = {
        "name": Field(type=str, required=True),
        "age": Field(type=int, required=True, min_value=0),
    }

    @validate_body(schema)
    async def handler(request: Request) -> JsonResponse:
        body = await request.json()
        return JsonResponse({"name": body["name"]})

    request = MockRequest('{"name": "John", "age": 30}')
    response = await handler(request)

    assert response.status == 200
    assert "John" in response.body


@pytest.mark.asyncio
async def test_validate_body_missing_required():
    """Test validate_body detects missing required fields."""
    schema = {
        "name": Field(type=str, required=True),
        "age": Field(type=int, required=True),
    }

    @validate_body(schema)
    async def handler(request: Request) -> JsonResponse:
        return JsonResponse({"ok": True})

    request = MockRequest('{"name": "John"}')

    with pytest.raises(ValidationError, match="Missing required field: age"):
        await handler(request)


@pytest.mark.asyncio
async def test_validate_body_optional_field():
    """Test validate_body handles optional fields."""
    schema = {
        "name": Field(type=str, required=True),
        "nickname": Field(type=str, required=False),
    }

    @validate_body(schema)
    async def handler(request: Request) -> JsonResponse:
        body = await request.json()
        return JsonResponse({"name": body["name"]})

    # Should work without optional field
    request = MockRequest('{"name": "John"}')
    response = await handler(request)
    assert response.status == 200


@pytest.mark.asyncio
async def test_validate_body_invalid_json():
    """Test validate_body detects invalid JSON."""
    schema = {"name": Field(type=str, required=True)}

    @validate_body(schema)
    async def handler(request: Request) -> JsonResponse:
        return JsonResponse({"ok": True})

    request = MockRequest("not valid json")

    with pytest.raises(ValidationError, match="Invalid JSON"):
        await handler(request)


@pytest.mark.asyncio
async def test_validate_body_type_error():
    """Test validate_body detects type errors."""
    schema = {"age": Field(type=int, required=True)}

    @validate_body(schema)
    async def handler(request: Request) -> JsonResponse:
        return JsonResponse({"ok": True})

    request = MockRequest('{"age": "not a number"}')

    with pytest.raises(ValidationError, match="must be int"):
        await handler(request)


@pytest.mark.asyncio
async def test_validate_body_enum_validation():
    """Test validate_body validates enum constraints."""
    schema = {
        "convention": Field(
            type=str, required=True, enum=["ACT_360", "ACT_365F", "30_360"]
        )
    }

    @validate_body(schema)
    async def handler(request: Request) -> JsonResponse:
        return JsonResponse({"ok": True})

    # Valid enum value
    request = MockRequest('{"convention": "ACT_360"}')
    response = await handler(request)
    assert response.status == 200

    # Invalid enum value
    request = MockRequest('{"convention": "INVALID"}')
    with pytest.raises(ValidationError, match="must be one of"):
        await handler(request)


@pytest.mark.asyncio
async def test_validate_body_list_min_length():
    """Test validate_body validates list min_length."""
    schema = {"pairs": Field(type=list, required=True, min_length=1)}

    @validate_body(schema)
    async def handler(request: Request) -> JsonResponse:
        return JsonResponse({"ok": True})

    # Valid non-empty list
    request = MockRequest('{"pairs": [{"start": "2025-01-01", "end": "2025-12-31"}]}')
    response = await handler(request)
    assert response.status == 200

    # Invalid empty list
    request = MockRequest('{"pairs": []}')
    with pytest.raises(ValidationError, match="at least 1 items"):
        await handler(request)


@pytest.mark.asyncio
async def test_validate_body_numeric_range():
    """Test validate_body validates numeric ranges."""
    schema = {
        "couponRate": Field(type=float, required=True, min_value=0, max_value=1)
    }

    @validate_body(schema)
    async def handler(request: Request) -> JsonResponse:
        return JsonResponse({"ok": True})

    # Valid range
    request = MockRequest('{"couponRate": 0.05}')
    response = await handler(request)
    assert response.status == 200

    # Below minimum
    request = MockRequest('{"couponRate": -0.1}')
    with pytest.raises(ValidationError, match="at least 0"):
        await handler(request)

    # Above maximum
    request = MockRequest('{"couponRate": 1.5}')
    with pytest.raises(ValidationError, match="at most 1"):
        await handler(request)
