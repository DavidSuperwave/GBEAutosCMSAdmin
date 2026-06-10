'use client'

import React, { createContext, forwardRef, useContext, useEffect, useRef } from 'react'

type PromptInputContextValue = {
  disabled?: boolean
  isLoading?: boolean
  maxHeight: number | string
  onSubmit?: () => void
  onValueChange?: (value: string) => void
  value?: string
}

const PromptInputContext = createContext<PromptInputContextValue | null>(null)

export type PromptInputProps = Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> & {
  isLoading?: boolean
  maxHeight?: number | string
  onSubmit?: () => void
  onValueChange?: (value: string) => void
  value?: string
}

export const PromptInput = forwardRef<HTMLFormElement, PromptInputProps>(
  ({ children, className = '', isLoading = false, maxHeight = 240, onSubmit, onValueChange, value, ...props }, ref) => (
    <PromptInputContext.Provider value={{ isLoading, maxHeight, onSubmit, onValueChange, value }}>
      <form
        {...props}
        className={`pk-prompt-input ${isLoading ? 'pk-prompt-input--loading' : ''} ${className}`.trim()}
        onSubmit={(event) => {
          event.preventDefault()
          if (!isLoading) onSubmit?.()
        }}
        ref={ref}
      >
        {children}
      </form>
    </PromptInputContext.Provider>
  ),
)
PromptInput.displayName = 'PromptInput'

export type PromptInputTextareaProps = React.ComponentProps<'textarea'> & {
  disableAutosize?: boolean
}

export const PromptInputTextarea = forwardRef<HTMLTextAreaElement, PromptInputTextareaProps>(
  ({ className = '', disableAutosize = false, disabled, onChange, onKeyDown, style, value, ...props }, ref) => {
    const context = useContext(PromptInputContext)
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)
    const resolvedValue = value ?? context?.value ?? ''

    useEffect(() => {
      const node = textareaRef.current
      if (!node || disableAutosize) return
      const maxHeight = typeof context?.maxHeight === 'number' ? `${context.maxHeight}px` : context?.maxHeight || '240px'
      node.style.height = '0px'
      node.style.height = `${Math.min(node.scrollHeight, Number.parseInt(maxHeight, 10) || node.scrollHeight)}px`
      node.style.maxHeight = maxHeight
    }, [context?.maxHeight, disableAutosize, resolvedValue])

    return (
      <textarea
        {...props}
        className={`pk-prompt-input__textarea ${className}`.trim()}
        disabled={disabled || context?.isLoading}
        onChange={(event) => {
          context?.onValueChange?.(event.target.value)
          onChange?.(event)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            if (!context?.isLoading) context?.onSubmit?.()
          }
          onKeyDown?.(event)
        }}
        ref={(node) => {
          textareaRef.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        style={style}
        value={resolvedValue}
      />
    )
  },
)
PromptInputTextarea.displayName = 'PromptInputTextarea'

export const PromptInputActions = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className = '', ...props }, ref) => (
    <div {...props} className={`pk-prompt-input__actions ${className}`.trim()} ref={ref}>
      {children}
    </div>
  ),
)
PromptInputActions.displayName = 'PromptInputActions'

export const PromptInputAction = forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & {
    disabled?: boolean
    side?: 'top' | 'bottom' | 'left' | 'right'
    tooltip?: React.ReactNode
  }
>(({ children, className = '', disabled = false, side = 'top', tooltip, ...props }, ref) => (
  <span
    {...props}
    aria-disabled={disabled}
    className={`pk-prompt-input__action ${disabled ? 'pk-prompt-input__action--disabled' : ''} ${className}`.trim()}
    data-side={side}
    data-tooltip={typeof tooltip === 'string' ? tooltip : undefined}
    ref={ref}
    title={typeof tooltip === 'string' ? tooltip : undefined}
  >
    {children}
  </span>
))
PromptInputAction.displayName = 'PromptInputAction'
