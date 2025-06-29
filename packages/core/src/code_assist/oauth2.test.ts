/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  getOauthClient, 
  getManualOauthClient, 
  shutdownOAuthServer, 
  isOAuthServerActive 
} from './oauth2.js';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import http from 'http';
import open from 'open';
import crypto from 'crypto';
import * as os from 'os';
import * as net from 'net';

// Mock fetch for URL shortening
global.fetch = vi.fn();

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
vi.mock('net');

describe('oauth2', () => {
  let tempHomeDir: string;

  beforeEach(() => {
    tempHomeDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gemini-cli-test-home-'),
    );
    vi.mocked(os.homedir).mockReturnValue(tempHomeDir);

    // Mock URL shortening to return original URL (no shortening for tests)
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    // Mock net.createServer for port resolution
    const mockNetServer = {
      listen: vi.fn((port: number, callback?: () => void) => {
        if (callback) setTimeout(callback, 0);
      }),
      close: vi.fn((callback?: () => void) => {
        if (callback) setTimeout(callback, 0);
      }),
      unref: vi.fn(),
      address: vi.fn().mockReturnValue({ port: 8080 }),
      on: vi.fn((event: string, handler: () => void) => {
        if (event === 'listening') {
          setTimeout(handler, 0);
        } else if (event === 'close') {
          setTimeout(handler, 0);
        }
      }),
    };
    vi.mocked(net.createServer).mockReturnValue(mockNetServer as unknown as net.Server);
  });
  afterEach(() => {
    fs.rmSync(tempHomeDir, { recursive: true, force: true });
    vi.clearAllMocks();
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
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

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
    expect(consoleSpy).toHaveBeenCalledWith(
      'Please complete the following steps:\n',
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      '1. Copy and paste this URL into your browser:',
    );
    expect(consoleSpy).toHaveBeenCalledWith(`   ${mockAuthUrl}\n`);
    expect(consoleSpy).toHaveBeenCalledWith(
      '2. Set up port forwarding (if using SSH):',
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      `   ssh -L ${capturedPort}:localhost:${capturedPort} <your-ssh-connection>`,
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      `   Or access: http://localhost:${capturedPort}/oauth2callback\n`,
    );

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

    const mockGetAccessToken = vi
      .fn()
      .mockResolvedValue({ token: 'valid-token' });
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

  describe('OAuth Server Lifecycle Management', () => {
    beforeEach(async () => {
      // Ensure clean state before each test
      await shutdownOAuthServer();
    });

    afterEach(async () => {
      // Clean up after each test
      await shutdownOAuthServer();
    });

    it('should track active OAuth server state', () => {
      // Initially no server should be active
      expect(isOAuthServerActive()).toBe(false);
    });

    it('should shutdown active OAuth server', async () => {
      const mockServer = {
        listen: vi.fn(),
        close: vi.fn((callback?: () => void) => {
          if (callback) callback();
        }),
      } as unknown as http.Server;

      vi.mocked(http.createServer).mockReturnValue(mockServer);

      const mockOAuth2Client = {
        generateAuthUrl: vi.fn().mockReturnValue('https://example.com/auth'),
        getToken: vi.fn().mockResolvedValue({ tokens: { access_token: 'test' } }),
        setCredentials: vi.fn(),
        getAccessToken: vi.fn().mockResolvedValue({ token: null }),
        getTokenInfo: vi.fn().mockRejectedValue(new Error('No cached credentials')),
      } as unknown as OAuth2Client;

      vi.mocked(OAuth2Client).mockImplementation(() => mockOAuth2Client);
      vi.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('test-state') as never);

      // Start an OAuth flow (this should create and track a server)
      // We don't await this since it will hang waiting for OAuth callback
      const promise = getOauthClient(8080);
      
      // Wait a bit for the server to be created
      await new Promise(resolve => setTimeout(resolve, 100));

      // Server should now be active
      expect(isOAuthServerActive()).toBe(true);

      // Shutdown should clean up the server
      await shutdownOAuthServer();
      expect(isOAuthServerActive()).toBe(false);
      expect(mockServer.close).toHaveBeenCalled();
      
      // Clean up the hanging promise
      promise.catch(() => {});
    });

    it('should shutdown existing server before starting new OAuth flow', async () => {
      const mockServer1 = {
        listen: vi.fn(),
        close: vi.fn((callback?: () => void) => {
          if (callback) callback();
        }),
      } as unknown as http.Server;

      const mockServer2 = {
        listen: vi.fn(),
        close: vi.fn((callback?: () => void) => {
          if (callback) callback();
        }),
      } as unknown as http.Server;

      // First call returns server1, second call returns server2
      vi.mocked(http.createServer)
        .mockReturnValueOnce(mockServer1)
        .mockReturnValueOnce(mockServer2);

      const mockOAuth2Client = {
        generateAuthUrl: vi.fn().mockReturnValue('https://example.com/auth'),
        getToken: vi.fn().mockResolvedValue({ tokens: { access_token: 'test' } }),
        setCredentials: vi.fn(),
        getAccessToken: vi.fn().mockResolvedValue({ token: null }),
        getTokenInfo: vi.fn().mockRejectedValue(new Error('No cached credentials')),
      } as unknown as OAuth2Client;

      vi.mocked(OAuth2Client).mockImplementation(() => mockOAuth2Client);
      vi.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('test-state') as never);

      // Start first OAuth flow - don't await since it will hang
      const promise1 = getOauthClient(8080);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(isOAuthServerActive()).toBe(true);

      // Start second OAuth flow - should shutdown first server
      const promise2 = getManualOauthClient(8081);
      await new Promise(resolve => setTimeout(resolve, 100));

      // First server should have been closed
      expect(mockServer1.close).toHaveBeenCalled();
      // Second server should be tracked
      expect(isOAuthServerActive()).toBe(true);
      
      // Clean up hanging promises
      promise1.catch(() => {});
      promise2.catch(() => {});
    });

    it('should handle multiple shutdown calls gracefully', async () => {
      // Multiple shutdowns should not throw errors
      await shutdownOAuthServer();
      await shutdownOAuthServer();
      await shutdownOAuthServer();

      expect(isOAuthServerActive()).toBe(false);
    });

    it('should setup process cleanup handlers', async () => {
      const originalListenerCount = process.listenerCount;
      const mockListenerCount = vi.fn().mockReturnValue(0);
      process.listenerCount = mockListenerCount;

      const mockOn = vi.spyOn(process, 'on');

      const mockOAuth2Client = {
        generateAuthUrl: vi.fn().mockReturnValue('https://example.com/auth'),
        getToken: vi.fn().mockResolvedValue({ tokens: { access_token: 'test' } }),
        setCredentials: vi.fn(),
        getAccessToken: vi.fn().mockResolvedValue({ token: null }),
        getTokenInfo: vi.fn().mockRejectedValue(new Error('No cached credentials')),
      } as unknown as OAuth2Client;

      vi.mocked(OAuth2Client).mockImplementation(() => mockOAuth2Client);
      vi.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('test-state') as never);

      const mockServer = {
        listen: vi.fn(),
        close: vi.fn((callback?: () => void) => {
          if (callback) setTimeout(callback, 0);
        }),
      } as unknown as http.Server;

      vi.mocked(http.createServer).mockReturnValue(mockServer);

      // Start OAuth flow but don't await
      const promise = getOauthClient(8080);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have setup cleanup handlers
      expect(mockOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('beforeExit', expect.any(Function));

      // Restore original function
      process.listenerCount = originalListenerCount;
      mockOn.mockRestore();
      
      // Clean up
      promise.catch(() => {});
    });
  });
});
