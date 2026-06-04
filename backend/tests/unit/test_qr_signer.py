"""
QR signer — HMAC-SHA256 imzolash va tekshiruv test'lari.
DEV_PLAN §7.2 ga mos.
"""
import uuid
import pytest
from app.infra.qr.signer import QrSigner, InvalidQrPayloadError


@pytest.fixture
def signer():
    return QrSigner(secret="test-hmac-secret-32-bytes-longXXX")


@pytest.fixture
def signer2():
    """Boshqa kalit — cross-key tekshiruv uchun."""
    return QrSigner(secret="another-secret-key-32-bytes-YYYY")


class TestEncodeDecodeRoundtrip:
    def test_encode_returns_string(self, signer):
        product_id = uuid.uuid4()
        payload = signer.encode(product_id)
        assert isinstance(payload, str)
        assert len(payload) > 0

    def test_decode_returns_original_uuid(self, signer):
        product_id = uuid.uuid4()
        payload = signer.encode(product_id)
        decoded = signer.decode(payload)
        assert decoded == product_id

    def test_multiple_roundtrips(self, signer):
        for _ in range(20):
            pid = uuid.uuid4()
            assert signer.decode(signer.encode(pid)) == pid

    def test_different_ids_produce_different_payloads(self, signer):
        id1 = uuid.uuid4()
        id2 = uuid.uuid4()
        assert signer.encode(id1) != signer.encode(id2)

    def test_payload_is_url_safe(self, signer):
        """Payload QR-ga kiritilganda URL-safe bo'lishi shart."""
        pid = uuid.uuid4()
        payload = signer.encode(pid)
        # base64url: faqat A-Z, a-z, 0-9, -, _
        import re
        assert re.match(r'^[A-Za-z0-9_\-]+$', payload), f"Not URL-safe: {payload}"


class TestTamperDetection:
    def test_modified_payload_raises(self, signer):
        product_id = uuid.uuid4()
        payload = signer.encode(product_id)
        # Oxirgi belgini o'zgartirish
        tampered = payload[:-1] + ('A' if payload[-1] != 'A' else 'B')
        with pytest.raises(InvalidQrPayloadError):
            signer.decode(tampered)

    def test_truncated_payload_raises(self, signer):
        product_id = uuid.uuid4()
        payload = signer.encode(product_id)
        with pytest.raises(InvalidQrPayloadError):
            signer.decode(payload[:10])

    def test_empty_payload_raises(self, signer):
        with pytest.raises(InvalidQrPayloadError):
            signer.decode("")

    def test_random_string_raises(self, signer):
        with pytest.raises(InvalidQrPayloadError):
            signer.decode("not-a-valid-qr-payload-at-all")

    def test_wrong_key_raises(self, signer, signer2):
        """Bir signer bilan encode qilingan payload boshqa signer bilan decode bo'lmasin."""
        product_id = uuid.uuid4()
        payload = signer.encode(product_id)
        with pytest.raises(InvalidQrPayloadError):
            signer2.decode(payload)

    def test_swapped_segments_raises(self, signer):
        """UUID va HMAC qismlarini almashtirish."""
        pid = uuid.uuid4()
        payload = signer.encode(pid)
        # payload'ni ikkiga bo'lib almashtirish
        mid = len(payload) // 2
        swapped = payload[mid:] + payload[:mid]
        with pytest.raises(InvalidQrPayloadError):
            signer.decode(swapped)


class TestInvalidQrPayloadError:
    def test_error_is_exception(self):
        err = InvalidQrPayloadError("test")
        assert isinstance(err, Exception)

    def test_error_message(self):
        err = InvalidQrPayloadError("bad payload")
        assert "bad payload" in str(err)
