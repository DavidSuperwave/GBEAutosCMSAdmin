'use client'

import React, { forwardRef } from 'react'

export const Image = forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(
  ({ className = '', ...props }, ref) => <img {...props} className={`pk-image ${className}`.trim()} ref={ref} />,
)
Image.displayName = 'Image'
