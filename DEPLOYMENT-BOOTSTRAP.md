# One-time automated backend deployment bootstrap

This is the only setup that cannot be created from the repository itself because Google requires a user OAuth grant and GitHub stores the resulting credentials as repository secrets.

After this is completed once, normal `apps-script/**` changes on `main` deploy automatically.

## 1. Copy the bound Apps Script Script ID

1. Open the existing Apps Script project attached to `Irish Academic Opportunities – Student Finder`.
2. Open **Project Settings**.
3. Copy the **Script ID**.
4. Keep it for the GitHub secret `APPS_SCRIPT_ID`.

Do not create a new Apps Script project and do not replace the current deployment.

## 2. Allow Apps Script API project access

1. Open the Apps Script dashboard: `https://script.google.com/home/usersettings`.
2. Enable **Google Apps Script API** access for your account.

Google disables third-party content/deployment management by default, so this permission is required even after OAuth succeeds.

## 3. Create/select a Google Cloud project for the deployment client

1. Open `https://console.cloud.google.com/`.
2. Create or select a Google Cloud project used for this deployment automation.
3. Under **APIs & Services → Library**, enable **Google Apps Script API**.
4. Configure the OAuth consent screen.
5. For durable production automation, use an **In production** OAuth publishing state where appropriate. External clients left in Testing normally receive refresh tokens that expire after seven days.

This OAuth client is the deployment caller. You do not need to create a second finder or a second Apps Script web app.

## 4. Create a Web application OAuth client

Under **APIs & Services → Credentials**:

1. Create **OAuth client ID**.
2. Application type: **Web application**.
3. Add this Authorized redirect URI exactly:
   `https://developers.google.com/oauthplayground`
4. Save the generated **Client ID** and **Client secret**.

These become:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`

## 5. Generate the durable refresh token

1. Open `https://developers.google.com/oauthplayground/`.
2. Open the settings/gear panel.
3. Enable **Use your own OAuth credentials**.
4. Enter the Client ID and Client secret from step 4.
5. OAuth flow: **Server-side**.
6. Access type: **Offline**.
7. Force prompt: **Consent Screen**.
8. In **Input your own scopes**, enter both scopes separated by a space:

   `https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/script.deployments`

9. Click **Authorize APIs** and sign in as the Google account that owns/can deploy the bound Apps Script project.
10. Complete the consent screen.
11. In Step 2 of OAuth Playground, click **Exchange authorization code for tokens**.
12. Copy the **Refresh token**.

Use your own OAuth credentials in the Playground; the Playground's default refresh tokens are not suitable for durable production automation.

## 6. Add four GitHub Actions secrets

Open the repository:

`https://github.com/liamsomers08/Irish-Academic-Opportunities`

Then:

**Settings → Secrets and variables → Actions → New repository secret**

Create exactly these four secrets:

| Secret | Value |
|---|---|
| `APPS_SCRIPT_ID` | Script ID copied in step 1 |
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth Client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth Client secret |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | OAuth refresh token |

Never commit these values to a file or issue.

## 7. Run the first deployment

Open:

**Actions → Deploy Apps Script backend → Run workflow → main**

A successful first run will:

1. validate all managed Apps Script code;
2. authenticate using the four secrets;
3. download the complete existing bound Apps Script project;
4. preserve every existing remote file;
5. overlay the GitHub-managed files;
6. update Apps Script HEAD;
7. create a new immutable version;
8. repoint the existing public deployment;
9. call the live `bootstrap` API;
10. trigger the production desktop/mobile browser smoke workflow.

The first normal Apps Script execution after deployment also auto-provisions the Stage 9 policy/log sheets and daily trigger.

## Expected safety behavior

If any required secret is absent, the workflow stops before reading or writing the Apps Script project.

If the remote project cannot be read or the `appsscript` manifest is missing, deployment stops before `updateContent`.

If Apps Script deployment fails, browser smoke does not run as a backend-release follow-up.

If Stage 9 changes master data and the regression/data-quality gate fails, the Stage 9 data batch is rolled back automatically.
