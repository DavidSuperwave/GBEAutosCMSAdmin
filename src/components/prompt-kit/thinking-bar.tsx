'use client'

import React from 'react'

import { Loader } from './loader'

export type ThinkingBarProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  onStop?: () => void
  stopLabel?: string
  text?: string
}

export function ThinkingBar({ className = '', onClick, onStop, stopLabel = 'Detener', text = 'Pensando', ...props }: ThinkingBarProps) {
  return (
    <button
      {...props}
      className={`pk-thinking-bar ${className}`.trim()}
      onClick={onClick}
      type="button"
    >
      <Loader size="sm" text={text} variant="loading-dots" />
      <span>{text}</span>
      {onStop ? (
        <span
          className="pk-thinking-bar__stop"
          onClick={(event) => {
            event.stopPropagation()
            onStop()
          }}
        >
          {stopLabel}
        </span>
      ) : null}
    </button>
  )
}
