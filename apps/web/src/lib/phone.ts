/** Default country calling code, used when a phone number has no explicit one. */
const DEFAULT_COUNTRY_CODE = '60' // Malaysia

/**
 * Normalize a stored phone number into a wa.me-ready international number
 * (digits only, no leading `+` or `0`).
 *
 * Rules, in order:
 * - An explicit `+` prefix is trusted as a full international number.
 * - A number already starting with the default country code is kept as-is.
 * - A local number with a leading `0` has the `0` swapped for the country code.
 * - Anything else is assumed to be a local number and gets the country code prepended.
 *
 * Returns `null` when there are no digits to work with.
 */
export function toWhatsAppNumber(
  phone: string | null | undefined,
  countryCode: string = DEFAULT_COUNTRY_CODE,
): string | null {
  if (!phone) return null

  const hasPlus = phone.trim().startsWith('+')
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null

  if (hasPlus) return digits
  if (digits.startsWith(countryCode)) return digits
  if (digits.startsWith('0')) return countryCode + digits.slice(1)
  return countryCode + digits
}

/** Build a click-to-chat wa.me URL, or `null` when the number is unusable. */
export function whatsAppLink(
  phone: string | null | undefined,
  countryCode?: string,
): string | null {
  const number = toWhatsAppNumber(phone, countryCode)
  return number ? `https://wa.me/${number}` : null
}
