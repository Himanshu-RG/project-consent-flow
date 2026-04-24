"""
Redaction utility module.
Processes a single image with face annotations based on consent status:
  - Consented (granted): green bounding box + name label
  - Not consented (pending/denied): Gaussian blur on face + red bounding box + "REDACTED" label

Returns raw JPEG bytes — no files are written to disk.
"""

import cv2
import numpy as np
from typing import List, Dict, Any


# ─── Typography / drawing constants ─────────────────────────────────────────

FONT            = cv2.FONT_HERSHEY_SIMPLEX
FONT_SCALE      = 0.65
FONT_THICKNESS  = 2
LABEL_PAD       = 6          # pixels of padding inside label background

COLOR_GREEN     = (34, 197, 94)    # BGR  — tailwind green-500
COLOR_RED       = (60, 60, 220)    # BGR  — tailwind red-500
COLOR_BLACK     = (0, 0, 0)
COLOR_WHITE     = (255, 255, 255)

BOX_THICKNESS   = 2
BLUR_KERNEL     = (83, 83)         # must be odd; larger = heavier blur
BLUR_SIGMA      = 50


# ─── Core rendering ─────────────────────────────────────────────────────────

def _draw_label(img: np.ndarray, text: str, x: int, y: int, color: tuple) -> None:
    """Draw a filled colour pill above the bounding box with white text."""
    (text_w, text_h), baseline = cv2.getTextSize(text, FONT, FONT_SCALE, FONT_THICKNESS)
    # Background rectangle
    bg_x1 = x
    bg_y1 = max(y - text_h - LABEL_PAD * 2, 0)
    bg_x2 = x + text_w + LABEL_PAD * 2
    bg_y2 = y
    cv2.rectangle(img, (bg_x1, bg_y1), (bg_x2, bg_y2), color, -1)
    # White text on top
    cv2.putText(
        img,
        text,
        (bg_x1 + LABEL_PAD, bg_y2 - LABEL_PAD // 2),
        FONT, FONT_SCALE,
        COLOR_WHITE,
        FONT_THICKNESS,
        cv2.LINE_AA
    )


def blur_entire_image(image_path: str) -> bytes:
    """
    Apply a heavy Gaussian blur to the entire image.
    Used when no face data is available (image not yet processed by ML).

    Returns:
        JPEG bytes of the fully-blurred image.
    """
    img = cv2.imread(image_path)
    if img is None:
        raise FileNotFoundError(f"Cannot read image: {image_path}")

    blurred = cv2.GaussianBlur(img, BLUR_KERNEL, BLUR_SIGMA)

    # Draw a centred label so the user knows the image is unprocessed
    h, w = blurred.shape[:2]
    text   = "NOT PROCESSED"
    (tw, th), _ = cv2.getTextSize(text, FONT, 0.9, 2)
    cx = (w - tw) // 2
    cy = h // 2
    # semi-transparent dark pill background
    pad = 10
    cv2.rectangle(blurred, (cx - pad, cy - th - pad), (cx + tw + pad, cy + pad),
                  (30, 30, 30), -1)
    cv2.putText(blurred, text, (cx, cy), FONT, 0.9, COLOR_WHITE, 2, cv2.LINE_AA)

    success, buffer = cv2.imencode(".jpg", blurred, [cv2.IMWRITE_JPEG_QUALITY, 88])
    if not success:
        raise RuntimeError("Failed to encode blurred image as JPEG")
    return buffer.tobytes()


def redact_image(image_path: str, faces: List[Dict[str, Any]]) -> bytes:
    """
    Apply consent-aware annotations to an image.

    Args:
        image_path: Absolute path to the source image file.
        faces: List of dicts:
            {
              "name":      str,          # person display name
              "bbox":      {x, y, width, height},
              "consented": bool          # True → green box, False → blur + red box
            }

    Returns:
        JPEG bytes of the annotated image (no file is written).
    """
    img = cv2.imread(image_path)
    if img is None:
        raise FileNotFoundError(f"Cannot read image: {image_path}")

    h_img, w_img = img.shape[:2]

    for face in faces:
        bbox = face.get("bbox")
        if not bbox:
            continue

        x  = max(int(bbox.get("x",      0)), 0)
        y  = max(int(bbox.get("y",      0)), 0)
        bw = int(bbox.get("width",      0))
        bh = int(bbox.get("height",     0))

        # Clamp to image boundaries
        x2 = min(x + bw, w_img)
        y2 = min(y + bh, h_img)

        if x2 <= x or y2 <= y:
            continue  # degenerate box

        consented = face.get("consented", False)
        name      = face.get("name", "Unknown")

        if consented:
            # ── Green box + name label ──────────────────────────────────────
            cv2.rectangle(img, (x, y), (x2, y2), COLOR_GREEN, BOX_THICKNESS)
            _draw_label(img, name, x, y, COLOR_GREEN)
        else:
            # ── Gaussian blur the face ROI ──────────────────────────────────
            roi = img[y:y2, x:x2]
            blurred = cv2.GaussianBlur(roi, BLUR_KERNEL, BLUR_SIGMA)
            img[y:y2, x:x2] = blurred

            # ── Red box + "REDACTED" label ──────────────────────────────────
            cv2.rectangle(img, (x, y), (x2, y2), COLOR_RED, BOX_THICKNESS)
            _draw_label(img, "REDACTED", x, y, COLOR_RED)

    # Encode as JPEG in memory — no disk write
    success, buffer = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 92])
    if not success:
        raise RuntimeError("Failed to encode redacted image as JPEG")

    return buffer.tobytes()
