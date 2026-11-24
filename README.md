# Account Management

Open **System Tools → Account Management** in a signed-in WebOS desktop with this component enabled. **My account** changes the Chat display name, profile image and password. Change password verifies the current password and ends existing sessions. Images are cropped to 64 × 64 pixels before storage.

Accounts with the user-search permission also see **Manage users**. The backend checks each action separately. A moderator with the default grants can inspect users. An administrator can change reset retention, suspend or restore sign-in, issue a single-use password reset code valid for 15 minutes, and record requested mail settings. The public pilot’s installed mail policy applies until a mail change has been reconciled. Password reset codes belong in a private channel.

## Source and build

The entry point is `app.mjs`, which exports `mount(host)`. Its stylesheet is `style.css`. There are no app dependencies or compilation steps. Run `node --check app.mjs` in this checkout. The WebOS viewer builder accepts `--account-management enabled` and publishes both files in the app’s content-addressed directory. The app uses the signed WebOS Files gateway transport to reach the Accounts backend. The account service resolves permissions from the signed-in subject for each request.

The queue, database migration, reset behavior and rollout checks are documented in the WebOS checkout under `migration/ACCOUNT-MANAGEMENT-AND-MAIL-PLAN.md`.
