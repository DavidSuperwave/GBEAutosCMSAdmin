'use client'

import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (node: T) => {
    refs.forEach((ref) => {
      if (!ref) return
      if (typeof ref === 'function') ref(node)
      else ref.current = node
    })
  }
}

export const ChatContainerRoot = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className = '', onScroll, ...props }, ref) => {
    const rootRef = useRef<HTMLDivElement | null>(null)
    const stickyRef = useRef(true)

    useImperativeHandle(ref, () => rootRef.current as HTMLDivElement)

    useEffect(() => {
      const root = rootRef.current
      if (!root) return

      const scrollToBottom = () => {
        if (!stickyRef.current) return
        root.scrollTo({ top: root.scrollHeight, behavior: 'smooth' })
      }

      const observer = new ResizeObserver(scrollToBottom)
      observer.observe(root)
      Array.from(root.children).forEach((child) => observer.observe(child))

      const mutationObserver = new MutationObserver(() => {
        Array.from(root.children).forEach((child) => observer.observe(child))
        scrollToBottom()
      })
      mutationObserver.observe(root, { childList: true, subtree: true })
      scrollToBottom()

      return () => {
        observer.disconnect()
        mutationObserver.disconnect()
      }
    }, [children])

    return (
      <div
        {...props}
        className={`pk-chat-container ${className}`.trim()}
        onScroll={(event) => {
          const element = event.currentTarget
          stickyRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 96
          onScroll?.(event)
        }}
        ref={mergeRefs(rootRef, ref)}
      >
        {children}
      </div>
    )
  },
)
ChatContainerRoot.displayName = 'ChatContainerRoot'

export const ChatContainerContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className = '', ...props }, ref) => (
    <div {...props} className={`pk-chat-container__content ${className}`.trim()} ref={ref}>
      {children}
    </div>
  ),
)
ChatContainerContent.displayName = 'ChatContainerContent'

export const ChatContainerScrollAnchor = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div {...props} aria-hidden="true" className={`pk-chat-container__anchor ${className}`.trim()} ref={ref} />
  ),
)
ChatContainerScrollAnchor.displayName = 'ChatContainerScrollAnchor'
