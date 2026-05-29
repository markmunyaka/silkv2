"""Logging configuration"""

import logging
import logging.config
import json
from pathlib import Path

# Create logs directory if it doesn't exist
LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        },
        "json": {
            "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "format": "%(asctime)s %(name)s %(levelname)s %(message)s",
        },
    },
    "handlers": {
        "default": {
            "formatter": "default",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
        },
        "audit_file": {
            "formatter": "json",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": "logs/security_audit.log",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5,
        },
        "forensics": {
            "formatter": "json",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": "logs/forensics.log",
            "maxBytes": 10485760,
            "backupCount": 5,
        },
    },
    "loggers": {
        "app": {
            "level": "INFO",
            "handlers": ["default", "audit_file"],
            "propagate": False,
        },
        "forensics": {
            "level": "INFO",
            "handlers": ["forensics"],
            "propagate": False,
        },
        "uvicorn": {
            "level": "INFO",
            "handlers": ["default"],
        },
    },
}

logging.config.dictConfig(LOGGING_CONFIG)
