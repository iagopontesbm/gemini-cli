/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OAuth2Client, Credentials } from 'google-auth-library';
import * as http from 'http';
import url from 'url';
import crypto from 'crypto';
import * as net from 'net';
import open from 'open';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import * as os from 'os';

//  OAuth Client ID used to initiate OAuth2Client class.
const OAUTH_CLIENT_ID =
  '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com';

// OAuth Secret value used to initiate OAuth2Client class.
// Note: It's ok to save this in git because this is an installed application
// as described here: https://developers.google.com/identity/protocols/oauth2#installed
// "The process results in a client ID and, in some cases, a client secret,
// which you embed in the source code of your application. (In this context,
// the client secret is obviously not treated as a secret.)"
const OAUTH_CLIENT_SECRET = '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';

// OAuth Scopes for Cloud Code authorization.
const OAUTH_SCOPE = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const HTTP_REDIRECT = 301;
const SIGN_IN_SUCCESS_URL =
  'https://developers.google.com/gemini-code-assist/auth_success_gemini';
const SIGN_IN_FAILURE_URL =
  'https://developers.google.com/gemini-code-assist/auth_failure_gemini';

const GEMINI_DIR = '.gemini';
const CREDENTIAL_FILENAME = 'oauth_creds.json';

// Global OAuth server management
let activeOAuthServer: http.Server | null = null;
let serverCleanupPromise: Promise<void> | null = null;

/**
 * Shortens a URL using TinyURL service
 * @param url The URL to shorten
 * @returns Promise that resolves to the shortened URL, or the original URL if shortening fails
 */
async function shortenUrl(url: string): Promise<string> {
  try {
    // TinyURL API endpoint
    const tinyUrlApi = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`;

    const response = await fetch(tinyUrlApi, {
      method: 'GET',
      headers: {
        'User-Agent': 'GeminiCLI URL Shortener',
      },
      // Set a timeout for the request
      signal: AbortSignal.timeout(3000), // Shorter timeout for console output
    });

    if (response.ok) {
      const shortenedUrl = await response.text();

      // TinyURL returns the shortened URL directly as plain text
      // Validate that we got a proper shortened URL back
      if (shortenedUrl && shortenedUrl.startsWith('https://tinyurl.com/')) {
        return shortenedUrl;
      }
    }

    // If shortening failed, return the original URL
    return url;
  } catch (_error) {
    // If there's any error (network, timeout, etc.), return the original URL
    return url;
  }
}

/**
 * An Authentication URL for updating the credentials of a Oauth2Client
 * as well as a promise that will resolve when the credentials have
 * been refreshed (or which throws error when refreshing credentials failed).
 */
export interface OauthWebLogin {
  authUrl: string;
  loginCompletePromise: Promise<void>;
}

/**
 * Manual authentication information for SSH users.
 */
export interface ManualOauthLogin {
  authUrl: string;
  callbackUrl: string;
  loginCompletePromise: Promise<void>;
}

interface AuthCommonResult {
  authUrl: string;
  redirectUri: string;
  loginCompletePromise: Promise<void>;
}

/**
 * Common OAuth authentication logic shared by both web and manual flows
 */
async function authCommon(
  client: OAuth2Client,
  configuredPort?: number,
): Promise<AuthCommonResult> {
  // Ensure any existing OAuth server is shut down first
  await ensureOAuthServerCleanup();

  // Setup process cleanup handlers
  setupProcessCleanupHandlers();

  const port = await resolveOAuthPort(configuredPort);
  const redirectUri = `http://localhost:${port}/oauth2callback`;
  const state = crypto.randomBytes(32).toString('hex');
  const authUrl: string = client.generateAuthUrl({
    redirect_uri: redirectUri,
    access_type: 'offline',
    scope: OAUTH_SCOPE,
    state,
  });

  const loginCompletePromise = new Promise<void>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url!.indexOf('/oauth2callback') === -1) {
          res.writeHead(HTTP_REDIRECT, { Location: SIGN_IN_FAILURE_URL });
          res.end();
          reject(new Error('Unexpected request: ' + req.url));
        }
        // acquire the code from the querystring, and close the web server.
        const qs = new url.URL(req.url!, 'http://localhost:3000').searchParams;
        if (qs.get('error')) {
          res.writeHead(HTTP_REDIRECT, { Location: SIGN_IN_FAILURE_URL });
          res.end();

          reject(new Error(`Error during authentication: ${qs.get('error')}`));
        } else if (qs.get('state') !== state) {
          res.end('State mismatch. Possible CSRF attack');

          reject(new Error('State mismatch. Possible CSRF attack'));
        } else if (qs.get('code')) {
          const { tokens } = await client.getToken({
            code: qs.get('code')!,
            redirect_uri: redirectUri,
          });
          client.setCredentials(tokens);
          await cacheCredentials(client.credentials);

          res.writeHead(HTTP_REDIRECT, { Location: SIGN_IN_SUCCESS_URL });
          res.end();
          resolve();
        } else {
          reject(new Error('No code found in request'));
        }
      } catch (e) {
        reject(e);
      } finally {
        server.close();
        activeOAuthServer = null;
      }
    });

    // Track the active server globally
    activeOAuthServer = server;
    server.listen(port);
  });

  return {
    authUrl,
    redirectUri,
    loginCompletePromise,
  };
}

