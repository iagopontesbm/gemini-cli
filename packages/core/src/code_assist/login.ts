/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OAuth2Client } from 'google-auth-library';
import express from 'express';
import url, { UrlWithParsedQuery } from 'url';
import crypto from 'crypto';
import * as net from 'net';

//  OAuth Client ID used to initiate OAuth2Client class.
const OAUTH_CLIENT_ID =
  '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com';

// OAuth Secret value used to initiate OAuth2Client class.
const OAUTH_CLIENT_NOT_SO_SECRET = process.env.GCA_OAUTH_SECRET;

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

export async function doGCALogin(): Promise<OAuth2Client> {
  let redirectPort: number = await getAvailablePort();
  let client: OAuth2Client = await createOAuth2Client(redirectPort);
  let loggedIn: boolean = await login(client, redirectPort);
  return client;
}

function createOAuth2Client(redirectPort: number): OAuth2Client {
  let redirectURI: string = `http://localhost:${redirectPort}/oauth2redirect`;
  return new OAuth2Client({
    clientId: OAUTH_CLIENT_ID,
    clientSecret: OAUTH_CLIENT_NOT_SO_SECRET,
    redirectUri: redirectURI,
  });
}

/**
 * Returns first available port in user's machine
 * @returns port number
 */
function getAvailablePort(): Promise<number> {
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

function login(oauth2Client: OAuth2Client, port: number): Promise<boolean> {
  let state = crypto.randomBytes(32).toString('hex');
  let authURL: string = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: OAUTH_SCOPE,
    state: state,
  });

  console.log('Login:\n\n', authURL);

  return new Promise((resolve) => {
    let app = express();
    // Receive the callback from Google's OAuth 2.0 server.
    app.get('/oauth2redirect', async (req: any, res: any) => {
      let q: any = url.parse(req.url, true).query;
      console.log('received callback');
      if (q.error) {
        // An error response e.g. error=access_denied
        console.log('Error:' + q.error);
        res.writeHead(HTTP_REDIRECT, { Location: SIGN_IN_FAILURE_URL });
        res.end();
        resolve(false);
      } else if (q.state !== state) {
        //check state value
        console.log('State mismatch. Possible CSRF attack');
        res.end('State mismatch. Possible CSRF attack');
        resolve(false);
      } else {
        // Get access and refresh tokens (if access_type is offline)
        let { tokens } = await oauth2Client.getToken(q.code);
        console.log('Logged in! Tokens:\n\n', tokens);
        oauth2Client.setCredentials(tokens);
        res.writeHead(HTTP_REDIRECT, { Location: SIGN_IN_SUCCESS_URL });
        res.end();
        resolve(true);
      }
    });
    app.listen(port);
  });
}
