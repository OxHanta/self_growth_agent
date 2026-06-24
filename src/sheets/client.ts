import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { config } from '../config';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

async function getAuth() {
  const credPath = path.resolve(config.google.credentialsPath);
  const tokenPath = path.resolve(config.google.tokenPath);

  if (!fs.existsSync(credPath)) {
    throw new Error(`Google credentials not found at ${credPath}. Download credentials.json from Google Cloud Console.`);
  }

  const credentials = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
  const { client_secret, client_id, redirect_uris } = credentials.installed ?? credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  if (fs.existsSync(tokenPath)) {
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    oAuth2Client.setCredentials(token);

    // Refresh if close to expiry
    const expiry = token.expiry_date ?? 0;
    if (Date.now() > expiry - 60_000) {
      const { credentials: refreshed } = await oAuth2Client.refreshAccessToken();
      oAuth2Client.setCredentials(refreshed);
      fs.writeFileSync(tokenPath, JSON.stringify(refreshed));
    }

    return oAuth2Client;
  }

  // First-time OAuth flow (run interactively via setup script)
  const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
  console.log('\nAuthorize this app by visiting:\n', authUrl);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = await new Promise<string>((resolve) =>
    rl.question('\nEnter the code from that page here: ', (c) => { rl.close(); resolve(c); })
  );

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(tokenPath, JSON.stringify(tokens));
  console.log('Token saved to', tokenPath);

  return oAuth2Client;
}

export async function readSheet(sheetId: string, tabName: string): Promise<string[][]> {
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: tabName,
  });
  return (res.data.values as string[][]) ?? [];
}

export async function appendToSheet(sheetId: string, tabName: string, row: string[]): Promise<void> {
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${tabName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

export async function createSpreadsheet(title: string): Promise<string> {
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.create({
    requestBody: { properties: { title } },
  });
  return res.data.spreadsheetId!;
}

export async function ensureTab(sheetId: string, tabName: string): Promise<void> {
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const exists = spreadsheet.data.sheets?.some(s => s.properties?.title === tabName);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });
  }
}
