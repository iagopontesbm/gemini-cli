/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCodeAssistContentGenerator } from './codeAssist.js';
import { AuthType } from '../core/contentGenerator.js';
import { getOauthClient, getManualOauthClient } from './oauth2.js';
import { setupUser } from './setup.js';
import { CodeAssistServer } from './server.js';

vi.mock('./oauth2.js');
vi.mock('./setup.js');
vi.mock('./server.js');

describe('createCodeAssistContentGenerator', () => {
  const mockHttpOptions = {
    headers: {
      'User-Agent': 'test-agent',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create content generator for regular Google login', async () => {
    const mockAuthClient = { mock: 'oauth-client' };
    const mockProjectId = 'test-project';
    const mockServer = { mock: 'server' };

    vi.mocked(getOauthClient).mockResolvedValue(mockAuthClient as never);
    vi.mocked(setupUser).mockResolvedValue(mockProjectId);
    vi.mocked(CodeAssistServer).mockImplementation(() => mockServer as never);

    const result = await createCodeAssistContentGenerator(
      mockHttpOptions,
      AuthType.LOGIN_WITH_GOOGLE_PERSONAL,
    );

    expect(getOauthClient).toHaveBeenCalledOnce();
    expect(getManualOauthClient).not.toHaveBeenCalled();
    expect(setupUser).toHaveBeenCalledWith(mockAuthClient);
    expect(CodeAssistServer).toHaveBeenCalledWith(
      mockAuthClient,
      mockProjectId,
      mockHttpOptions,
    );
    expect(result).toBe(mockServer);
  });

  it('should create content generator for manual Google login', async () => {
    const mockAuthClient = { mock: 'manual-oauth-client' };
    const mockProjectId = 'test-project';
    const mockServer = { mock: 'server' };

    vi.mocked(getManualOauthClient).mockResolvedValue(mockAuthClient as never);
    vi.mocked(setupUser).mockResolvedValue(mockProjectId);
    vi.mocked(CodeAssistServer).mockImplementation(() => mockServer as never);

    const result = await createCodeAssistContentGenerator(
      mockHttpOptions,
      AuthType.MANUAL_LOGIN_WITH_GOOGLE,
    );

    expect(getManualOauthClient).toHaveBeenCalledOnce();
    expect(getOauthClient).not.toHaveBeenCalled();
    expect(setupUser).toHaveBeenCalledWith(mockAuthClient);
    expect(CodeAssistServer).toHaveBeenCalledWith(
      mockAuthClient,
      mockProjectId,
      mockHttpOptions,
    );
    expect(result).toBe(mockServer);
  });

  it('should throw error for unsupported auth types', async () => {
    await expect(
      createCodeAssistContentGenerator(
        mockHttpOptions,
        'unsupported-auth-type' as AuthType,
      ),
    ).rejects.toThrow('Unsupported authType: unsupported-auth-type');

    expect(getOauthClient).not.toHaveBeenCalled();
    expect(getManualOauthClient).not.toHaveBeenCalled();
    expect(setupUser).not.toHaveBeenCalled();
    expect(CodeAssistServer).not.toHaveBeenCalled();
  });

  it('should handle errors from oauth client creation', async () => {
    const mockError = new Error('OAuth setup failed');
    vi.mocked(getManualOauthClient).mockRejectedValue(mockError);

    await expect(
      createCodeAssistContentGenerator(
        mockHttpOptions,
        AuthType.MANUAL_LOGIN_WITH_GOOGLE,
      ),
    ).rejects.toThrow('OAuth setup failed');

    expect(getManualOauthClient).toHaveBeenCalledOnce();
    expect(setupUser).not.toHaveBeenCalled();
    expect(CodeAssistServer).not.toHaveBeenCalled();
  });

  it('should handle errors from user setup', async () => {
    const mockAuthClient = { mock: 'oauth-client' };
    const mockError = new Error('User setup failed');

    vi.mocked(getOauthClient).mockResolvedValue(mockAuthClient as never);
    vi.mocked(setupUser).mockRejectedValue(mockError);

    await expect(
      createCodeAssistContentGenerator(
        mockHttpOptions,
        AuthType.LOGIN_WITH_GOOGLE_PERSONAL,
      ),
    ).rejects.toThrow('User setup failed');

    expect(getOauthClient).toHaveBeenCalledOnce();
    expect(setupUser).toHaveBeenCalledWith(mockAuthClient);
    expect(CodeAssistServer).not.toHaveBeenCalled();
  });
});