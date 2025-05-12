/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GenerateContentResponse } from '@google/genai';

export function getResponseText(
  response: GenerateContentResponse,
): string | undefined {
  if (response.candidates?.[0]?.groundingMetadata?.searchEntryPoint) {
    const metadata =
      response.candidates[0].groundingMetadata.searchEntryPoint.renderedContent;
    let fullresponse =
      response.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .join('') || undefined;
    fullresponse = fullresponse + '\n\n' + metadata;
    return fullresponse;
  }
  return (
    response.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .join('') || undefined
  );
}
