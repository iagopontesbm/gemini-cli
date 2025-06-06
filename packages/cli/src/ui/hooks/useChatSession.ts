/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import { ChatSession, ChatEvent, Config } from '@gemini-code/core';

export function useChatSession(config: Config) {
  const [events, setEvents] = useState<ChatEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(
    async (prompt: string) => {
      setLoading(true);
      const session = new ChatSession(config);
      const newEvents: ChatEvent[] = [];
      try {
        for await (const event of session.sendMessage(prompt)) {
          newEvents.push(event);
          setEvents([...events, ...newEvents]);
        }
      } catch (e) {
        // TODO: Handle error
      } finally {
        setLoading(false);
      }
    },
    [config, events]
  );

  return { events, loading, sendMessage };
}