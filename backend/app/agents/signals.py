"""Deterministic risk signals: cheap, explainable, and model-independent.

They serve three purposes:
1. Hints for Agent B (the LLM is told what code already found, with evidence).
2. A safety floor: a strong signal can raise an LLM verdict of none/low (see merge_risk).
3. The core of the rule-based fallback when no LLM is reachable.

`HistoryContext` adds the one thing a per-email agent cannot see on its own: what
earlier mail from the same sender looked like (e.g. the account on file for a vendor).
"""

import re
import statistics
from dataclasses import asdict, dataclass, field

PERSONAL_DOMAINS = {
    "gmail.com",
    "googlemail.com",
    "fastmail.com",
    "protonmail.com",
    "proton.me",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "icloud.com",
    "aol.com",
    "gmx.com",
    "mail.com",
}

AMOUNT_RE = re.compile(r"\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:[KkMm]\b|million|thousand))?", re.IGNORECASE)
ACCOUNT_RE = re.compile(r"account\s+(?:ending(?:\s+in)?|no\.?|number|#)\s*:?\s*(\d{3,})", re.IGNORECASE)
ROUTING_RE = re.compile(r"routing\s*(?:number|no\.?|#)?\s*:?\s*(\d{9})\b", re.IGNORECASE)
REFERENCE_RE = re.compile(r"\b[A-Z]{2,5}-\d{3,}\b")
URL_RE = re.compile(r"\b(?:https?|hxxps?)://[^\s<>\"')]+", re.IGNORECASE)
EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b")
DATE_RE = re.compile(
    r"\b(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:\s*-\s*\d{1,2})?"
    r"|(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day(?:\s+(?:morning|afternoon|evening))?"
    r"|within\s+\d+\s+(?:hours|days)|in\s+\d+\s+(?:hours|days)|before\s+\d{1,2}\s?(?:am|pm)"
    r"|next\s+week|today)\b",
    re.IGNORECASE,
)

# (tag, weight, phrases). Weight is per category, not per match: one strong phrase is enough.
KEYWORD_RULES: list[tuple[str, int, tuple[str, ...]]] = [
    (
        "threat-language",
        6,
        (
            "i know where your office",
            "i know where you live",
            "i know people",
            "you'll regret",
            "you will regret",
            "won't like how",
            "this isn't over",
            "watch your back",
        ),
    ),
    (
        "mnpi-risk",
        4,
        (
            "pick up some shares",
            "buy some shares",
            "before the market",
            "deal is basically done",
            "announcement is",
            "before it's announced",
            "insider",
        ),
    ),
    (
        "data-exfiltration",
        3,
        (
            "taking copies",
            "before i officially resign",
            "before i resign",
            "forwarding these before",
            "copy of the client list",
        ),
    ),
    (
        "credential-phishing",
        3,
        (
            "verify your identity",
            "reset your password",
            "account suspension",
            "password will expire",
            "password expires",
            "confirm your credentials",
        ),
    ),
    (
        "payment-change",
        3,
        (
            "changed banking",
            "new account details",
            "updated payment details",
            "new payment account",
            "update your records",
            "rather than the account on file",
        ),
    ),
    (
        "accounting-irregularity",
        3,
        (
            "cost center",
            "cost centre",
            "before the board review",
            "no clear business reason",
            "backdate",
            "back-date",
            "restate",
            "off the books",
        ),
    ),
    (
        "secrecy",
        2,
        (
            "don't loop in",
            "do not loop in",
            "delete this",
            "keep this between",
            "don't tell",
            "do not tell",
            "don't reply to this from your work",
            "treat this as confidential",
            "not to mention this to",
            "keep this quiet",
        ),
    ),
    ("gift-card-request", 3, ("gift card", "gift cards", "scratch the codes")),
    ("wire-request", 2, ("wire ", "wire transfer", "transfer funds", "escrow")),
    (
        "urgency",
        1,
        (
            "urgent",
            "immediately",
            "asap",
            "cannot wait",
            "can't wait",
            "before noon",
            "before 12pm",
            "within 24 hours",
            "in 24 hours",
            "time-sensitive",
            "right away",
        ),
    ),
    ("whistleblower-report", 1, ("don't want to give my name", "i have screenshots", "anonymous")),
]


@dataclass
class Signal:
    tag: str
    weight: int
    evidence: str


@dataclass
class HistoryContext:
    """Facts mined from earlier emails by the same sender domain (raw text, so order-independent)."""

    sender_domain: str = ""
    prior_email_ids: list[str] = field(default_factory=list)
    known_accounts: list[str] = field(default_factory=list)
    known_routing: list[str] = field(default_factory=list)
    prior_amounts: list[float] = field(default_factory=list)

    def is_empty(self) -> bool:
        return not self.prior_email_ids

    def to_prompt(self) -> dict[str, object]:
        return asdict(self)


