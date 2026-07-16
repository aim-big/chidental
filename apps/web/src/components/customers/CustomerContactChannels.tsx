'use client'

import * as React from 'react'
import { Check, Copy, ExternalLink, Mail, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { whatsAppLink } from '@/lib/phone'

type ContactChannelId = 'phone' | 'email'

type ContactChannel = {
  id: ContactChannelId
  label: string
  value: string
  href: string | null
  actionLabel: string
  Icon: React.ComponentType<{ className?: string }>
}

export function copyHintText(
  copiedChannel: ContactChannelId | null,
  channelId: ContactChannelId,
  label: string,
): string {
  return copiedChannel === channelId ? 'Copied' : `Copy ${label.toLowerCase()}`
}

async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    return document.execCommand('copy')
  } finally {
    textarea.remove()
  }
}

export function CustomerContactChannels({
  phone,
  email,
}: {
  phone: string | null
  email: string | null
}) {
  const [copiedChannel, setCopiedChannel] = React.useState<ContactChannelId | null>(null)
  const resetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    }
  }, [])

  const channels = React.useMemo(() => {
    const rows: ContactChannel[] = []

    if (phone) {
      rows.push({
        id: 'phone',
        label: 'WhatsApp',
        value: phone,
        href: whatsAppLink(phone),
        actionLabel: 'Open WhatsApp',
        Icon: MessageCircle,
      })
    }

    if (email) {
      rows.push({
        id: 'email',
        label: 'Email',
        value: email,
        href: `mailto:${email}`,
        actionLabel: 'Email clinic',
        Icon: Mail,
      })
    }

    return rows
  }, [email, phone])

  if (channels.length === 0) return null

  const handleCopy = async (channel: ContactChannel) => {
    let copied = false
    try {
      copied = await copyText(channel.value)
    } catch {
      copied = false
    }
    if (!copied) return

    setCopiedChannel(channel.id)
    if (resetTimer.current) clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => setCopiedChannel(null), 1600)
  }

  return (
    <section aria-label="Contact channels" className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Contact channels</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {channels.map((channel) => {
          const isCopied = copiedChannel === channel.id
          const channelName = channel.id === 'phone' ? 'Phone' : 'Email'
          const defaultCopyLabel = copyHintText(null, channel.id, channelName)
          const copyLabel = copyHintText(copiedChannel, channel.id, channelName)

          return (
            <div
              key={channel.id}
              className="flex min-w-0 items-center gap-3 rounded-md border border-border bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/35"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-card text-muted-foreground ring-1 ring-border">
                <channel.Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">{channel.label}</p>
                {channel.href ? (
                  <a
                    href={channel.href}
                    target={channel.id === 'phone' ? '_blank' : undefined}
                    rel={channel.id === 'phone' ? 'noopener noreferrer' : undefined}
                    className="block truncate text-sm font-medium text-primary hover:underline"
                  >
                    {channel.value}
                  </a>
                ) : (
                  <p className="truncate text-sm font-medium text-foreground">{channel.value}</p>
                )}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <span
                  aria-live="polite"
                  className={cn(
                    'w-12 text-right text-xs font-medium transition-opacity',
                    isCopied ? 'text-emerald-700 opacity-100 dark:text-emerald-300' : 'opacity-0',
                  )}
                >
                  {isCopied ? 'Copied' : ''}
                </span>
                {channel.href && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <a
                          href={channel.href}
                          target={channel.id === 'phone' ? '_blank' : undefined}
                          rel={channel.id === 'phone' ? 'noopener noreferrer' : undefined}
                          aria-label={channel.actionLabel}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{channel.actionLabel}</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant={isCopied ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-8 w-8"
                      aria-label={defaultCopyLabel}
                      onClick={() => void handleCopy(channel)}
                    >
                      {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{copyLabel}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
