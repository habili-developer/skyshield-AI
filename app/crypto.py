import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def generate_aes_key() -> bytes:
    return AESGCM.generate_key(bit_length=256)


AES_KEY = os.environ.get("AES_KEY", None)
if not AES_KEY:
    AES_KEY = generate_aes_key()
else:
    AES_KEY = base64.b64decode(AES_KEY)

aesgcm = AESGCM(AES_KEY)


def encrypt(data: bytes, nonce: bytes = None) -> bytes:
    if nonce is None:
        nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, data, None)
    return nonce + ciphertext


def decrypt(encrypted_data: bytes) -> bytes:
    nonce = encrypted_data[:12]
    ciphertext = encrypted_data[12:]
    return aesgcm.decrypt(nonce, ciphertext, None)


def create_token(data: str) -> str:
    encrypted = encrypt(data.encode("utf-8"))
    return base64.urlsafe_b64encode(encrypted).decode("utf-8")


def verify_token(token: str) -> str:
    encrypted = base64.urlsafe_b64decode(token.encode("utf-8"))
    return decrypt(encrypted).decode("utf-8")