# ----------------------------------------------------------------- helpers


def domain_of(address: str) -> str:
    return address.rsplit("@", 1)[-1].strip().lower().rstrip(">") if "@" in address else ""


def registered_domain(host: str) -> str:
    parts = host.lower().split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else host.lower()


def levenshtein(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def is_lookalike(host: str, org_domain: str) -> bool:
    """True for a domain that imitates the org's (arclne-corp.com, arclline-portal.com), not the org itself."""
    host = registered_domain(host)
    if not host or host == org_domain:
        return False
    org_label = org_domain.split(".")[0]
    tokens = re.split(r"[-_.]", host.split(".")[0])
    return any(levenshtein(tok, org_label) <= 2 for tok in tokens if len(tok) >= 4)


def parse_amount(text: str) -> float | None:
    m = re.match(r"\$\s?([\d,]+(?:\.\d+)?)\s?([KkMm]|million|thousand)?", text.strip(), re.IGNORECASE)
    if not m:
        return None
    value = float(m.group(1).replace(",", ""))
    suffix = (m.group(2) or "").lower()
    return value * {"k": 1e3, "thousand": 1e3, "m": 1e6, "million": 1e6}.get(suffix, 1)


def find_amounts(text: str) -> list[str]:
    return list(dict.fromkeys(a.strip() for a in AMOUNT_RE.findall(text)))


# ----------------------------------------------------------------- history


def history_from_texts(sender_domain: str, prior: list[tuple[str, str]]) -> HistoryContext:
    """Build history from (email_id, raw_content) of earlier emails from the same sender domain."""
    ctx = HistoryContext(sender_domain=sender_domain)
    for email_id, text in prior:
        ctx.prior_email_ids.append(email_id)
        for acct in ACCOUNT_RE.findall(text):
            if acct not in ctx.known_accounts:
                ctx.known_accounts.append(acct)
        for routing in ROUTING_RE.findall(text):
            if routing not in ctx.known_routing:
                ctx.known_routing.append(routing)
        ctx.prior_amounts.extend(a for a in map(parse_amount, find_amounts(text)) if a)
    return ctx


# ----------------------------------------------------------------- detection


def detect(
    text: str, sender: str, recipients: list[str], org_domain: str, history: HistoryContext | None = None
) -> list[Signal]:
    lowered = text.lower()
    signals: list[Signal] = []

    sender_host = domain_of(sender)
    if sender_host and is_lookalike(sender_host, org_domain):
        signals.append(Signal("spoofed-domain", 4, f"sender domain '{sender_host}' imitates '{org_domain}'"))

    for url in URL_RE.findall(text):
        host = re.sub(r"^[a-z]+://", "", url.lower()).split("/")[0]
        if is_lookalike(host, org_domain):
            signals.append(Signal("suspicious-link", 3, f"link to lookalike domain '{host}'"))
            break

    internal_sender = registered_domain(sender_host) == org_domain
    personal = [r for r in recipients if domain_of(r) in PERSONAL_DOMAINS]
    if internal_sender and personal:
        signals.append(Signal("internal-to-personal", 3, f"internal sender mailing personal address {personal[0]}"))

    for tag, weight, phrases in KEYWORD_RULES:
        hit = next((p for p in phrases if p in lowered), None)
        if hit:
            signals.append(Signal(tag, weight, f'phrase: "{hit.strip()}"'))

    if history and not history.is_empty():
        current_accounts = [a for a in ACCOUNT_RE.findall(text) if a not in history.known_accounts]
        if current_accounts and history.known_accounts:
            signals.append(
                Signal(
                    "bank-detail-change",
                    4,
                    f"account ending {current_accounts[0]} differs from account on file "
                    f"({', '.join(history.known_accounts)}) in {', '.join(history.prior_email_ids)}",
                )
            )
        amounts = [a for a in map(parse_amount, find_amounts(text)) if a]
        if amounts and history.prior_amounts:
            baseline = statistics.median(history.prior_amounts)
            if max(amounts) >= 2.5 * baseline:
                signals.append(
                    Signal(
                        "financial-anomaly",
                        2,
                        f"${max(amounts):,.0f} is {max(amounts) / baseline:.1f}x the prior median of ${baseline:,.0f}",
                    )
                )
    return signals


def score_to_level(score: int) -> str:
    if score >= 6:
        return "high"
    if score >= 3:
        return "medium"
    if score >= 1:
        return "low"
    return "none"
