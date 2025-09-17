'use client';

import { Button, ButtonProps, rem } from '@mantine/core';
import { forwardRef } from 'react';

interface SecondaryButtonProps extends Omit<ButtonProps, 'variant' | 'color'> {
  children: React.ReactNode;
  component?: any;
  href?: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
}

export const SecondaryButton = forwardRef<HTMLButtonElement, SecondaryButtonProps>(
  ({ children, component, href, target, rel, onClick, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        component={component}
        href={href}
        target={target}
        rel={rel}
        onClick={onClick}
        {...props}
        variant="default"
        size="sm"
        styles={{
          root: {
            border: '1px solid #e9ecef',
            backgroundColor: '#f8f9fa',
            color: '#000',
            fontSize: rem(14), // Match main button label size
            fontWeight: 500,
            height: rem(36), // Match main button height
            paddingLeft: rem(12), // Match main button padding
            paddingRight: rem(12),
            '&:hover': {
              backgroundColor: '#e9ecef',
              borderColor: '#dee2e6',
            },
            '&:active': {
              transform: 'translateY(1px)',
            },
          },
          label: {
            color: '#000',
            fontSize: rem(14), // Match main button label size
          },
        }}
      >
        {children}
      </Button>
    );
  }
);

SecondaryButton.displayName = 'SecondaryButton';
