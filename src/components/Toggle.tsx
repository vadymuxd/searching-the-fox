"use client";

import { Switch as MantineSwitch, SwitchProps as MantineSwitchProps } from "@mantine/core";

export type ToggleProps = MantineSwitchProps;

export function Toggle(props: ToggleProps) {
  return (
    <MantineSwitch
      {...props}
      styles={{
        root: { cursor: "pointer" },
        track: { cursor: "pointer" },
        thumb: { cursor: "pointer" },
        ...(props.styles || {}),
      }}
    />
  );
}
