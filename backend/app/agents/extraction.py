"""Agent A: raw email (+ attachment text) -> ExtractionResult."""

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

SYSTEM = """You are an information-extraction agent for a compliance team.
Read one email (headers may be missing; infer them from the content when possible)
and return ONLY a JSON object with exactly this shape:

{
  "sender": "email address or name of the sender, '' if unknown",
  "recipients": ["email addresses or names"],
  "date": "ISO-8601 date-time if known, else null",
  "subject": "subject line, or a short inferred title if missing",
  "summary": "1-2 neutral sentences: who wants what from whom",
  "key_facts": [
    {"type": "amount|date|account|reference|url|attachment|other",
     "value": "the exact value as written",
     "context": "a few words on what it refers to"}
  ],
  "attachments": [{"filename": "name", "summary": "one sentence on its content"}]
}

Rules:
- Extract facts verbatim; never invent values that are not in the text.
- Include every monetary amount, deadline, account/routing number, invoice or reference id and URL.
- Facts found inside attachments go in key_facts too (mention the attachment in "context").
- Do not judge risk here; just extract.
- Output JSON only, no prose, no markdown fences."""


def build_messages(raw_content: str, repair: tuple[str, str] | None = None) -> list[BaseMessage]:
    """`repair` = (previous_output, validation_error) for the one repair retry."""
    messages: list[BaseMessage] = [
        SystemMessage(SYSTEM),
        HumanMessage(f"EMAIL:\n<<<\n{raw_content}\n>>>"),
    ]
    if repair:
        previous, error = repair
        messages += [
            AIMessage(previous[:4000]),
            HumanMessage(
                "That output was rejected by the validator:\n"
                f"{error}\n\nReturn the corrected JSON object only, matching the schema exactly."
            ),
        ]
    return messages
