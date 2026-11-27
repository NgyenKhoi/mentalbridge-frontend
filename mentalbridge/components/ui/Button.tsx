import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'icon'
}

export function Button({
  variant = 'default',
  size = 'default',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={`${styles.button} ${className}`.trim()}
      type={type}
      {...props}
    />
  )
}
