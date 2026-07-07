import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { CustomerContactChannels, copyHintText } from './CustomerContactChannels'

describe('CustomerContactChannels', () => {
  it('renders contact channels with open and copy actions', () => {
    const html = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(CustomerContactChannels, {
          phone: '012-3456789',
          email: 'clinic@example.com',
        }),
      ),
    )

    expect(html).toContain('Contact channels')
    expect(html).toContain('WhatsApp')
    expect(html).toContain('Email')
    expect(html).toContain('Copy phone')
    expect(html).toContain('Copy email')
    expect(html).toContain('Open WhatsApp')
    expect(html).toContain('Email clinic')
  })

  it('keeps copied feedback short and specific to the copied channel', () => {
    expect(copyHintText('phone', 'phone', 'Phone')).toBe('Copied')
    expect(copyHintText('email', 'phone', 'Phone')).toBe('Copy phone')
    expect(copyHintText(null, 'email', 'Email')).toBe('Copy email')
  })
})
