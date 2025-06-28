/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Text, Box } from 'ink';
import { Colors } from '../colors.js';

interface TableRendererProps {
  headers: string[];
  rows: string[][];
  terminalWidth: number;
}

/**
 * Custom table renderer for markdown tables
 * We implement our own instead of using ink-table due to module compatibility issues
 */
export const TableRenderer: React.FC<TableRendererProps> = ({
  headers,
  rows,
  terminalWidth,
}) => {
  // Calculate column widths
  const columnWidths = headers.map((header, index) => {
    const headerWidth = header.length;
    const maxRowWidth = Math.max(
      ...rows.map((row) => (row[index] || '').length),
    );
    return Math.max(headerWidth, maxRowWidth) + 2; // Add padding
  });

  // Ensure table fits within terminal width
  const totalWidth = columnWidths.reduce((sum, width) => sum + width + 1, 1);
  const scaleFactor =
    totalWidth > terminalWidth ? terminalWidth / totalWidth : 1;
  const adjustedWidths = columnWidths.map((width) =>
    Math.floor(width * scaleFactor),
  );

  const renderCell = (content: string, width: number, isHeader = false) => {
    const truncated =
      content.length > width - 2
        ? content.substring(0, width - 5) + '...'
        : content;
    const padded = truncated.padEnd(width - 2, ' ');

    if (isHeader) {
      return (
        <Text bold color={Colors.AccentCyan}>
          {padded}
        </Text>
      );
    }
    return <Text>{padded}</Text>;
  };

  const renderRow = (cells: string[], isHeader = false) => (
    <Box flexDirection="row">
      <Text>│ </Text>
      {cells.map((cell, index) => (
        <React.Fragment key={index}>
          {renderCell(cell, adjustedWidths[index], isHeader)}
          <Text> │ </Text>
        </React.Fragment>
      ))}
    </Box>
  );

  const renderSeparator = () => {
    const separator = adjustedWidths
      .map((width) => '─'.repeat(width - 2))
      .join('─┼─');
    return <Text>├─{separator}─┤</Text>;
  };

  const renderTopBorder = () => {
    const border = adjustedWidths.map((width) => '─'.repeat(width - 2)).join('─┬─');
    return <Text>┌─{border}─┐</Text>;
  };

  const renderBottomBorder = () => {
    const border = adjustedWidths.map((width) => '─'.repeat(width - 2)).join('─┴─');
    return <Text>└─{border}─┘</Text>;
  };

  return (
    <Box flexDirection="column" marginY={1}>
      {renderTopBorder()}
      {renderRow(headers, true)}
      {renderSeparator()}
      {rows.map((row, index) => (
        <React.Fragment key={index}>{renderRow(row)}</React.Fragment>
      ))}
      {renderBottomBorder()}
    </Box>
  );
};
