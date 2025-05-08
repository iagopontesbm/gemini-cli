/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import SelectInput, {
  type ItemProps as InkSelectItemProps,
  type IndicatorProps as InkSelectIndicatorProps,
} from 'ink-select-input';
import { Colors } from '../../colors.js';

/**
 * Represents a single option for the RadioButtonSelect.
 * Requires a label for display and a value to be returned on selection.
 */
export interface RadioSelectItem<T> {
  label: string;
  value: T;
}

/**
 * Props for the RadioButtonSelect component.
 * @template T The type of the value associated with each radio item.
 */
export interface RadioButtonSelectProps<T> {
  /** An array of items to display as radio options. */
  items: Array<RadioSelectItem<T>>;

  /** The initial index selected */
  initialIndex?: number;

  /** Function called when an item is selected. Receives the `value` of the selected item. */
  onSelect: (value: T) => void;

  /** Function called when an item is highlighted. Receives the `value` of the selected item. */
  onHighlight?: (value: T) => void;

  /** Whether this select input is currently focused and should respond to input. */
  isFocused?: boolean;
}

/**
 * A specialized SelectInput component styled to look like radio buttons.
 * It uses '◉' for selected and '○' for unselected items.
 *
 * @template T The type of the value associated with each radio item.
 */
export function RadioButtonSelect<T>({
  items,
  initialIndex,
  onSelect,
  onHighlight,
  isFocused, // This prop indicates if the current RadioButtonSelect group is focused
}: RadioButtonSelectProps<T>): React.JSX.Element {
  const handleSelect = (item: RadioSelectItem<T>) => {
    onSelect(item.value);
  };
  const handleHighlight = (item: RadioSelectItem<T>) => {
    if (onHighlight) {
      onHighlight(item.value);
    }
  };

  /**
   * Custom indicator component displaying radio button style (◉/○).
   * Color changes based on whether the item is selected and if its group is focused.
   */
  function DynamicRadioIndicator({
    isSelected = false,
  }: InkSelectIndicatorProps): React.JSX.Element {
    let indicatorColor = Colors.Foreground; // Default for not selected
    if (isSelected) {
      if (isFocused) {
        // Group is focused, selected item is AccentGreen
        indicatorColor = Colors.AccentGreen;
      } else {
        // Group is NOT focused, selected item is Foreground
        indicatorColor = Colors.Foreground;
      }
    }
    return (
      <Box marginRight={1}>
        <Text color={indicatorColor}>{isSelected ? '●' : '○'}</Text>
      </Box>
    );
  }

  /**
   * Custom item component for displaying the label.
   * Color changes based on whether the item is selected and if its group is focused.
   */
  function DynamicRadioItem({
    isSelected = false,
    label,
  }: InkSelectItemProps): React.JSX.Element {
    let textColor = Colors.Foreground; // Default for not selected
    if (isSelected) {
      if (isFocused) {
        // Group is focused, selected item is AccentGreen
        textColor = Colors.AccentGreen;
      } else {
        // Group is NOT focused, selected item is Foreground
        textColor = Colors.Foreground;
      }
    }
    return <Text color={textColor}>{label}</Text>;
  }

  initialIndex = initialIndex ?? 0;
  return (
    <SelectInput
      indicatorComponent={DynamicRadioIndicator} // Use the new dynamic indicator
      itemComponent={DynamicRadioItem} // Use the new dynamic item
      items={items}
      initialIndex={initialIndex}
      onSelect={handleSelect}
      onHighlight={handleHighlight}
      isFocused={isFocused} // This prop is for ink-select-input to handle keyboard input
    />
  );
}
