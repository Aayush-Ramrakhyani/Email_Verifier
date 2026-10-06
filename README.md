# Email Verifier

An internal automation tool for resolving masked/obfuscated email addresses and verifying deliverability at scale — built to replace manual contact data cleanup for corporate research workflows.

Built for **Technowire Data Science** as part of a freelance contract (Apr 2026 – Sep 2026).

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [How It Works](#how-it-works)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Screenshots](#screenshots)
- [License](#license)

---

## Overview

Corporate contact lists obtained from MCA filings, public directories, and scraped sources frequently contain masked email addresses (e.g., `a*****@company.com`, `****@domain.in`). Resolving and verifying these manually is time-consuming at scale.

Email Verifier automates this pipeline: it generates probable email permutations from known name + domain combinations, validates deliverability via SMTP handshake probing, ranks results by confidence score, and outputs a clean CSV — all without sending a single email.

---

## Features

### Email Unmasking
- Takes masked email + company domain as input (e.g., `a*****@technowire.in` + `technowire.in`)
- Generates all probable permutations based on **common corporate naming conventions:**
  - `firstname.lastname@domain`
  - `f.lastname@domain`
  - `firstnamelastname@domain`
  - `firstname@domain`
  - `flastname@domain`
  - `lastname.firstname@domain`
  - And more (12+ patterns)
- Name-aware — extracts first/last name from partial email or supplied contact name

### SMTP Verification (No Email Sent)
- **MX record lookup** — confirms domain has a valid mail server
- **SMTP handshake** — connects to mail server and probes deliverability using `RCPT TO` command
- No email is actually sent — uses `RSET` to abort before delivery
- Handles greylisting and temporary SMTP failures with retry logic

### Confidence Scoring
- Each result ranked 0–100% confidence based on:
  - SMTP response code (250 = high, 550 = invalid, 4xx = uncertain)
  - Pattern frequency — common patterns weighted higher
  - Domain reputation signals
- Results sorted by confidence — top result is the best guess

### Batch Processing
- Upload a CSV with columns: `masked_email`, `domain`, `name` (optional)
- Configurable concurrency (1–20 parallel verifications)
- Respects per-domain rate limits to avoid IP blacklisting
- Progress bar with ETA for large batches

### Web UI
- Lightweight browser interface for non-technical users
- Upload CSV → Configure settings → Download results
- No command-line knowledge required

### CLI Mode
- Power-user CLI for scripting and pipeline integration
- Supports stdin/stdout piping for integration with other tools

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js |
| CLI | Commander.js |
| Web UI | Express, vanilla HTML/JS |
| SMTP Probing | Node `net` module (raw TCP) |
| DNS | Node `dns` module |
| CSV Parsing | csv-parse |
| CSV Output | csv-stringify |

---

## How It Works

```
Input: a*****@technowire.in  +  domain: technowire.in  +  name: Aayush Ramrakhyani
          ↓
1. Generate permutations:
   aayush.ramrakhyani@technowire.in
   a.ramrakhyani@technowire.in
   aayushramrakhyani@technowire.in
   aramrakhyani@technowire.in
   ... (12+ variants)
          ↓
2. MX Lookup → mail.technowire.in  (port 25)
          ↓
3. For each permutation:
   EHLO verifier.local
   MAIL FROM: <verify@check.com>
   RCPT TO: <aayush.ramrakhyani@technowire.in>
   → 250 OK  → confidence: HIGH
   → 550 No such user  → confidence: INVALID
   → 421 Try later  → confidence: UNCERTAIN
   RSET  (abort — no email sent)
          ↓
4. Rank by confidence + pattern weight
          ↓
Output CSV:
email,confidence,smtp_code,pattern
aayush.ramrakhyani@technowire.in,92%,250,firstname.lastname
a.ramrakhyani@technowire.in,61%,250,f.lastname
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Clone the Repository

```bash
git clone https://github.com/Aayush-Ramrakhyani/email-verifier.git
cd email-verifier
```

### Install Dependencies

```bash
npm install
```

---

## Environment Variables

Create a `.env` file:

```env
PORT=3000

# SMTP probe timeout in ms
SMTP_TIMEOUT=5000

# Max concurrent verifications
DEFAULT_CONCURRENCY=5

# Per-domain rate limit (requests per minute)
DOMAIN_RATE_LIMIT=10
```

---

## Running the App

### Web UI

```bash
npm start
# Open http://localhost:3000
```

### CLI — Single Email

```bash
node cli.js verify --masked "a*****@company.in" --domain "company.in" --name "Aayush Ramrakhyani"
```

### CLI — Batch from CSV

```bash
node cli.js batch --input contacts.csv --output results.csv --concurrency 10
```

### Input CSV Format

```csv
masked_email,domain,name
a*****@technowire.in,technowire.in,Aayush Ramrakhyani
j***@infosys.com,infosys.com,Jatin Mehta
```

### Output CSV Format

```csv
input_email,resolved_email,confidence,smtp_code,pattern,verified_at
a*****@technowire.in,aayush.ramrakhyani@technowire.in,92%,250,firstname.lastname,2026-05-12T10:32:00Z
```

---

## Project Structure

```
email-verifier/
├── src/
│   ├── permutations.js     # Email pattern generator
│   ├── smtp.js             # SMTP handshake prober
│   ├── dns.js              # MX record lookup
│   ├── scorer.js           # Confidence scoring
│   ├── batch.js            # Batch processor with concurrency
│   └── csv.js              # CSV parse/output helpers
│
├── web/
│   ├── server.js           # Express web UI server
│   ├── public/
│   │   ├── index.html      # Upload form
│   │   └── results.html    # Results display
│
├── cli.js                  # CLI entry point
├── index.js                # Programmatic API entry point
├── .env
└── package.json
```

---

## API Reference

### REST API (Web UI backend)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/verify/single` | Verify a single masked email |
| POST | `/api/verify/batch` | Upload CSV for batch verification |
| GET | `/api/jobs/:id` | Get batch job status and progress |
| GET | `/api/jobs/:id/download` | Download results CSV |

**POST /api/verify/single**
```json
{
  "maskedEmail": "a*****@company.in",
  "domain": "company.in",
  "name": "Aayush Ramrakhyani"
}
```

---

## Screenshots

> Add screenshots of:
> - Web UI upload form
> - Batch processing progress screen
> - Results table with confidence scores
> - Downloaded output CSV sample

---

## License

This project was built under a freelance contract for **Technowire Data Science**.
All rights reserved. Not open for redistribution.
