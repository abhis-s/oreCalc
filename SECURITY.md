# Security Policy

We take the security and privacy of OreCalc seriously. This document outlines our security commitments, supported versions, implemented mitigations, secure deployment guidelines, and the process for reporting potential vulnerabilities.

---

## 🛡️ Security Commitments

- **Coordinated Disclosure**: We commit to working collaboratively with security researchers to resolve discovered vulnerabilities before public disclosure.
- **Rapid Response SLA**: We acknowledge all valid vulnerability reports within 24 to 48 hours and provide weekly progress updates until resolved.
- **Zero-CDN Architecture**: The client application is designed to be fully self-contained. It loads no external CDN scripts, stylesheets, or trackers, eliminating third-party supply chain vectors.
- **Privacy-First Design**: No player tag data is collected on our servers unless cloud sync is explicitly enabled by the user.

---

## 📋 Supported Versions

We actively maintain and secure the following versions of OreCalc:

| Version | Security Support Status | Recommended Action |
| :--- | :---: | :--- |
| **v2.x.x** | 🟢 Active Support | Upgrade to the latest `v2.x` release for all new patches. |
| **v1.x.x** | 🔴 End-of-Life (EOL) | EOL as of the release of v2.0.0. Upgrade to `v2.x`. |
| **< v1.0.0** | 🔴 End-of-Life (EOL) | Legacy/development releases. Unsupported. |

---

## 🔒 Implemented Security Hardening

OreCalc employs defense-in-depth security principles across both client and server layers:

### 1. Client-Side XSS Mitigation (HTML Sanitization)

To support formatted player notices without exposing users to Cross-Site Scripting (XSS), OreCalc does not use unsafe HTML insertion. Instead, notice modals use a custom DOM-based allowed-list sanitizer powered by `DOMParser`.

- **Allowed Elements**: `span`, `strong`, `em`, `code`, `br`, `p`, `b`, `i`.
- **Attribute Stripping**: All inline script tags (`<script>`), handlers (`onload`, `onerror`), and dynamic links are stripped completely before insertion into the DOM.

### 2. HTTP Security Headers (Helmet Middleware)

The API server utilizes `Helmet` to configure secure HTTP headers, mitigating common vectors:

- **Clickjacking Protection**: Configures `X-Frame-Options: DENY` to prevent the application from being embedded in malicious iframes.
- **MIME-Type Sniffing**: Enforces `X-Content-Type-Options: nosniff` to prevent browsers from executing non-executable MIME types as script/CSS.
- **Content Security Policy (CSP)**: Locks down allowed media, script, and styling sources to prevent unauthorized script injections.

### 3. Tight CORS Scope

Cross-Origin Resource Sharing (CORS) rules on the Express API gateway are strictly locked down. By default, only trusted production domains (e.g., `https://orecalc.tech`) and local development environments (`localhost`, `127.0.0.1`) are permitted to send requests.

### 4. Per-Endpoint Rate Limiting

To prevent Denial of Service (DoS) and brute-force abuse:

- **General APIs**: Basic request rate limiting applied globally to protect server capacity.
- **Sensitive Operations**: Critical endpoints (such as the GDPR `/global-erasure` and `/verify-tag` actions) are restricted by a strict limiter of **5 requests per hour** per IP address.

### 5. Verification-Backed GDPR Data Erasure

Data deletion requires the user to authenticate their ownership of the Clash of Clans player tag via an API verification token. Deletions are processed directly in Firestore, removing all cached configuration and sync documents permanently.

### 6. Dependency & Supply Chain Safety (pnpm Workspace)

To mitigate dependency confusion and phantom dependency vulnerabilities, OreCalc enforces a strict, symlink-isolated development tree using `pnpm`. Unlike `npm`'s flattened tree, this prevents nested transitive dependencies from being accessed or run during compile time, ensuring only declared, checked packages can execute.

---

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability, **please do not open a public GitHub Issue**. Instead, report it through our secure channel:

- **Email**: <security@clashcalc.com>
- **Preferred Language**: English or German
- **PGP Key**: (Optional) Please email us if you require an encrypted exchange, and we will provide our current PGP public key.

### What to Include in Your Report

To help us triage and resolve the issue quickly, please provide:

1. **Vulnerability Description**: Detailed explanation of the bug and its potential impact.
2. **Proof of Concept (PoC)**: Step-by-step instructions, screenshots, or scripts demonstrating how to reproduce the issue.
3. **Target Components**: Specify whether the issue lies in the client webapp, backend server, or API integrations.
4. **Discovery Environment**: Browser version, OS details, and server configuration.

---

## 🤝 Disclosure and Resolution Process

1. **Acknowledgment**: We will confirm receipt of your report within 48 hours.
2. **Triage**: Our security contributors will analyze the report and verify the vulnerability.
3. **Patching**: We will write and test a patch. If the issue is complex, we may consult with the reporter to verify the fix.
4. **Deployment & Release**: The patch will be merged, and a new minor/patch version will be released immediately.
5. **Advisory**: A security advisory will be published, and you will be credited for your discovery (if desired).

---

## 🛡️ Safe Harbor

Any security research conducted in good faith, in compliance with this policy, and without intent to disrupt or exploit the application or its users will be met with:

- **No Legal Action**: We will not initiate legal action or report research to law enforcement.
- **No Account/IP Bans**: We will not ban your player tag or IP address for scanning/testing, provided it does not disrupt service for others.

---

## ⚙️ Secure Self-Hosting Guidelines

If you choose to self-host OreCalc, we strongly recommend implementing the following precautions:

1. **Environment Secret Management**:
   Never commit or hardcode the `CLASH_OF_CLANS_API_TOKEN` or your GCP Service Account keys (`FIRESTORE_SA_KEY`) directly to source code. Use environment variables or service provider secret managers (such as Google Cloud Secret Manager).
2. **Enforce HTTPS**:
   Configure your hosting provider or reverse proxy (e.g. NGINX, Cloudflare) to redirect all HTTP traffic to HTTPS, enforcing TLS 1.3.
3. **VPC & Outbound IP Binding**:
   When communicating with the official Clash of Clans developer API, bind outbound requests to a static IP address registered with your Clash Developer Portal profile, or routing via a Serverless VPC Access connector on Google Cloud.
4. **Database Rules**:
   If hosting your own Firestore instance, ensure access rules are configured so that users can only read/write documents associated with their specific, verified User IDs.
