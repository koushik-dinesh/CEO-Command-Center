import { google } from 'googleapis';
import { env } from '../config/env.js';

export function createGoogleAuth() {
  if (env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON) as Record<string, unknown>;
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  }

  return new google.auth.GoogleAuth({
    keyFile: env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}
