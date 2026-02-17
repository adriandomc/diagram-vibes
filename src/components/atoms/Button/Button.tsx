import React from 'react';
import styles from './Button.module.scss';

export interface ButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'icon';
  disabled?: boolean;
  active?: boolean;
  className?: string;
  title?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'secondary',
  disabled = false,
  active = false,
  className = '',
  title,
}) => {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${active ? styles.active : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
};