async function authWithWeb(
  client: OAuth2Client,
  configuredPort?: number,
): Promise<OauthWebLogin> {
  const result = await authCommon(client, configuredPort);
  return {
    authUrl: result.authUrl,
    loginCompletePromise: result.loginCompletePromise,
  };
}

async function authWithManual(
  client: OAuth2Client,
  configuredPort?: number,
): Promise<ManualOauthLogin> {
  const result = await authCommon(client, configuredPort);
  return {
    authUrl: result.authUrl,
    callbackUrl: result.redirectUri,
    loginCompletePromise: result.loginCompletePromise,
  };
}

export async function getOauthClient(
  configuredPort?: number,
): Promise<OAuth2Client> {
  const client = new OAuth2Client({
    clientId: OAUTH_CLIENT_ID,
    clientSecret: OAUTH_CLIENT_SECRET,
  });

  if (await loadCachedCredentials(client)) {
    // Found valid cached credentials.
    return client;
  }

  const webLogin = await authWithWeb(client, configuredPort);

  // Try to shorten the URL for console display
  const displayUrl = await shortenUrl(webLogin.authUrl);

  console.log(
    `\n\nCode Assist login required.\n` +
    `Attempting to open authentication page in your browser.\n` +
    `Otherwise navigate to:\n\n${displayUrl}\n\n`,
  );
  await open(webLogin.authUrl);
  console.log('Waiting for authentication...');

  await webLogin.loginCompletePromise;

  return client;
}

export async function getManualOauthClient(
  configuredPort?: number,
): Promise<OAuth2Client> {
  const client = new OAuth2Client({
    clientId: OAUTH_CLIENT_ID,
    clientSecret: OAUTH_CLIENT_SECRET,
  });

  if (await loadCachedCredentials(client)) {
    // Found valid cached credentials.
    return client;
  }

  const manualLogin = await authWithManual(client, configuredPort);

  // Try to shorten the URL for console display
  const displayUrl = await shortenUrl(manualLogin.authUrl);

  console.log('\n\nCode Assist login required.');
  console.log('Please complete the following steps:\n');
  console.log('1. Copy and paste this URL into your browser:');
  console.log(`   ${displayUrl}\n`);
  console.log('2. Set up port forwarding (if using SSH):');
  const port = new URL(manualLogin.callbackUrl).port;
  console.log(`   ssh -L ${port}:localhost:${port} <your-ssh-connection>`);
  console.log(`   Or access: ${manualLogin.callbackUrl}\n`);
  console.log('3. Complete the authentication in your browser');
  console.log('4. The browser will redirect to the callback URL');
  console.log('\nWaiting for authentication...');

  await manualLogin.loginCompletePromise;

  return client;
}

export async function getManualOauthInfo(
  configuredPort?: number,
): Promise<ManualOauthLogin> {
  const client = new OAuth2Client({
    clientId: OAUTH_CLIENT_ID,
    clientSecret: OAUTH_CLIENT_SECRET,
  });

  if (await loadCachedCredentials(client)) {
    // Found valid cached credentials - return empty info as we don't need manual flow
    throw new Error('Already authenticated');
  }

  return await authWithManual(client, configuredPort);
}

