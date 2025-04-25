/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Box, Static, Text } from 'ink';
import { StreamingState, type HistoryItem } from './types.js';
import { useGeminiStream } from './hooks/useGeminiStream.js';
import { useLoadingIndicator } from './hooks/useLoadingIndicator.js';
import { useInputHistory } from './hooks/useInputHistory.js';
import { useCompletion } from './hooks/useCompletion.js';
import { useThemeCommand } from './hooks/useThemeCommand.js';
import { Header } from './components/Header.js';
import { LoadingIndicator } from './components/LoadingIndicator.js';
import { InputPrompt } from './components/InputPrompt.js';
import { SuggestionsDisplay } from './components/SuggestionsDisplay.js';
import { Footer } from './components/Footer.js';
import { ThemeDialog } from './components/ThemeDialog.js';
import { useStartupWarnings } from './hooks/useAppEffects.js';
import { shortenPath, type Config } from '@gemini-code/server';
import { Colors } from './colors.js';
import { Tips } from './components/Tips.js';
import { ConsoleOutput } from './components/ConsolePatcher.js';
import { HistoryItemDisplay } from './components/HistoryItemDisplay.js';
import { isPotentiallyAtCommand } from './utils/commandUtils.js'; // Import the new utility

interface AppProps {
  config: Config;
  cliVersion: string;
}

