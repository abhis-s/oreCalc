# Security Policy

We take the security and privacy of ClashCalc (formerly OreCalc) seriously. This document outlines our security commitments, supported versions, implemented mitigations, secure deployment guidelines, and the process for reporting potential vulnerabilities.

---

## Security Commitments

- **Coordinated Disclosure**: We commit to working collaboratively with security researchers to resolve discovered vulnerabilities before public disclosure.
- **Rapid Response SLA**: We acknowledge all valid vulnerability reports within 24 to 48 hours and provide weekly progress updates until resolved.
- **Self-Contained UI Asset Architecture**: All core application assets (scripts, stylesheets, vector icons, game datasets, and fonts) are 100% self-hosted with zero external UI CDN dependencies (no Google Fonts, no external JS/CSS CDNs), eliminating third-party supply chain vectors.
- **Privacy-First Metrics & Anti-Abuse**: We operate zero advertising networks, zero tracking cookies, and zero cross-site behavioral tracking. Aggregate performance is measured using Cloudflare's privacy-first, cookie-free Web Analytics (no personal IP logging, no cross-site profiling), and authentication forms utilize Cloudflare Turnstile for on-demand bot defense without cookies.
- **Privacy-First Design**: No player tag data is collected on our servers unless cloud sync is explicitly enabled by the user.

---

## Supported Versions

We actively maintain and secure the following versions:

| Version | Security Support Status | Recommended Action |
| :--- | :---: | :--- |
| **v3.x.x** | Active Support | Current production release line. Upgrade to latest `v3.x`. |
| **v2.x.x** | Maintenance Support | Maintenance release line. Critical security patches only. |
| **v1.x.x** | End-of-Life (EOL) | EOL as of the release of v2.0.0. Upgrade to `v3.x`. |
| **< v1.0.0** | End-of-Life (EOL) | Legacy/development releases. Unsupported. |

---

## Implemented Security Hardening

ClashCalc employs defense-in-depth security principles across client and server tiers:

### 1. Client-Side XSS Mitigation (DOM Sanitization)

To support formatted player notices without exposing users to Cross-Site Scripting (XSS), ClashCalc does not use unsafe HTML insertion. Notice modals use a custom DOM-based allowlist sanitizer powered by `DOMParser`.

- **Allowed Elements**: `span`, `strong`, `em`, `code`, `br`, `p`, `b`, `i`.
- **Attribute Stripping**: All inline script tags (`<script>`), handlers (`onload`, `onerror`), and dynamic links are stripped completely before insertion into the DOM.

### 2. HTTP Security Headers (Helmet Middleware)

The Express API gateway utilizes `Helmet` to configure secure HTTP headers:

- **Clickjacking Protection**: Configures `X-Frame-Options: SAMEORIGIN` to allow same-origin iframe embedding while preventing unauthorized third-party framing.
- **MIME-Type Sniffing**: Enforces `X-Content-Type-Options: nosniff` to prevent browsers from executing non-executable MIME types as scripts or styles.
- **Content Security Policy (CSP)**: Locks down allowed media, script, and styling sources to prevent unauthorized script injections.

### 3. Strict CORS Scope

Cross-Origin Resource Sharing (CORS) rules on the Express API gateway are strictly locked down. By default, only trusted production domains (`https://clashcalc.com`, `https://www.clashcalc.com`, `https://beta.clashcalc.com`, legacy `https://orecalc.tech`) and local development environments (`localhost`, `127.0.0.1`) are permitted.

### 4. Per-Endpoint Rate Limiting & Proxy Protection

To prevent Denial of Service (DoS) and brute-force abuse:

- **General APIs**: Basic request rate limiting applied globally to protect server capacity.
- **Player Proxy**: Rate-limited to prevent abuse of the external Clash of Clans developer API.
- **Sensitive Operations**: Critical operations (such as anonymous cloud data deletion `DELETE /api/delete/:userId` and support ticket submissions) are restricted to **5 requests per hour** per IP address.
- **Proxy-Safe IP Resolution**: IP addresses are extracted from `CF-Connecting-IP` behind Cloudflare / Google Cloud Load Balancers to prevent IP clustering.

