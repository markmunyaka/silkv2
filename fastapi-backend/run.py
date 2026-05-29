"""Entry point for FastAPI application"""

import os
import sys
import logging

# Add project root to path
sys.path.insert(0, os.path.dirname(__file__))

# Configure logging
from app.logging import LOGGING_CONFIG
import logging.config
logging.config.dictConfig(LOGGING_CONFIG)

# Import and run app
from app.main import app

if __name__ == "__main__":
    import uvicorn
    from app.config import get_settings
    
    settings = get_settings()
    
    uvicorn.run(
        app,
        host=settings.fastapi_host,
        port=settings.fastapi_port,
        log_level=settings.log_level.lower(),
        access_log=True,
        reload=settings.fastapi_debug,
    )
