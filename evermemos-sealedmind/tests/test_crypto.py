"""Crypto round-trip + tampering tests. No network required."""
from __future__ import annotations

import os

import pytest

from evermemos_sealedmind.crypto import derive_dek, derive_master_key, open_envelope, seal
from evermemos_sealedmind.errors import SealedMindCryptoError


def test_envelope_roundtrip():
    dek = os.urandom(32)
    plaintext = b"the user's running pace last month was 5:30/km"
    env = seal(plaintext, dek, "fitness", aad=b"key:run-2026-04")
    assert open_envelope(env.blob, dek, aad=b"key:run-2026-04") == plaintext


def test_envelope_tampered_ciphertext_fails():
    dek = os.urandom(32)
    env = seal(b"sensitive", dek, "ns", aad=b"k")
    tampered = bytearray(env.blob)
    tampered[-1] ^= 0x01
    with pytest.raises(SealedMindCryptoError):
        open_envelope(bytes(tampered), dek, aad=b"k")


def test_envelope_wrong_aad_fails():
    dek = os.urandom(32)
    env = seal(b"sensitive", dek, "ns", aad=b"correct-key")
    with pytest.raises(SealedMindCryptoError):
        open_envelope(env.blob, dek, aad=b"wrong-key")


def test_envelope_wrong_dek_fails():
    env = seal(b"sensitive", os.urandom(32), "ns", aad=b"k")
    with pytest.raises(SealedMindCryptoError):
        open_envelope(env.blob, os.urandom(32), aad=b"k")


def test_master_key_deterministic_for_same_signature():
    sig = os.urandom(65)
    a = derive_master_key(sig, "sealedmind.local")
    b = derive_master_key(sig, "sealedmind.local")
    assert a == b
    assert len(a) == 32


def test_master_key_differs_per_domain():
    sig = os.urandom(65)
    a = derive_master_key(sig, "sealedmind.local")
    b = derive_master_key(sig, "evil.example")
    assert a != b


def test_dek_isolation_per_namespace():
    master = os.urandom(32)
    a = derive_dek(master, "fitness")
    b = derive_dek(master, "finance")
    assert a != b
    assert len(a) == 32
