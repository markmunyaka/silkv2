"""
Token-Based Rate Limiting

Prevents wallet-jacking and DDoS attacks by implementing
token bucket algorithm with per-user, per-ip, and global limits.
"""

import logging
import time
from typing import Optional, Dict, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class RateLimitConfig:
    """Configuration for rate limiting"""
    # Global limits
    global_requests_per_minute: int = 1000
    global_tokens_per_minute: int = 50000

    # Per-IP limits
    ip_requests_per_minute: int = 100
    ip_tokens_per_minute: int = 5000

    # Per-user limits (requires auth)
    user_requests_per_minute: int = 200
    user_tokens_per_minute: int = 10000

    # Request costs (API calls consume tokens)
    token_cost_pdf_upload: int = 100  # Cost to upload PDF
    token_cost_llm_call: int = 500    # Cost to call LLM (high, prevents wallet-jacking)
    token_cost_api_call: int = 50     # Cost for general API call

    # Cooldown periods
    block_duration_seconds: int = 300  # 5 minutes


@dataclass
class TokenBucket:
    """Token bucket for rate limiting"""
    capacity: int
    refill_rate: float  # tokens per second
    tokens: float = field(default_factory=lambda: None)
    last_refill_time: float = field(default_factory=time.time)

    def __post_init__(self):
        if self.tokens is None:
            self.tokens = float(self.capacity)

    def refill(self) -> None:
        """Refill tokens based on elapsed time"""
        now = time.time()
        elapsed = now - self.last_refill_time
        tokens_to_add = elapsed * self.refill_rate
        self.tokens = min(self.capacity, self.tokens + tokens_to_add)
        self.last_refill_time = now

    def consume(self, tokens: int) -> bool:
        """
        Attempt to consume tokens.

        Args:
            tokens: Number of tokens to consume

        Returns:
            True if successful, False if insufficient tokens
        """
        self.refill()
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False

    def get_available(self) -> float:
        """Get current available tokens"""
        self.refill()
        return self.tokens


class RateLimiter:
    """
    Token-based rate limiter preventing API abuse and wallet-jacking.
    Implements multi-level limits (global, per-IP, per-user).
    """

    def __init__(self, config: RateLimitConfig = RateLimitConfig()):
        self.config = config
        self.global_bucket = TokenBucket(
            capacity=config.global_tokens_per_minute,
            refill_rate=config.global_tokens_per_minute / 60.0,
        )
        self.ip_buckets: Dict[str, TokenBucket] = {}
        self.user_buckets: Dict[str, TokenBucket] = {}
        self.blocked_ips: Dict[str, float] = {}  # IP -> unblock_time
        self.blocked_users: Dict[str, float] = {}  # User -> unblock_time
        self.request_counts: Dict[str, int] = {}  # Track per-minute requests

    def is_allowed(
        self,
        client_ip: str,
        operation: str = "api_call",
        user_id: Optional[str] = None,
    ) -> Tuple[bool, str]:
        """
        Check if request is allowed under rate limits.

        Args:
            client_ip: Client IP address
            operation: Type of operation (pdf_upload, llm_call, api_call)
            user_id: Authenticated user ID (if available)

        Returns:
            Tuple of (is_allowed, reason)
        """
        # Check if IP is blocked
        if client_ip in self.blocked_ips:
            if time.time() < self.blocked_ips[client_ip]:
                logger.warning(f"Blocked IP attempted access: {client_ip}")
                return False, "IP is temporarily blocked due to rate limit violation"
            else:
                del self.blocked_ips[client_ip]

        # Check if user is blocked
        if user_id and user_id in self.blocked_users:
            if time.time() < self.blocked_users[user_id]:
                logger.warning(f"Blocked user attempted access: {user_id}")
                return False, "User is temporarily blocked due to rate limit violation"
            else:
                del self.blocked_users[user_id]

        # Get token cost for operation
        token_cost_map = {
            "pdf_upload": self.config.token_cost_pdf_upload,
            "llm_call": self.config.token_cost_llm_call,
            "api_call": self.config.token_cost_api_call,
        }
        token_cost = token_cost_map.get(operation, self.config.token_cost_api_call)

        # Check global limit
        if not self.global_bucket.consume(token_cost):
            logger.error("Global rate limit exceeded")
            return False, "Global rate limit exceeded. Service at capacity."

        # Check per-IP limit
        if client_ip not in self.ip_buckets:
            self.ip_buckets[client_ip] = TokenBucket(
                capacity=self.config.ip_tokens_per_minute,
                refill_rate=self.config.ip_tokens_per_minute / 60.0,
            )

        if not self.ip_buckets[client_ip].consume(token_cost):
            logger.warning(f"IP rate limit exceeded: {client_ip}")
            self.blocked_ips[client_ip] = time.time() + self.config.block_duration_seconds
            return False, "Rate limit exceeded for your IP address"

        # Check per-user limit
        if user_id:
            if user_id not in self.user_buckets:
                self.user_buckets[user_id] = TokenBucket(
                    capacity=self.config.user_tokens_per_minute,
                    refill_rate=self.config.user_tokens_per_minute / 60.0,
                )

            if not self.user_buckets[user_id].consume(token_cost):
                logger.warning(f"User rate limit exceeded: {user_id}")
                self.blocked_users[user_id] = time.time() + self.config.block_duration_seconds
                return False, "Rate limit exceeded for your account"

        logger.info(f"Request allowed from {client_ip} (user: {user_id or 'anonymous'})")
        return True, "Allowed"

    def get_status(self, client_ip: str, user_id: Optional[str] = None) -> dict:
        """Get current rate limit status for a client"""
        return {
            "global_available_tokens": self.global_bucket.get_available(),
            "global_capacity": self.config.global_tokens_per_minute,
            "ip_available_tokens": self.ip_buckets[client_ip].get_available()
            if client_ip in self.ip_buckets
            else self.config.ip_tokens_per_minute,
            "ip_capacity": self.config.ip_tokens_per_minute,
            "user_available_tokens": self.user_buckets[user_id].get_available()
            if user_id and user_id in self.user_buckets
            else self.config.user_tokens_per_minute,
            "user_capacity": self.config.user_tokens_per_minute,
            "ip_blocked": client_ip in self.blocked_ips,
            "user_blocked": user_id and user_id in self.blocked_users,
        }

    def reset_for_testing(self) -> None:
        """Reset all limits (for testing only)"""
        self.global_bucket.tokens = float(self.global_bucket.capacity)
        self.ip_buckets.clear()
        self.user_buckets.clear()
        self.blocked_ips.clear()
        self.blocked_users.clear()
        logger.info("Rate limiter reset for testing")
