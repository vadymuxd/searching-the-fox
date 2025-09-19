'use client';

import { Select, rem } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';

export type SortOption = 
  | 'posted-recent'
  | 'posted-old'
  | 'company-asc'
  | 'company-desc'
  | 'title-asc'
  | 'title-desc';

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const SORT_OPTIONS = [
  { value: 'posted-recent', label: 'Posted recently' },
  { value: 'posted-old', label: 'Posted later' },
  { value: 'company-asc', label: 'Company Name Asc' },
  { value: 'company-desc', label: 'Company Name Desc' },
  { value: 'title-asc', label: 'Title Asc' },
  { value: 'title-desc', label: 'Title Desc' },
] as const;

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  const handleChange = (newValue: string | null) => {
    if (newValue && newValue !== value) {
      onChange(newValue as SortOption);
    }
  };

  const currentLabel = SORT_OPTIONS.find(option => option.value === value)?.label || 'Posted recently';

  return (
    <Select
      label="Sorted By:"
      placeholder="Select sorting"
      data={SORT_OPTIONS.map(option => ({ value: option.value, label: option.label }))}
      value={value}
      onChange={handleChange}
      rightSection={<IconChevronDown style={{ width: rem(16), height: rem(16) }} />}
      styles={{
        input: {
          fontSize: rem(14),
          fontWeight: 500,
        },
        label: {
          fontSize: rem(14),
          fontWeight: 600,
          marginBottom: rem(4),
        },
      }}
      size="sm"
      w={200}
      allowDeselect={false}
    />
  );
}
