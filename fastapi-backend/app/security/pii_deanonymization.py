"""
PII De-anonymization Mapping

Implements secure storage of PII mappings that are only decrypted
and used on the local client side.
"""

import json
import logging
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import secrets

from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)


@dataclass
class PIIMapping:
    """Single PII mapping entry"""
    placeholder: str
    entity_type: str
    hash_salt: str  # For verification only, not reversible
    encrypted_value: Optional[str] = None  # For local storage only
    created_at: str = ""
    expires_at: Optional[str] = None


class PIIDeAnonymizationManager:
    """
    Manages PII mappings for reversible anonymization.
    Encrypted mappings can be stored and transmitted to clients
    for local-side de-anonymization only.
    """

    def __init__(self, encryption_key: Optional[str] = None):
        """
        Initialize PII de-anonymization manager.

        Args:
            encryption_key: Fernet key for encrypting mappings.
                           If None, uses Fernet to generate one.
        """
        if encryption_key:
            try:
                self.cipher = Fernet(encryption_key.encode() if isinstance(encryption_key, str) else encryption_key)
            except Exception as e:
                logger.warning(f"Invalid encryption key provided: {e}. Generating new one.")
                self.encryption_key = Fernet.generate_key().decode()
                self.cipher = Fernet(self.encryption_key.encode())
        else:
            self.encryption_key = Fernet.generate_key().decode()
            self.cipher = Fernet(self.encryption_key.encode())

        self.mappings: Dict[str, PIIMapping] = {}

    @staticmethod
    def generate_encryption_key() -> str:
        """
        Generate a new Fernet encryption key.
        Store this securely (e.g., in environment variable or secrets manager).

        Returns:
            Base64-encoded encryption key
        """
        return Fernet.generate_key().decode()

    def create_mapping(
        self,
        placeholder: str,
        actual_value: str,
        entity_type: str,
        expires_in_hours: Optional[int] = None,
    ) -> PIIMapping:
        """
        Create a PII mapping entry.

        Args:
            placeholder: Placeholder string (e.g., "[PERSON_NAME_1]")
            actual_value: Real PII value (encrypted for storage)
            entity_type: Type of PII (PERSON_NAME, EMAIL, PHONE, etc.)
            expires_in_hours: Optional expiration time

        Returns:
            PIIMapping object
        """
        # Encrypt the actual value for storage
        encrypted_value = self.cipher.encrypt(actual_value.encode()).decode()

        # Generate hash salt for verification (non-reversible)
        hash_salt = secrets.token_hex(8)

        # Calculate expiration if specified
        expires_at = None
        if expires_in_hours:
            expires_at = (datetime.utcnow() + timedelta(hours=expires_in_hours)).isoformat()

        mapping = PIIMapping(
            placeholder=placeholder,
            entity_type=entity_type,
            hash_salt=hash_salt,
            encrypted_value=encrypted_value,
            created_at=datetime.utcnow().isoformat(),
            expires_at=expires_at,
        )

        self.mappings[placeholder] = mapping

        logger.info(
            f"Created PII mapping: {placeholder} (type: {entity_type}, "
            f"expires: {expires_at or 'never'})"
        )

        return mapping

    def store_mapping(
        self,
        request_id: str,
        original_text: str,
        redacted_text: str,
        pii_entities: Optional[Dict[str, list]] = None,
    ) -> str:
        """
        Alias for create_mapping to support SecurityMiddlewareStack.
        Store a PII de-anonymization mapping.

        Args:
            request_id: Unique request identifier (used as placeholder)
            original_text: Original text containing PII
            redacted_text: Redacted version of text
            pii_entities: Optional dict of detected PII entities

        Returns:
            Encrypted mapping token
        """
        # Create mapping with request_id as placeholder
        mapping = self.create_mapping(
            placeholder=request_id,
            actual_value=original_text,
            entity_type="full_text",
            expires_in_hours=1,
        )
        
        # Return the encrypted value as token
        return mapping.encrypted_value or ""

    def export_for_client(self) -> Tuple[dict, str]:
        """
        Export all mappings in encrypted format for client-side storage.
        Client must have the encryption key to decrypt.

        Returns:
            Tuple of (encrypted_mappings_dict, encryption_key_hint)

        Important: Only give encryption_key to trusted client!
        """
        mappings_json = json.dumps(
            {k: asdict(v) for k, v in self.mappings.items()},
            default=str,
        )

        exported = {
            "version": "1.0",
            "created_at": datetime.utcnow().isoformat(),
            "encryption_algorithm": "Fernet",
            "mappings_count": len(self.mappings),
            "mappings_data": self.mappings.copy(),  # In production, could encrypt entire bundle
        }

        logger.info(
            f"Exported {len(self.mappings)} PII mappings for client-side de-anonymization"
        )

        return exported, self.encryption_key

    def get_decryption_instructions(self) -> str:
        """
        Return instructions for client-side decryption.
        This would be provided to your frontend.
        """
        return """
# PII De-anonymization Instructions for Client

This export contains encrypted PII mappings. Follow these steps to de-anonymize:

1. Store the encryption key securely (e.g., in sessionStorage, NOT localStorage)
2. For each placeholder in the response:
   - Look up the encrypted value in the mapping
   - Decrypt using Fernet with the provided key
   - Replace the placeholder with the decrypted value

## Example (JavaScript):
const mappings = await fetchMappingsFromServer();
const encryptionKey = await getEncryptionKeyFromSecureChannel();

for (const [placeholder, mapping] of Object.entries(mappings)) {
  const decrypted = decryptFernet(mapping.encrypted_value, encryptionKey);
  document.body.innerHTML = document.body.innerHTML.replace(placeholder, decrypted);
}

## Security Notes:
- NEVER store the encryption key in localStorage
- NEVER log the encryption key or decrypted values
- Clear mappings and keys when user logs out
- Use HTTPS only
- Consider time-based expiration
"""

    def validate_expired(self) -> None:
        """Remove expired mappings"""
        now = datetime.utcnow()
        expired = [
            placeholder
            for placeholder, mapping in self.mappings.items()
            if mapping.expires_at and datetime.fromisoformat(mapping.expires_at) < now
        ]

        for placeholder in expired:
            del self.mappings[placeholder]
            logger.info(f"Removed expired PII mapping: {placeholder}")

    def get_statistics(self) -> dict:
        """Get statistics about PII mappings"""
        self.validate_expired()

        entity_counts = {}
        for mapping in self.mappings.values():
            entity_counts[mapping.entity_type] = entity_counts.get(mapping.entity_type, 0) + 1

        return {
            "total_mappings": len(self.mappings),
            "by_entity_type": entity_counts,
            "created_at": datetime.utcnow().isoformat(),
        }


# Alias for backward compatibility
PIIDeanonymizer = PIIDeAnonymizationManager
