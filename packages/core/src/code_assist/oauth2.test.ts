/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getOauthClient, getManualOauthClient } from './oauth2.js';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import http from 'http';
import open from 'open';
import crypto from 'crypto';
import * as os from 'os';

vi.mock('os', async (importOriginal) => {
  const os = await importOriginal<typeof import('os')>();
  return {
    ...os,
    homedir: vi.fn(),
  };
});

vi.mock('google-auth-library');
vi.mock('http');
vi.mock('open');
vi.mock('crypto');

describe('oauth2', () => {
  let tempHomeDir: string;

  beforeEach(() => {
    tempHomeDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gemini-cli-test-home-'),
    );
    vi.mocked(os.homedir).mockReturnValue(tempHomeDir);
  });
  afterEach(() => {
    fs.rmSync(tempHomeDir, { recursive: true, force: true });
  });

  it('should perform a web login', async () => {
    const mockAuthUrl = 'https://example.com/auth';
    const mockCode = 'test-code';
    const mockState = 'test-state';
    const mockTokens = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
    };

    const mockGenerateAuthUrl = vi.fn().mockReturnValue(mockAuthUrl);
    const mockGetToken = vi.fn().mockResolvedValue({ tokens: mockTokens });
    const mockSetCredentials = vi.fn();
    const mockOAuth2Client = {
      generateAuthUrl: mockGenerateAuthUrl,
      getToken: mockGetToken,
      setCredentials: mockSetCredentials,
      credentials: mockTokens,
    } as unknown as OAuth2Client;
    vi.mocked(OAuth2Client).mockImplementation(() => mockOAuth2Client);

    vi.spyOn(crypto, 'randomBytes').mockReturnValue(mockState as never);
    vi.mocked(open).mockImplementation(async () => ({}) as never);

    let requestCallback!: http.RequestListener<
      typeof http.IncomingMessage,
      typeof http.ServerResponse
    >;

    let serverListeningCallback: (value: unknown) => void;
    const serverListeningPromise = new Promise(
      (resolve) => (serverListeningCallback = resolve),
    );

    let capturedPort = 0;
    const mockHttpServer = {
      listen: vi.fn((port: number, callback?: () => void) => {
        capturedPort = port;
        if (callback) {
          callback();
        }
        serverListeningCallback(undefined);
      }),
      close: vi.fn((callback?: () => void) => {
        if (callback) {
          callback();
        }
      }),
      on: vi.fn(),
      address: () => ({ port: capturedPort }),
    };
    vi.mocked(http.createServer).mockImplementation((cb) => {
      requestCallback = cb as http.RequestListener<
        typeof http.IncomingMessage,
        typeof http.ServerResponse
      >;
      return mockHttpServer as unknown as http.Server;
    });

    const clientPromise = getOauthClient();

    // wait for server to start listening.
    await serverListeningPromise;

    const mockReq = {
      url: `/oauth2callback?code=${mockCode}&state=${mockState}`,
    } as http.IncomingMessage;
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as http.ServerResponse;

    await requestCallback(mockReq, mockRes);

    const client = await clientPromise;
    expect(client).toBe(mockOAuth2Client);

    expect(open).toHaveBeenCalledWith(mockAuthUrl);
    expect(mockGetToken).toHaveBeenCalledWith({
      code: mockCode,
      redirect_uri: `http://localhost:${capturedPort}/oauth2callback`,
    });
    expect(mockSetCredentials).toHaveBeenCalledWith(mockTokens);

    const tokenPath = path.join(tempHomeDir, '.gemini', 'oauth_creds.json');
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    expect(tokenData).toEqual(mockTokens);
  });

  it('should perform a manual login without opening browser', async () => {
    const mockAuthUrl = 'https://example.com/auth';
    const mockCode = 'test-code';
    const mockState = 'test-state';
    const mockTokens = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
    };

    const mockGenerateAuthUrl = vi.fn().mockReturnValue(mockAuthUrl);
    const mockGetToken = vi.fn().mockResolvedValue({ tokens: mockTokens });
    const mockSetCredentials = vi.fn();
    const mockOAuth2Client = {
      generateAuthUrl: mockGenerateAuthUrl,
      getToken: mockGetToken,
      setCredentials: mockSetCredentials,
      credentials: mockTokens,
    } as unknown as OAuth2Client;
    vi.mocked(OAuth2Client).mockImplementation(() => mockOAuth2Client);

    vi.spyOn(crypto, 'randomBytes').mockReturnValue(mockState as never);
    vi.mocked(open).mockClear(); // Clear any previous calls

    let requestCallback!: http.RequestListener<
      typeof http.IncomingMessage,
      typeof http.ServerResponse
    >;

    let serverListeningCallback: (value: unknown) => void;
    const serverListeningPromise = new Promise(
      (resolve) => (serverListeningCallback = resolve),
    );

    let capturedPort = 0;
    const mockHttpServer = {
      listen: vi.fn((port: number, callback?: () => void) => {
        capturedPort = port;
        if (callback) {
          callback();
        }
        serverListeningCallback(undefined);
      }),
      close: vi.fn((callback?: () => void) => {
        if (callback) {
          callback();
        }
      }),
      on: vi.fn(),
      address: () => ({ port: capturedPort }),
    };

    vi.mocked(http.createServer).mockImplementation((callback) => {
      requestCallback = callback as http.RequestListener;
      return mockHttpServer as never;
    });

    // Mock console.log to avoid cluttering test output
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

    const clientPromise = getManualOauthClient();

    // wait for server to start listening.
    await serverListeningPromise;

    const mockReq = {
      url: `/oauth2callback?code=${mockCode}&state=${mockState}`,
    } as http.IncomingMessage;
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as http.ServerResponse;

    await requestCallback(mockReq, mockRes);

    const client = await clientPromise;
    expect(client).toBe(mockOAuth2Client);

    // Verify that browser was NOT opened for manual login
    expect(open).not.toHaveBeenCalled();

    // Verify manual instructions were logged
    expect(consoleSpy).toHaveBeenCalledWith('\n\nCode Assist login required.');
    expect(consoleSpy).toHaveBeenCalledWith('Please complete the following steps:\n');
    expect(consoleSpy).toHaveBeenCalledWith('1. Copy and paste this URL into your browser:');
    expect(consoleSpy).toHaveBeenCalledWith(`   ${mockAuthUrl}\n`);
    expect(consoleSpy).toHaveBeenCalledWith('2. Set up port forwarding (if using SSH):');
    expect(consoleSpy).toHaveBeenCalledWith(`   ssh -L ${capturedPort}:localhost:${capturedPort} <your-ssh-connection>`);
    expect(consoleSpy).toHaveBeenCalledWith(`   Or access: http://localhost:${capturedPort}/oauth2callback\n`);

    expect(mockGetToken).toHaveBeenCalledWith({
      code: mockCode,
      redirect_uri: `http://localhost:${capturedPort}/oauth2callback`,
    });
    expect(mockSetCredentials).toHaveBeenCalledWith(mockTokens);

    const tokenPath = path.join(tempHomeDir, '.gemini', 'oauth_creds.json');
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    expect(tokenData).toEqual(mockTokens);

    consoleSpy.mockRestore();
  });

  it('should return cached credentials for manual login when available', async () => {
    const mockTokens = {
      access_token: 'cached-access-token',
      refresh_token: 'cached-refresh-token',
    };

    // Create cached credentials file
    const tokenPath = path.join(tempHomeDir, '.gemini', 'oauth_creds.json');
    fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
    fs.writeFileSync(tokenPath, JSON.stringify(mockTokens));

    const mockGetAccessToken = vi.fn().mockResolvedValue({ token: 'valid-token' });
    const mockGetTokenInfo = vi.fn().mockResolvedValue({});
    const mockSetCredentials = vi.fn();
    const mockOAuth2Client = {
      getAccessToken: mockGetAccessToken,
      getTokenInfo: mockGetTokenInfo,
      setCredentials: mockSetCredentials,
      credentials: mockTokens,
    } as unknown as OAuth2Client;

    vi.mocked(OAuth2Client).mockImplementation(() => mockOAuth2Client);

    // Clear mock calls to ensure fresh state
    vi.mocked(http.createServer).mockClear();
    vi.mocked(open).mockClear();

    const client = await getManualOauthClient();
    expect(client).toBe(mockOAuth2Client);
    expect(mockSetCredentials).toHaveBeenCalledWith(mockTokens);
    expect(mockGetAccessToken).toHaveBeenCalled();
    expect(mockGetTokenInfo).toHaveBeenCalledWith('valid-token');

    // Should not attempt to create server for cached credentials
    expect(http.createServer).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});
