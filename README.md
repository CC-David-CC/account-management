# Account Management

WebOS browser app for personal settings and delegated account administration.

| View | Intended use |
| --- | --- |
| My account | A signed-in user changes their own password, display name, and avatar. |
| Manage users | An authorized operator finds a registered user and performs the specific operations their role permits. These include password resets, mail permissions, and retention across scheduled resets. |

Both views use the signed-in WebOS session. The Accounts backend owns identity, authorization, and account operations. It must check the acting subject, target, and required permission on every privileged request. The mail service enforces delivery and sending grants. The browser displays effective permissions and the outcome of each operation.

## Development status

The initial commit establishes repository ownership. The browser entry point, build recipe, desktop launcher, and account-management endpoints are pending. In the WebOS checkout, see `migration/ACCOUNT-MANAGEMENT-AND-MAIL-PLAN.md` for the implementation order and acceptance checks. The existing account service lives at `platform/accounts/`.
