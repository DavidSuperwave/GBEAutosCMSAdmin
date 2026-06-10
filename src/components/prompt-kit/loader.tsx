'use client'

import React from 'react'

export type LoaderProps = {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  text?: string
  variant?:
    | 'circular'
    | 'classic'
    | 'pulse'
    | 'pulse-dot'
    | 'dots'
    | 'typing'
    | 'wave'
    | 'bars'
    | 'terminal'
    | 'text-blink'
    | 'text-shimmer'
    | 'loading-dots'
}

export function Loader({ className = '', size = 'md', text = 'Thinking', variant = 'circular' }: LoaderProps) {
  const textVariants = new Set(['text-blink', 'text-shimmer', 'loading-dots', 'terminal'])
  return (
    <span className={`pk-loader pk-loader--${variant} pk-loader--${size} ${className}`.trim()} role="status">
      {textVariants.has(variant) ? (
        <span className="pk-loader__text">{text}</span>
      ) : (
        <>
          <span />
          <span />
          <span />
          {variant === 'bars' || variant === 'wave' ? <span /> : null}
        </>
      )}
    </span>
  )
}
