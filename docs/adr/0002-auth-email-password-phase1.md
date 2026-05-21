# ADR-0002: Authentication Strategy — Email/Password with Planned SSO Migration

## Status
Accepted — 2026-05-21

## Context
IdeaFarming is an internal company tool. The long-term correct auth strategy for an internal tool is Single Sign-On (SSO) via the company's identity provider (Azure AD / Entra ID, Okta, Google Workspace, or similar) using OIDC or SAML. This avoids a separate credential set for employees and integrates with existing offboarding processes.

However, SSO integration requires coordination with IT, IdP configuration, and potentially procurement — effort that is out of scope for the initial build phase.

## Decision
Phase 1 uses **email/password authentication** with the following constraints, chosen to make the eventual SSO migration low-friction:

- Passwords are hashed with bcrypt (never stored in plaintext)
- The user identity model stores an `email` field as the primary identifier (not a username), since SSO providers use email as the canonical identity claim
- Auth logic is isolated behind a single auth module/service boundary — no auth-specific code leaks into domain logic
- No "sign up" flow for employees — Admin provisions accounts by email address, matching the same control model SSO will use

## Consequences
- Employees must manage a separate password for this tool until SSO is enabled.
- Admin is responsible for provisioning and deprovisioning accounts in phase 1; this must be handled manually when an employee leaves the company.
- When SSO is integrated in a future phase, email-matched accounts can be linked to IdP identities without data loss, since email is the shared key.
- The auth module boundary means SSO can be swapped in without touching domain code.