export function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    let port = 0;
    try {
      const server = net.createServer();
      server.listen(0, () => {
        const address = server.address()! as net.AddressInfo;
        port = address.port;
      });
      server.on('listening', () => {
        server.close();
        server.unref();
      });
      server.on('error', (e) => reject(e));
      server.on('close', () => resolve(port));
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Resolves the OAuth port to use. Checks for configured port first,
 * then falls back to finding an available port.
 */
async function resolveOAuthPort(configuredPort?: number): Promise<number> {
  // Check for configured port from parameter, environment variable, or other sources
  const envPort =
    parseInt(process.env.GEMINI_OAUTH_PORT || '0', 10) || undefined;
  const portToUse = configuredPort || envPort;

  if (portToUse) {
    // Validate that the configured port is available
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(portToUse, () => {
        server.close();
        server.unref();
        resolve(portToUse);
      });
      server.on('error', (error) => {
        // If configured port is not available, reject with a descriptive error
        reject(
          new Error(
            `Configured OAuth port ${portToUse} is not available: ${error.message}`,
          ),
        );
      });
    });
  }

  // Fall back to finding any available port
  return getAvailablePort();
}

async function loadCachedCredentials(client: OAuth2Client): Promise<boolean> {
  try {
    const keyFile =
      process.env.GOOGLE_APPLICATION_CREDENTIALS || getCachedCredentialPath();

    const creds = await fs.readFile(keyFile, 'utf-8');
    client.setCredentials(JSON.parse(creds));

    // This will verify locally that the credentials look good.
    const { token } = await client.getAccessToken();
    if (!token) {
      return false;
    }

    // This will check with the server to see if it hasn't been revoked.
    await client.getTokenInfo(token);

    return true;
  } catch (_) {
    return false;
  }
}

async function cacheCredentials(credentials: Credentials) {
  const filePath = getCachedCredentialPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const credString = JSON.stringify(credentials, null, 2);
  await fs.writeFile(filePath, credString);
}

function getCachedCredentialPath(): string {
  return path.join(os.homedir(), GEMINI_DIR, CREDENTIAL_FILENAME);
}

export async function clearCachedCredentialFile() {
  try {
    await fs.rm(getCachedCredentialPath());
  } catch (_) {
    /* empty */
  }
}

/**
 * Shuts down the active OAuth server if one exists
 */
async function shutdownActiveOAuthServer(): Promise<void> {
  if (activeOAuthServer) {
    return new Promise<void>((resolve) => {
      activeOAuthServer!.close(() => {
        activeOAuthServer = null;
        resolve();
      });
    });
  }
}

/**
 * Ensures any existing OAuth server is shut down before starting a new one
 */
async function ensureOAuthServerCleanup(): Promise<void> {
  // Wait for any pending cleanup to complete
  if (serverCleanupPromise) {
    await serverCleanupPromise;
  }

  // Shutdown active server if exists
  if (activeOAuthServer) {
    serverCleanupPromise = shutdownActiveOAuthServer();
    await serverCleanupPromise;
    serverCleanupPromise = null;
  }
}

/**
 * Sets up process termination handlers to ensure OAuth server cleanup
 */
function setupProcessCleanupHandlers() {
  // Only setup once
  if (process.listenerCount('SIGTERM') === 0) {
    const cleanupAndExit = () => {
      shutdownActiveOAuthServer().finally(() => process.exit());
    };

    const cleanupWithoutExit = () => {
      shutdownActiveOAuthServer().catch(() => {
        // Ignore errors on exit
      });
    };

    process.on('SIGTERM', cleanupAndExit);
    process.on('SIGINT', cleanupAndExit);
    process.on('beforeExit', cleanupWithoutExit);
  }
}

/**
 * Export for testing - shuts down active OAuth server
 */
export async function shutdownOAuthServer(): Promise<void> {
  await shutdownActiveOAuthServer();
}

/**
 * Export for testing - checks if OAuth server is active
 */
export function isOAuthServerActive(): boolean {
  return activeOAuthServer !== null;
}
