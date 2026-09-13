// Sensitive data patterns — phone numbers, emails, social handles, payment wallets
const CONTACT_PATTERNS = [
  // Phone numbers — local BD (01x), international (+880, +1 etc), spaced/dashed/dotted digits
  /(?:\+?88)?01[3-9]\d[\s\-.]?\d{3}[\s\-.]?\d{4}/i,
  /(?:\+?\d[\s().\-]?){9,}/,
  // Email addresses
  /[\w.+\-]+@[\w\-]+\.[\w.\-]{2,}/i,
  // URLs and social links
  /(?:https?:\/\/|www\.)/i,
  /(?:facebook\.com|fb\.com|instagram\.com|linkedin\.com|twitter\.com|tiktok\.com|youtube\.com)/i,
  // Messaging app handles and links
  /(?:wa\.me|t\.me|telegram\.me|whatsapp)/i,
  // @username handles (Telegram/Instagram/Twitter style)
  /@[\w]{3,}/,
  // Mobile wallet patterns (bKash, Nagad, Rocket) — number sequences with wallet keywords
  /(?:bkash|nagad|rocket|upay|wallet)\s*(?:number|no|:)?\s*[\d\s\-]+/i,
  // Bank account / IBAN-style patterns
  /(?:account|acc|iban)\s*(?:no|number|:)?\s*[\dA-Z\s\-]{8,}/i,
  // Credit/debit card patterns (16 digits grouped)
  /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/,
];

export function containsContactInfo(value) {
  return CONTACT_PATTERNS.some((pattern) => pattern.test(String(value || "")));
}

export function maskContactInfo(value) {
  let result = String(value || "");
  for (const pattern of CONTACT_PATTERNS)
    result = result.replace(pattern, "[contact details removed]");
  return result;
}

export function rejectContactInfo(request, response, next) {
  if (containsContactInfo(request.body?.body || request.body?.message))
    return response
      .status(422)
      .json({ error: "Contact details cannot be shared in marketplace chat" });
  next();
}
