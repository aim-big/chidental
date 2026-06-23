'use client'

// Country-code picker + national-number field. The combined value is stored as
// an E.164-ish string (`+60123456789`) via `combineInternational`, so callers
// hold a single phone string and never deal with the two parts. Defaults to
// Malaysia; the searchable Combobox covers every country so staff can always
// find the right code.

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import {
  COUNTRIES_ORDERED,
  DEFAULT_ISO2,
  combineInternational,
  countryByIso2,
  flagEmoji,
  splitInternational,
} from '@/lib/country-codes'

const COUNTRY_OPTIONS: ComboboxOption[] = COUNTRIES_ORDERED.map(c => ({
  value: c.iso2,
  label: `${flagEmoji(c.iso2)} ${c.name}`,
  hint: `+${c.dial}`,
}))

export interface PhoneInputProps {
  /** Stored phone string, e.g. `+60123456789` (or legacy local like `012-3456789`). */
  value: string
  onChange: (value: string) => void
  id?: string
  placeholder?: string
}

export function PhoneInput({ value, onChange, id, placeholder = '12-345 6789' }: PhoneInputProps) {
  // Seed the two visible parts from the stored value once; thereafter the parts
  // are the source of truth (so typing a leading 0 isn't yanked away mid-keystroke).
  const initial = splitInternational(value)
  const [iso2, setIso2] = useState(initial.iso2)
  const [national, setNational] = useState(initial.national)

  function emit(nextIso2: string, nextNational: string) {
    onChange(combineInternational(nextIso2, nextNational))
  }

  return (
    <div className="flex gap-2">
      <Combobox
        options={COUNTRY_OPTIONS}
        value={iso2}
        onChange={next => { setIso2(next); emit(next, national) }}
        triggerLabel={dialLabel(iso2)}
        className="w-[6.5rem] shrink-0"
        menuClassName="min-w-[17rem]"
        aria-label="Country code"
        searchPlaceholder="Search country…"
        emptyText="No country found."
      />
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        placeholder={placeholder}
        value={national}
        onChange={e => { setNational(e.target.value); emit(iso2, e.target.value) }}
      />
    </div>
  )
}

/** Render the selected country compactly for the closed combobox trigger. */
export function dialLabel(iso2: string): string {
  const c = countryByIso2(iso2) ?? countryByIso2(DEFAULT_ISO2)!
  return `${flagEmoji(c.iso2)} +${c.dial}`
}