### 5. Self-Service Data Erasure & Account Deletion

ClashCalc provides granular, self-service data erasure across both local device storage and backend cloud tiers:

- **On-Device Data Reset**: Users can purge locally cached player profiles, equipment progress, and custom planner configurations from browser `localStorage` and `IndexedDB` directly on-device without network requests.
- **Anonymous Cloud Sync Deletion**: Anonymous sync profiles can be purged at any time via `DELETE /api/delete/:userId`. This executes a Firestore batch delete across `userStates/{userId}` and all subcollection `players/*` documents, locks the UUID in `deletedUuids/{userId}` to prevent orphan resurrection, and dispatches an automated compliance notification via SMTP.
- **Registered Account Deletion**: Registered users can immediately delete their account via `DELETE /api/auth/account`. This requires active WebAuthn or session authentication (`requireAuth`), permanently removing account credentials from `accounts/{username}`, cascading deletion to all associated Firestore records, and invalidating active session tokens.

### 6. Dependency & Supply Chain Safety (pnpm Workspace)

To eliminate dependency confusion and phantom dependency vulnerabilities, ClashCalc enforces a strict, symlink-isolated development tree using `pnpm`. Unlike flattened package trees, this prevents transitive dependencies from executing or resolving during build time unless explicitly declared.

---

## Reporting a Vulnerability

If you discover a security vulnerability, **please do not open a public GitHub Issue**. Instead, report it through our secure channel:

- **Email**: <security@clashcalc.com>
- **Preferred Language**: English or German
- **PGP Key**: Please email us if you require an encrypted exchange, and we will provide our current PGP public key.

### What to Include in Your Report

To help us triage and resolve the issue quickly, please provide:

1. **Vulnerability Description**: Detailed explanation of the vulnerability and its potential impact.
2. **Proof of Concept (PoC)**: Step-by-step instructions, screenshots, or scripts demonstrating how to reproduce the issue.
3. **Target Components**: Specify whether the issue lies in the client web application, backend server, or API integrations.
4. **Environment**: Browser version, OS details, and server configuration.

---

## Disclosure and Resolution Process

1. **Acknowledgment**: We confirm receipt of your report within 48 hours.
2. **Triage**: We verify the reproduction steps and assess the severity.
3. **Patching**: We develop and test a fix in a private branch.
4. **Deployment & Release**: The patch is deployed to production immediately.
5. **Advisory**: A security advisory is published, with researcher credit (if desired).

---

## Safe Harbor

Any security research conducted in good faith, in compliance with this policy, and without intent to disrupt or exploit the application or its users will be met with:

- **No Legal Action**: We will not initiate legal action or report research to law enforcement.
- **No Service Bans**: We will not ban your IP address for security research, provided testing adheres to rate limits and does not degrade service availability for others.

---

## Secure Self-Hosting Guidelines

If you choose to self-host ClashCalc:

1. **Secret Management**:
   Never commit or hardcode `CLASH_OF_CLANS_API_TOKEN`, `FIRESTORE_SA_KEY`, `JWT_SECRET`, or `TURNSTILE_SECRET_KEY` directly to source code. Use environment variables or service provider secret managers (such as Google Cloud Secret Manager).
2. **Enforce HTTPS**:
   Configure your hosting provider or reverse proxy to enforce TLS 1.3 for all HTTP traffic.
3. **WebAuthn Configuration**:
   Ensure `RP_NAME`, `RP_ID`, and `RP_ORIGIN` match your hosting domain (e.g. `RP_ID=yourdomain.com`, `RP_ORIGIN=https://yourdomain.com`).
4. **VPC & Outbound IP Binding**:
   When communicating with the official Clash of Clans developer API directly, bind outbound requests to a static IP address registered with your Clash Developer Portal profile, or route traffic via a proxy such as RoyaleAPI.
5. **Database Access Rules**:
   If hosting your own Firestore instance, ensure rules restrict read and write access to authenticated User IDs.