export const App = ({ config, cliVersion }: AppProps) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [startupWarnings, setStartupWarnings] = useState<string[]>([]);
  const { streamingState, submitQuery, initError, debugMessage } =
    useGeminiStream(setHistory, config);
  const { elapsedTime, currentLoadingPhrase } =
    useLoadingIndicator(streamingState);

  const {
    isThemeDialogOpen,
    openThemeDialog,
    handleThemeSelect,
    handleThemeHighlight,
  } = useThemeCommand();

  useStartupWarnings(setStartupWarnings);

  const handleFinalSubmit = useCallback(
    (submittedValue: string) => {
      const trimmedValue = submittedValue.trim();
      if (trimmedValue === '/theme') {
        openThemeDialog();
      } else if (trimmedValue.length > 0) {
        submitQuery(submittedValue);
      }
    },
    [openThemeDialog, submitQuery],
  );

  const userMessages = useMemo(
    () =>
      history
        .filter(
          (item): item is HistoryItem & { type: 'user'; text: string } =>
            item.type === 'user' &&
            typeof item.text === 'string' &&
            item.text.trim() !== '',
        )
        .map((item) => item.text),
    [history],
  );

  const isInputActive = streamingState === StreamingState.Idle && !initError;

  const {
    query,
    setQuery,
    handleSubmit: handleHistorySubmit,
    inputKey,
    resetHistoryNav,
    forceInputReset,
  } = useInputHistory({
    userMessages,
    onSubmit: handleFinalSubmit,
    isActive: isInputActive,
  });

  // --- Completion Hook ---
  const isCompletionActive = isInputActive && isPotentiallyAtCommand(query); // Use the utility function
  const {
    suggestions,
    activeSuggestionIndex,
    showSuggestions,
    isLoadingSuggestions,
    setActiveSuggestionIndex,
    resetCompletionState,
  } = useCompletion(query, config.getTargetDir(), isCompletionActive);

  // --- Render Logic ---

  const { staticallyRenderedHistoryItems, updatableHistoryItems } =
    getHistoryRenderSlices(history);

  return (
    <Box flexDirection="column" marginBottom={1} width="90%">
      {/*
       * The Static component is an Ink intrinsic in which there can only be 1 per application.
       * Because of this restriction we're hacking it slightly by having a 'header' item here to
       * ensure that it's statically rendered.
       *
       * Background on the Static Item: Anything in the Static component is written a single time
       * to the console. Think of it like doing a console.log and then never using ANSI codes to
       * clear that content ever again. Effectively it has a moving frame that every time new static
       * content is set it'll flush content to the terminal and move the area which it's "clearing"
       * down a notch. Without Static the area which gets erased and redrawn continuously grows.
       */}
      <Static items={['header', ...staticallyRenderedHistoryItems]}>
        {(item, index) => {
          if (item === 'header') {
            return (
              <Box flexDirection="column" key={'header-' + index}>
                <Header />
                <Tips />
              </Box>
            );
          }

          const historyItem = item as HistoryItem;
          return (
            <HistoryItemDisplay
              key={'history-' + historyItem.id}
              item={historyItem}
              onSubmit={submitQuery}
            />
          );
        }}
      </Static>

      {updatableHistoryItems.length > 0 && (
        <Box flexDirection="column" alignItems="flex-start">
          {updatableHistoryItems.map((historyItem) => (
            <HistoryItemDisplay
              key={'history-' + historyItem.id}
              item={historyItem}
              onSubmit={submitQuery}
            />
          ))}
        </Box>
      )}

      {startupWarnings.length > 0 && (
        <Box
          borderStyle="round"
          borderColor={Colors.AccentYellow}
          paddingX={1}
          marginY={1}
          flexDirection="column"
        >
          {startupWarnings.map((warning, index) => (
            <Text key={index} color={Colors.AccentYellow}>
              {warning}
            </Text>
          ))}
        </Box>
      )}

      {isThemeDialogOpen ? (
        <ThemeDialog
          onSelect={handleThemeSelect}
          onHighlight={handleThemeHighlight}
        />
      ) : (
        <>
          <LoadingIndicator
            isLoading={streamingState === StreamingState.Responding}
            currentLoadingPhrase={currentLoadingPhrase}
            elapsedTime={elapsedTime}
          />
          {isInputActive && (
            <>
              <Box marginTop={1}>
                <Text color={Colors.SubtleComment}>cwd: </Text>
                <Text color={Colors.LightBlue}>
                  {shortenPath(config.getTargetDir(), 70)}
                </Text>
              </Box>

              <InputPrompt onSubmit={handleHistorySubmit} />
            </>
          )}
        </>
      )}

      {initError && streamingState !== StreamingState.Responding && (
        <Box
          borderStyle="round"
          borderColor={Colors.AccentRed}
          paddingX={1}
          marginBottom={1}
        >
          {history.find(
            (item) => item.type === 'error' && item.text?.includes(initError),
          )?.text ? (
            <Text color={Colors.AccentRed}>
              {
                history.find(
                  (item) =>
                    item.type === 'error' && item.text?.includes(initError),
                )?.text
              }
            </Text>
          ) : (
            <>
              <Text color={Colors.AccentRed}>
                Initialization Error: {initError}
              </Text>
              <Text color={Colors.AccentRed}>
                {' '}
                Please check API key and configuration.
              </Text>
            </>
          )}
        </Box>
      )}

      {/* RESOLVED BLOCK STARTS HERE */}
      {isThemeDialogOpen ? (
        <ThemeDialog
          onSelect={handleThemeSelect}
          onHighlight={handleThemeHighlight}
        />
      ) : (
        <>
          <Box flexDirection="column">
            <HistoryDisplay history={history} onSubmit={submitQuery} />
            <LoadingIndicator
              isLoading={streamingState === StreamingState.Responding}
              currentLoadingPhrase={currentLoadingPhrase}
              elapsedTime={elapsedTime}
            />
          </Box>

          {isInputActive && (
            <>
              <Box>
                <Text color={Colors.SubtleComment}>cwd: </Text>
                <Text color={Colors.LightBlue}>
                  {shortenPath(config.getTargetDir(), /*maxLength*/ 70)}
                </Text>
              </Box>

              <InputPrompt
                key={inputKey}
                onSubmit={handleHistorySubmit}
                // Pass completion-related props
                query={query}
                setQuery={setQuery}
                suggestions={suggestions}
                activeSuggestionIndex={activeSuggestionIndex}
                setActiveSuggestionIndex={setActiveSuggestionIndex}
                showSuggestions={showSuggestions}
                resetCompletionState={resetCompletionState}
                resetHistoryNav={resetHistoryNav}
                forceInputReset={forceInputReset}
                isCompletionActive={isCompletionActive}
              />
              {/* Render SuggestionsDisplay conditionally */}
              {showSuggestions && (
                <SuggestionsDisplay
                  suggestions={suggestions}
                  activeIndex={activeSuggestionIndex}
                  isLoading={isLoadingSuggestions}
                  width={100} // TODO: Make width dynamic based on terminal/input size
                />
              )}
            </>
          )}
        </>
      )}
      {/* RESOLVED BLOCK ENDS HERE */}

      <Footer
        config={config}
        queryLength={query.length}
        debugMode={config.getDebugMode()}
        debugMessage={debugMessage}
        cliVersion={cliVersion}
      />
      <ConsoleOutput />
    </Box>
  );
};

function getHistoryRenderSlices(history: HistoryItem[]) {
  let staticallyRenderedHistoryItems: HistoryItem[] = [];
  let updatableHistoryItems: HistoryItem[] = [];
  if (
    history.length > 1 &&
    history[history.length - 2]?.type === 'tool_group'
  ) {
    // If the second-to-last item is a tool_group, it and the last item are updateable
    staticallyRenderedHistoryItems = history.slice(0, -2);
    updatableHistoryItems = history.slice(-2);
  } else {
    // Otherwise, only the last item is updateable
    staticallyRenderedHistoryItems = history.slice(0, -1);
    updatableHistoryItems = history.slice(-1);
  }
  return { staticallyRenderedHistoryItems, updatableHistoryItems };
}
