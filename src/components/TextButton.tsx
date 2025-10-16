import { Button, ButtonProps } from '@mantine/core';
import { forwardRef } from 'react';

interface TextButtonProps extends Omit<ButtonProps, 'variant' | 'color'> {
  children: React.ReactNode;
  leftSection?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  component?: any;
  href?: string;
  target?: string;
  rel?: string;
}

export const TextButton = forwardRef<HTMLButtonElement, TextButtonProps>(
  ({ children, leftSection, onClick, component, href, target, rel, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        component={component}
        href={href}
        target={target}
        rel={rel}
        onClick={onClick}
        {...props}
        variant="subtle"
        styles={{
          root: {
            border: 'none',
            background: 'none',
            boxShadow: 'none',
            padding: 0,
            minHeight: 'auto',
            transition: 'none',
          },
          label: {
            padding: 0,
            display: 'flex',
            alignItems: 'center',
          },
        }}
      >
        {leftSection && <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 4 }}>{leftSection}</span>}
        {children}
      </Button>
    );
  }
);

TextButton.displayName = 'TextButton';
