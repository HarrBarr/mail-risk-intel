"""Turn every supported input (seed JSON, pasted text, .txt, .pdf, .eml) into one RawEmail.

Parsers only do *mechanical* extraction (headers, MIME parts, PDF text). Anything
they cannot find is left blank for Agent A to infer from the content, which is
what makes pasted text and seed data flow through the same pipeline.
"""

import io
import re
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from email import policy
from email.message import EmailMessage
from email.parser import BytesParser
from email.utils import getaddresses, parsedate_to_datetime
from typing import Any

from pypdf import PdfReader
from pypdf.errors import PdfReadError


class IngestionError(ValueError):
    """Input we refuse to ingest. The message is safe to show to the user."""


@dataclass
class RawEmail:
    source: str
    body: str
    sender: str = ""
    recipients: list[str] = field(default_factory=list)
    subject: str = ""
    date: datetime | None = None
    attachments: list[dict[str, str]] = field(default_factory=list)  # {filename, extracted_text}
    id: str = field(default_factory=lambda: f"M-{uuid.uuid4().hex[:10]}")

    @property
    def raw_content(self) -> str:
        """Canonical RFC-822-ish rendering: what Agent A reads and the UI shows as 'original'."""
        lines = [
            f"From: {self.sender}" if self.sender else None,
            f"To: {', '.join(self.recipients)}" if self.recipients else None,
            f"Date: {self.date.isoformat()}" if self.date else None,
            f"Subject: {self.subject}" if self.subject else None,
        ]
        header = "\n".join(line for line in lines if line)
        parts = [header, self.body.strip()] if header else [self.body.strip()]
        for att in self.attachments:
            parts.append(f"--- Attachment: {att['filename']} ---\n{att['extracted_text'].strip()}")
        return "\n\n".join(p for p in parts if p)


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        try:
            dt = parsedate_to_datetime(value.strip())
        except (TypeError, ValueError, IndexError):
            return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _addresses(value: str | list[str] | None) -> list[str]:
    if not value:
        return []
    values = value if isinstance(value, list) else [value]
    return [addr for _name, addr in getaddresses(values) if addr]


def _require_text(text: str, what: str) -> str:
    if not text or not text.strip():
        raise IngestionError(f"{what} contains no readable text.")
    return text


# ----------------------------------------------------------------- seed


def from_seed(item: dict[str, Any]) -> RawEmail:
    return RawEmail(
        id=str(item["id"]),
        source="seed",
        sender=item.get("from", ""),
        recipients=list(item.get("to", [])),
        subject=item.get("subject", ""),
        date=_parse_date(item.get("date")),
        body=item.get("body", ""),
        attachments=[
            {"filename": a.get("filename", "attachment"), "extracted_text": a.get("extracted_text", "")}
            for a in item.get("attachments", [])
        ],
    )


# ----------------------------------------------------------------- pasted text / .txt

_HEADER_RE = re.compile(r"^(from|to|cc|date|subject|sent)\s*:\s*(.*)$", re.IGNORECASE)


def from_text(text: str, source: str = "paste") -> RawEmail:
    """Accept bare body text, or text with a leading block of From:/To:/Subject:/Date: headers."""
    _require_text(text, "The email")
    lines = text.replace("\r\n", "\n").strip().split("\n")
    headers: dict[str, str] = {}
    i = 0
    while i < len(lines) and (m := _HEADER_RE.match(lines[i].strip())):
        key = m.group(1).lower()
        headers["date" if key == "sent" else key] = m.group(2).strip()
        i += 1
    body = "\n".join(lines[i:]).strip()
    if headers and not body:
        raise IngestionError("The email has headers but no body.")
    return RawEmail(
        source=source,
        body=body or text.strip(),
        sender=next(iter(_addresses(headers.get("from"))), headers.get("from", "")),
        recipients=_addresses(headers.get("to")) + _addresses(headers.get("cc")),
        subject=headers.get("subject", ""),
        date=_parse_date(headers.get("date")),
    )


def _decode_text(data: bytes) -> str:
    for encoding in ("utf-8", "cp1252", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise IngestionError("Could not decode the text file.")


# ----------------------------------------------------------------- .pdf


def pdf_text(data: bytes, filename: str = "document.pdf") -> str:
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise IngestionError(f"{filename} is encrypted.")
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
    except IngestionError:
        raise
    except (PdfReadError, ValueError, OSError) as exc:
        raise IngestionError(f"{filename} is not a readable PDF.") from exc
    return _require_text(text, filename).strip()


def from_pdf(data: bytes, filename: str) -> RawEmail:
    """A standalone PDF is treated as a document dropped into the mailbox (e.g. a scanned letter)."""
    text = pdf_text(data, filename)
    return RawEmail(source="pdf", subject=filename, body=text)


# ----------------------------------------------------------------- .eml


def _attachment_text(part: EmailMessage) -> str | None:
    payload = part.get_payload(decode=True)
    if not isinstance(payload, bytes):
        return None
    ctype = part.get_content_type()
    name = part.get_filename() or "attachment"
    if ctype == "application/pdf" or name.lower().endswith(".pdf"):
        try:
            return pdf_text(payload, name)
        except IngestionError as exc:
            return f"[unreadable attachment: {exc}]"
    if ctype.startswith("text/"):
        return _decode_text(payload)
    return f"[binary attachment of type {ctype} not analysed]"


def from_eml(data: bytes) -> RawEmail:
    try:
        msg = BytesParser(policy=policy.default).parsebytes(data)
    except Exception as exc:  # the stdlib parser is lenient; this is belt and braces
        raise IngestionError("The .eml file could not be parsed.") from exc
    if not isinstance(msg, EmailMessage) or not (msg["from"] or msg.get_payload()):
        raise IngestionError("The .eml file has no headers or content.")

    body_part = msg.get_body(preferencelist=("plain", "html"))
    body = body_part.get_content() if body_part is not None else ""
    if body_part is not None and body_part.get_content_type() == "text/html":
        body = re.sub(r"<[^>]+>", " ", body)

    attachments = []
    for part in msg.iter_attachments():
        text = _attachment_text(part)  # type: ignore[arg-type]
        if text:
            attachments.append({"filename": part.get_filename() or "attachment", "extracted_text": text})

    if not body.strip() and not attachments:
        raise IngestionError("The .eml file has an empty body and no readable attachments.")

    return RawEmail(
        source="eml",
        sender=next(iter(_addresses(str(msg["from"] or ""))), ""),
        recipients=_addresses([str(msg["to"] or ""), str(msg["cc"] or "")]),
        subject=str(msg["subject"] or ""),
        date=_parse_date(str(msg["date"] or "")),
        body=body.strip(),
        attachments=attachments,
    )


# ----------------------------------------------------------------- dispatch

SUPPORTED_EXTENSIONS = (".txt", ".pdf", ".eml")


def from_upload(filename: str, data: bytes, max_bytes: int) -> RawEmail:
    if not data:
        raise IngestionError("The uploaded file is empty.")
    if len(data) > max_bytes:
        raise IngestionError(f"The file is larger than {max_bytes // (1024 * 1024)} MB.")
    name = (filename or "").lower()
    if name.endswith(".eml"):
        return from_eml(data)
    if name.endswith(".pdf"):
        return from_pdf(data, filename)
    if name.endswith(".txt"):
        return from_text(_decode_text(data), source="txt")
    raise IngestionError(f"Unsupported file type. Upload one of: {', '.join(SUPPORTED_EXTENSIONS)}.")
