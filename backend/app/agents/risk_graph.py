"""Agent B: ExtractionResult (+ deterministic signals + sender history) -> RiskGraphResult."""

import json
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from app.agents.schemas import RISK_ORDER, RiskAssessment, RiskGraphResult
from app.agents.signals import Signal

SYSTEM = """You are a risk-analysis and knowledge-graph agent for a corporate compliance team
(organisation domain: {org_domain}). You receive the structured extraction of ONE email,
deterministic signals already detected by code, and facts from earlier emails by the same sender.

Return ONLY a JSON object with exactly this shape:
{{
  "risk": {{
    "level": "none|low|medium|high",
    "rationale": "2-4 sentences citing the concrete evidence",
    "tags": ["kebab-case tags"]
  }},
  "entities": [
    {{"name": "canonical name", "type": "person|organization|amount|account|location|document|other",
      "attributes": {{"email": "...", "role": "...", "domain": "..."}}}}
  ],
  "relationships": [
    {{"source": "entity name", "type": "snake_case_verb", "target": "entity name", "confidence": 0.0}}
  ]
}}

Risk guidance (decide the level from the strongest pattern present):
- high, when any of these fit:
  * executive or colleague impersonation: sender domain imitates {org_domain} AND asks for money,
    credentials or secrecy;
  * payment redirection: a vendor asks to pay a NEW bank account, especially if it differs from the
    account in sender_history or the amount is unusually large;
  * credential phishing: urgent "verify / reset your password" with a link to a non-{org_domain} site;
  * data exfiltration: confidential company data sent to a personal address (gmail, fastmail, ...);
  * insider trading / MNPI: non-public deal news shared with outsiders, especially with trading hints;
  * threats of violence or intimidation.
- medium: a credible concern that needs follow-up but is not itself an attack (e.g. an anonymous
  report of accounting irregularities, unusual but explained requests).
- low: a minor anomaly. none: routine business mail (IT notices, HR calendars, normal invoices
  paid to the account on file). Do NOT inflate routine mail.
- Suggested tags: urgency, secrecy, financial-anomaly, payment-change, spoofed-domain,
  credential-phishing, data-exfiltration, mnpi-risk, threat-language, accounting-irregularity,
  whistleblower-report, harassment. Add others if needed.
- Deterministic signals were computed by code and are reliable facts; weigh them, and cite them.
  Do not use the tags spoofed-domain or suspicious-link unless a deterministic signal reports it.
- Missing sender history is NOT suspicious: most legitimate mail comes from senders with no earlier
  email in this mailbox. Only call a bank account "new" or "changed" if the email itself says so
  or sender_history lists a different account. A vendor invoice paid to the account it names, with
  no change requested, is routine (none).

Graph guidance:
- People: one entity per person; use their name when the email states it (e.g. a signature or
  "the CFO, Robert Ainsley"), else their email address. Put the address in attributes.email and
  a role in attributes.role when stated.
- Organizations: every company named in the text (e.g. "Meridian Corp"), with attributes.domain
  when known.
- Accounts: ONE entity per number: "account ending 9902" and "routing 044000037" are two entities.
- Amounts: one entity per distinct amount, written like "$47,300".
- Do NOT create entities for dates, payment terms, generic concepts or the email itself.
- Every relationship's source and target MUST exactly match an entity "name" you listed.
- Use specific verbs: employed_by, impersonates, requests_transfer_to, requests_payment_of,
  sent_email_to, owns_account, forwards_data_to, tips_off, threatens, reports_on, works_with.

Example (for a different email: a supplier asking to wire $9,800 to a new account):
{{"risk": {{"level": "high", "rationale": "The supplier asks to redirect payment to account ending 5512, but sender_history shows account ending 1180 on file; the amount is 3x the usual invoice.", "tags": ["payment-change", "financial-anomaly"]}},
 "entities": [{{"name": "ops@acme-parts.com", "type": "person", "attributes": {{"email": "ops@acme-parts.com"}}}},
              {{"name": "Acme Parts Ltd", "type": "organization", "attributes": {{"domain": "acme-parts.com"}}}},
              {{"name": "account ending 5512", "type": "account", "attributes": {{}}}},
              {{"name": "$9,800", "type": "amount", "attributes": {{}}}}],
 "relationships": [{{"source": "ops@acme-parts.com", "type": "employed_by", "target": "Acme Parts Ltd", "confidence": 0.8}},
                   {{"source": "Acme Parts Ltd", "type": "owns_account", "target": "account ending 5512", "confidence": 0.6}},
                   {{"source": "ops@acme-parts.com", "type": "requests_payment_of", "target": "$9,800", "confidence": 0.9}}]}}

- Output JSON only, no prose, no markdown fences."""


def build_messages(
    extraction: dict[str, Any],
    signals: list[Signal],
    history: dict[str, Any] | None,
    org_domain: str,
    repair: tuple[str, str] | None = None,
) -> list[BaseMessage]:
    payload = {
        "extraction": extraction,
        "deterministic_signals": [{"tag": s.tag, "evidence": s.evidence} for s in signals],
        "sender_history": history or "none on record (not suspicious in itself)",
    }
    messages: list[BaseMessage] = [
        SystemMessage(SYSTEM.format(org_domain=org_domain)),
        HumanMessage(json.dumps(payload, indent=2, default=str)),
    ]
    if repair:
        previous, error = repair
        messages += [
            AIMessage(previous[:6000]),
            HumanMessage(
                "That output was rejected by the validator:\n"
                f"{error}\n\nReturn the corrected JSON object only, matching the schema exactly."
            ),
        ]
    return messages


# Signals strong enough that an LLM verdict of none/low should not stand on its own.
FLOOR_SIGNALS = {
    "spoofed-domain",
    "suspicious-link",
    "bank-detail-change",
    "threat-language",
    "mnpi-risk",
    "data-exfiltration",
    "credential-phishing",
}


def merge_risk(result: RiskGraphResult, signals: list[Signal]) -> tuple[RiskGraphResult, bool]:
    """Apply the safety floor. Returns (result, floor_applied).

    The LLM keeps the final say on everything above 'medium'; we only stop a strong,
    code-verified signal from being waved through as none/low by a small model.
    """
    strong = [s for s in signals if s.tag in FLOOR_SIGNALS]
    risk = result.risk
    if not strong or RISK_ORDER[risk.level] >= RISK_ORDER["medium"]:
        return result, False
    evidence = "; ".join(s.evidence for s in strong)
    tags = list(dict.fromkeys([*risk.tags, *(s.tag for s in strong)]))
    result.risk = RiskAssessment(
        level="medium",
        rationale=f"{risk.rationale} [Raised from '{risk.level}' to 'medium' by deterministic checks: {evidence}.]",
        tags=tags,
    )
    return result, True
