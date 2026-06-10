'use client'

import React, { forwardRef } from 'react'

export const Message = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { role?: 'user' | 'assistant' | 'system' }
>(({ children, className = '', role = 'assistant', ...props }, ref) => (
  <div {...props} className={`pk-message pk-message--${role} ${className}`.trim()} ref={ref}>
    {children}
  </div>
))
Message.displayName = 'Message'

export const MessageContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className = '', ...props }, ref) => (
    <div {...props} className={`pk-message__content ${className}`.trim()} ref={ref}>
      {children}
    </div>
  ),
)
MessageContent.displayName = 'MessageContent'

export const MessageActions = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className = '', ...props }, ref) => (
    <div {...props} className={`pk-message__actions ${className}`.trim()} ref={ref}>
      {children}
    </div>
  ),
)
MessageActions.displayName = 'MessageActions'

export const MessageAction = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ children, className = '', type = 'button', ...props }, ref) => (
    <button {...props} className={`pk-message__action ${className}`.trim()} ref={ref} type={type}>
      {children}
    </button>
  ),
)
MessageAction.displayName = 'MessageAction'
