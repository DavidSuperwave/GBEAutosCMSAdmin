'use client'

import React, { createContext, forwardRef, isValidElement, useContext, useRef, useState } from 'react'

type FileUploadContextValue = {
  accept?: string
  disabled?: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  multiple?: boolean
  openPicker: () => void
}

const FileUploadContext = createContext<FileUploadContextValue | null>(null)

export type FileUploadProps = React.HTMLAttributes<HTMLDivElement> & {
  accept?: string
  disabled?: boolean
  multiple?: boolean
  onFilesAdded: (files: File[]) => void
}

export const FileUpload = forwardRef<HTMLDivElement, FileUploadProps>(
  ({ accept, children, className = '', disabled = false, multiple = true, onFilesAdded, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const [dragging, setDragging] = useState(false)

    const handleFiles = (files: FileList | null) => {
      if (disabled || !files?.length) return
      onFilesAdded(Array.from(files))
      if (inputRef.current) inputRef.current.value = ''
    }

    return (
      <FileUploadContext.Provider
        value={{
          accept,
          disabled,
          inputRef,
          multiple,
          openPicker: () => {
            if (!disabled) inputRef.current?.click()
          },
        }}
      >
        <div
          {...props}
          className={`pk-file-upload ${dragging ? 'pk-file-upload--dragging' : ''} ${className}`.trim()}
          onDragLeave={(event) => {
            props.onDragLeave?.(event)
            setDragging(false)
          }}
          onDragOver={(event) => {
            props.onDragOver?.(event)
            if (disabled) return
            event.preventDefault()
            setDragging(true)
          }}
          onDrop={(event) => {
            props.onDrop?.(event)
            if (disabled) return
            event.preventDefault()
            setDragging(false)
            handleFiles(event.dataTransfer.files)
          }}
          ref={ref}
        >
          <input
            accept={accept}
            disabled={disabled}
            hidden
            multiple={multiple}
            onChange={(event) => handleFiles(event.target.files)}
            ref={inputRef}
            type="file"
          />
          {children}
        </div>
      </FileUploadContext.Provider>
    )
  },
)
FileUpload.displayName = 'FileUpload'

export const FileUploadTrigger = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ asChild = false, children, className = '', disabled, onClick, type = 'button', ...props }, ref) => {
  const context = useContext(FileUploadContext)
  const isDisabled = disabled || context?.disabled

  if (asChild && isValidElement(children)) {
    const child = children as React.ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement>>
    return React.cloneElement(child, {
      disabled: isDisabled || child.props.disabled,
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        child.props.onClick?.(event)
        onClick?.(event)
        if (!event.defaultPrevented) context?.openPicker()
      },
    })
  }

  return (
    <button
      {...props}
      className={`pk-file-upload__trigger ${className}`.trim()}
      disabled={isDisabled}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) context?.openPicker()
      }}
      ref={ref}
      type={type}
    >
      {children}
    </button>
  )
})
FileUploadTrigger.displayName = 'FileUploadTrigger'

export const FileUploadContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className = '', ...props }, ref) => (
    <div {...props} className={`pk-file-upload__content ${className}`.trim()} ref={ref}>
      {children}
    </div>
  ),
)
FileUploadContent.displayName = 'FileUploadContent'
