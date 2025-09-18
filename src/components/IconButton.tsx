'use client';

import { ActionIcon, ActionIconProps, rem } from '@mantine/core';
import { forwardRef } from 'react';

interface IconButtonProps extends Omit<ActionIconProps, 'variant' | 'color'> {
  children: React.ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component?: any;
  href?: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
  title?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ children, component, href, target, rel, onClick, title, ...props }, ref) => {
    return (
      <ActionIcon
        ref={ref}
        component={component}
        href={href}
        target={target}
        rel={rel}
        onClick={onClick}
        title={title}
        {...props}
        variant="default"
        size="lg"
        styles={{
          root: {
            border: '1px solid #e9ecef',
            backgroundColor: '#f8f9fa',
            color: '#000',
            height: rem(36), // Match main button height
            width: rem(36),
            '&:hover': {
              backgroundColor: '#e9ecef',
              borderColor: '#dee2e6',
            },
            '&:active': {
              transform: 'translateY(1px)',
            },
          },
        }}
      >
        {children}
      </ActionIcon>
    );
  }
);

IconButton.displayName = 'IconButton';
