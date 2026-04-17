import logging
import sys

from app.core.config import settings


def setup_logging() -> None:
    level = logging.INFO
    json_fmt = (
        '{"time":"%(asctime)s","level":"%(levelname)s",'
        '"logger":"%(name)s","msg":"%(message)s"}'
    )
    fmt = (
        "%(asctime)s %(levelname)s %(name)s %(message)s"
        if settings.ENV == "dev"
        else json_fmt
    )
    logging.basicConfig(stream=sys.stdout, level=level, format=fmt, force=True)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
