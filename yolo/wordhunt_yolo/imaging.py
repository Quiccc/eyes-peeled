"""Turning uploaded or stored photos into upright RGB images for the model."""

import io
from pathlib import Path

from PIL import Image, ImageOps


class ImageTooLarge(ValueError):
    pass


class NotAnImage(ValueError):
    pass


def upright_rgb(img: Image.Image) -> Image.Image:
    """Apply the EXIF rotation (phones store portrait shots sideways) and drop alpha/palette."""
    return ImageOps.exif_transpose(img).convert("RGB")


def decode_image(data: bytes, max_bytes: int) -> Image.Image:
    """An uploaded photo. Raises ImageTooLarge or NotAnImage."""
    if len(data) > max_bytes:
        raise ImageTooLarge(f"image larger than {max_bytes} bytes")
    try:
        return upright_rgb(Image.open(io.BytesIO(data)))
    except Exception as e:  # PIL raises many types for corrupt or unknown files
        raise NotAnImage(str(e)) from e


def open_image(path: Path) -> Image.Image:
    """A photo from disk (word test)."""
    return upright_rgb(Image.open(path))
