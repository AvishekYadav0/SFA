# Master Admin & SaaS Subscription Management Plan

## 1. Architecture review summary
- Backend is a single Node.js + Express app with MongoDB multi-tenant connection logic.
- Tenant scoping is handled via `backend/src/utils/tenantContext.js` and `backend/src/utils/tenantModels.js`.
- Existing company admin auth is tied to `Company` and `User` records and uses JWT claims containing `companyId` and `tenantId`.
- Frontend is a Vite React SPA with a protected layout and existing dashboard routes that must remain visually unchanged.
- Existing SFA modules are business-tenant scoped and should remain untouched.

## 2. Safety and integration rules
- Treat this as an additive platform layer, not a redesign.
- Keep the existing company-side dashboard and role model intact.
- Add a separate platform-admin namespace and a dedicated frontend entry point rather than modifying current app shell routes.
- Never let a normal company user become a platform admin by changing client-side role data or JWT payload alone.
- Enforce subscription checks server-side on every protected company action.
- Preserve existing company databases and records; do not delete or recreate company collections.

## 3. Implementation phases
### Phase A — Base platform models and seed configuration
- Add new models for `SubscriptionPlan`, `Subscription`, `PlatformAdmin`, `SubscriptionPayment`, and `AuditLog` in `backend/src/models/`.
- Add safe bootstrap support for the first platform admin via environment-driven credentials or a backend seed script.
- Add indexes, validation, and default values for plan duration and status states.

### Phase B — Secure backend auth and middleware
- Add `platform-admin` JWT login flow separate from company admin login.
- Create middleware that validates platform identity, accountType, and tenant isolation.
- Add a platform-only authorization guard and subscription enforcement middleware for company-side APIs.
- Add audit logging for every plan, subscription, company, and user-limit mutation.

### Phase C — Company and subscription management API
- Add endpoints under `/api/platform-admin/*` for dashboard analytics, company listing, company detail, activation/suspension, plan assignment, expiry checks, feature overrides, and payment history.
- Add company-side routes such as `/api/company/subscription` and `/api/company/subscription/status`.
- Keep the existing `/api/saas/*` routes as compatibility aliases until the new platform flow is fully in place.

### Phase D — Background subscription lifecycle
- Add a scheduler using `node-cron` to scan subscription expiry and send notification events.
- Use idempotent event keys or unique notification logs to prevent duplicate notifications.
- Enforce backend checks on each protected request to avoid relying only on cron.

### Phase E — Frontend UI (isolated add-on)
- Add a separate platform-admin login page and dedicated dashboard route(s) without changing the current company dashboard layout.
- Add pages for companies list, subscription management, plan management, and payment logs.
- Add routing guards so only platform admins can access these screens.

### Phase F — Validation and deployment
- Run backend syntax checks and compile verification on the changed files.
- Validate that existing company routes still boot and that current company access remains unchanged.
- Document environment variables, deployment steps, and rollback instructions.

## 4. Planned file-by-file changes
### Backend
- `backend/src/models/PlatformAdmin.js` — new platform admin model.
- `backend/src/models/SubscriptionPlan.js` — plan configuration data.
- `backend/src/models/Subscription.js` — company subscription lifecycle record.
- `backend/src/models/SubscriptionPayment.js` — payment/renewal records.
- `backend/src/models/AuditLog.js` — immutable operational audit trail.
- `backend/src/controllers/platformAdminController.js` — platform dashboard and management logic.
- `backend/src/routes/platformAdmin.js` — dedicated platform admin routes.
- `backend/src/middleware/platformAuth.js` — secure platform-only authorization.
- `backend/src/services/subscriptionService.js` — plan and expiry business logic.
- `backend/src/services/subscriptionScheduler.js` — renewal/expiry scheduler.
- `backend/src/scripts/bootstrap-platform-admin.js` — secure bootstrap for first platform admin.
- `backend/src/server.js` — register new routes without disturbing existing company routes.

### Frontend
- `frontend/src/context/AuthContext.jsx` — add platform admin user-aware auth helpers.
- `frontend/src/services/api.js` — add platform API helpers without altering existing SFA requests.
- `frontend/src/pages/PlatformAdminLogin.jsx` — dedicated login screen.
- `frontend/src/pages/PlatformAdminDashboard.jsx` — platform-level dashboard.
- `frontend/src/pages/PlatformAdminCompanies.jsx` — company list and filters.
- `frontend/src/pages/PlatformAdminCompanyDetail.jsx` — per-company subscription and usage details.
- `frontend/src/pages/PlatformAdminPlans.jsx` — Basic/Pro plan management.
- `frontend/src/App.jsx` — add separate protected routes guarded for platform admin only.

## 5. Validation checklist
- Existing company login still works.
- Existing staff roles remain available and unchanged.
- No existing MongoDB record is deleted or overwritten.
- Platform admin routes are gated by backend middleware and not by frontend state alone.
- Subscription expiry blocks protected actions on the backend.
- User limits enforce active seats and prevent over-allocation.
- Feature toggles are enforced in API and UI access checks.

## 6. Implementation note
This plan is intentionally additive and keeps the current SFA app operational. The next step is to begin with the platform admin models and secure middleware, then expose the add-on dashboard and subscription APIs without altering the original business flow.
