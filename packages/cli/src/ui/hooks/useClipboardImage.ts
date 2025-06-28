/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {useState, useCallback} from 'react';

export function useClipboardImage() {
  const [imageData, setImageData] = useState<string | null>(null);

  const copyImageToClipboard = useCallback(async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = () => {
        setImageData(reader.result as string);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Failed to copy image to clipboard:', error);
    }
  }, []);

  return {imageData, copyImageToClipboard};
} 