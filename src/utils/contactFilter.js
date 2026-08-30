const CONTACT_PATTERNS = [
  /(?:\+?\d[\s().-]?){7,}/i,
  /[\w.+-]+@[\w-]+\.[\w.-]+/i,
  /(?:https?:\/\/|www\.|facebook\.com|instagram\.com|wa\.me|t\.me|linkedin\.com)/i,
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
