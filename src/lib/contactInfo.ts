/** Phone numbers, emails and web links stay out of messages until the bid is accepted. */
export function hasContactInfo(text: string): boolean {
  const t = text.toLowerCase();
  if (/[a-z0-9._%+-]+\s*(@|\(at\)|\[at\])\s*[a-z0-9.-]+\s*(\.|\(dot\)|\[dot\])\s*[a-z]{2,}/i.test(t)) return true;
  if (/(https?:\/\/|www\.)\S+/i.test(t) || /\b[a-z0-9-]+\.(com|net|org|io|co|us|biz)\b/i.test(t)) return true;
  return /(\d[\s().-]*){7,}/.test(text);
}
