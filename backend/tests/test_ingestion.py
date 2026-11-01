import io
from email.message import EmailMessage

import pytest
from reportlab.pdfgen import canvas

from app.ingestion.parsers import IngestionError, from_eml, from_seed, from_text, from_upload

MAX = 5 * 1024 * 1024


def make_pdf(text: str) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    c.drawString(72, 720, text)
    c.save()
    return buf.getvalue()


def test_seed_item_keeps_headers_and_attachment_text(seed_items: list[dict]) -> None:
    raw = from_seed(seed_items[3])  # E004
    assert raw.id == "E004" and raw.sender == "billing@northgate-suppliers.com"
    assert raw.date is not None and raw.date.year == 2026
    assert "--- Attachment: invoice_NS-4471.pdf ---" in raw.raw_content
    assert "account ending 9902" in raw.raw_content


def test_pasted_text_with_headers_is_split() -> None:
    raw = from_text("From: Ann <ann@x.com>\nTo: bob@y.com, cc@z.com\nSubject: Hi\nDate: 2026-06-01\n\nPlease pay.")
    assert raw.sender == "ann@x.com"
    assert raw.recipients == ["bob@y.com", "cc@z.com"]
    assert raw.subject == "Hi" and raw.body == "Please pay."
    assert raw.date is not None and raw.date.tzinfo is not None


def test_pasted_text_without_headers_is_all_body() -> None:
    raw = from_text("just a note: wire $5,000 today")
    assert raw.sender == "" and raw.body == "just a note: wire $5,000 today"


@pytest.mark.parametrize("text", ["", "   \n\t"])
def test_empty_text_is_rejected(text: str) -> None:
    with pytest.raises(IngestionError):
        from_text(text)


def test_headers_without_body_are_rejected() -> None:
    with pytest.raises(IngestionError, match="no body"):
        from_text("From: a@b.com\nSubject: x")


def test_txt_upload_decodes_cp1252() -> None:
    raw = from_upload("note.txt", "Subject: Café\n\nPrix: 10€".encode("cp1252"), MAX)
    assert raw.source == "txt" and raw.subject == "Café"


def test_pdf_upload_extracts_text() -> None:
    raw = from_upload("letter.pdf", make_pdf("Please transfer $9,000 to account ending 1234"), MAX)
    assert raw.source == "pdf" and "account ending 1234" in raw.body


def test_unreadable_pdf_is_rejected() -> None:
    with pytest.raises(IngestionError, match="not a readable PDF"):
        from_upload("broken.pdf", b"%PDF-1.4 garbage", MAX)


def test_eml_with_pdf_attachment() -> None:
    msg = EmailMessage()
    msg["From"] = "Vendor <billing@vendor.com>"
    msg["To"] = "ap@arcline.com"
    msg["Subject"] = "Invoice"
    msg["Date"] = "Thu, 04 Jun 2026 11:20:00 +0000"
    msg.set_content("See attached.")
    msg.add_attachment(make_pdf("Amount due: $1,000"), maintype="application", subtype="pdf", filename="inv.pdf")
    raw = from_eml(msg.as_bytes())
    assert raw.sender == "billing@vendor.com" and raw.recipients == ["ap@arcline.com"]
    assert raw.attachments[0]["filename"] == "inv.pdf"
    assert "$1,000" in raw.attachments[0]["extracted_text"]


def test_html_only_eml_is_stripped_to_text() -> None:
    msg = EmailMessage()
    msg["From"] = "a@b.com"
    msg.set_content("<p>Hello <b>there</b></p>", subtype="html")
    assert "Hello" in from_eml(msg.as_bytes()).body and "<b>" not in from_eml(msg.as_bytes()).body


@pytest.mark.parametrize(
    ("name", "data", "match"),
    [
        ("x.docx", b"data", "Unsupported file type"),
        ("x.txt", b"", "empty"),
        ("x.txt", b"a" * (MAX + 1), "larger than"),
    ],
)
def test_bad_uploads_are_rejected(name: str, data: bytes, match: str) -> None:
    with pytest.raises(IngestionError, match=match):
        from_upload(name, data, MAX)
