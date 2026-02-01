# CodeRabbit Setup Guide for Quantum Kuiper

## Method 1: GitHub App (RECOMMENDED - No CLI needed)

### Step 1: Install CodeRabbit on GitHub
1. Visit https://github.com/marketplace/coderabbitai
2. Click "Set up a plan" (Free tier available)
3. Select your repository: `manitejakanuri1/quantum-kuiper`
4. Authorize the app

### What CodeRabbit Will Do:
✅ Automatically review ALL Pull Requests
✅ Check for security issues (SSRF, XSS, SQL injection)
✅ Suggest performance improvements
✅ Verify your 3-tier RAG architecture
✅ Ensure Zod validation on all API routes
✅ Check for proper error handling

### Configuration Already Set:
✓ `.coderabbit.yaml` - Custom review rules for your project
✓ Path-specific instructions for API routes, SQL files, tests
✓ Security checklist enforcement
✓ Performance target validation (<100ms Q&A, <200ms voice)

---

## Method 2: Claude Code Integration (For AI-Powered Reviews)

### Requirements:
- WSL (Windows Subsystem for Linux) installed
- Claude Code CLI

### Step 1: Install WSL
```powershell
# Run in PowerShell as Administrator
wsl --install
```

Restart your computer after installation.

### Step 2: Install CodeRabbit CLI in WSL
```bash
# In WSL terminal
curl -fsSL https://cli.coderabbit.ai/install.sh | sh
```

### Step 3: Authenticate
```bash
coderabbit auth login
```

This will open a browser. Copy the authentication token and paste it back.

### Step 4: Install CodeRabbit Plugin in Claude Code
```bash
/plugin install coderabbit
```

### Usage in Claude Code:
```bash
# Review all changes
/coderabbit:review

# Review uncommitted changes
/coderabbit:review uncommitted

# Review against main branch
/coderabbit:review --base master

# Natural language
"Review my code for security issues"
```

---

## Method 3: Quick Win - GitHub Actions (No WSL needed)

### Create GitHub Action Workflow:
File: `.github/workflows/coderabbit-review.yml`

```yaml
name: CodeRabbit Auto-Review
on:
  pull_request:
    branches: [main, master]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: CodeRabbit Review
        uses: coderabbitai/coderabbit-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

This will automatically review PRs without any CLI installation.

---

## What Gets Reviewed (Based on Your .coderabbit.yaml)

### API Routes (`src/app/api/**/*.ts`)
- ✅ Zod validation from `src/lib/validation.ts`
- ✅ SSRF protection (no localhost/private IPs)
- ✅ SQL injection prevention
- ✅ Proper error handling
- ✅ Winston logging (no sensitive data)

### Backend (`backend/**/*.js`)
- ✅ WebSocket authentication
- ✅ Message validation
- ✅ Resource cleanup
- ✅ Rate limiting

### SQL Files (`**/*.sql`)
- ✅ SQL injection risks
- ✅ Index optimization
- ✅ RLS policies
- ✅ Performance with 100K+ rows

### Tests (`tests/**/*.test.ts`)
- ✅ Coverage >70%
- ✅ Edge cases
- ✅ Error conditions
- ✅ Clear assertions

### Security Headers (`src/middleware.ts`)
- ✅ CSP configuration
- ✅ CORS settings
- ✅ HSTS in production
- ✅ X-Frame-Options

---

## Next Steps

### Option A: Quick Start (5 minutes)
1. Go to https://github.com/marketplace/coderabbitai
2. Install on your repo
3. Create a test PR to see CodeRabbit in action

### Option B: Full Integration (30 minutes)
1. Install WSL
2. Install CodeRabbit CLI
3. Install Claude Code plugin
4. Run `/coderabbit:review` for autonomous AI workflow

### Option C: CI/CD (10 minutes)
1. Create `.github/workflows/coderabbit-review.yml`
2. Push to GitHub
3. PRs get auto-reviewed

---

## Testing CodeRabbit

### Create a Test PR:
```bash
git checkout -b test-coderabbit
echo "// TODO: Add input validation" >> src/app/api/test/route.ts
git add .
git commit -m "Test CodeRabbit integration"
git push -u origin test-coderabbit
```

Then create a PR on GitHub and watch CodeRabbit review it!

---

## Cost

- **Free Tier**: Up to 500 lines of code reviewed/month
- **Pro**: $12/month for unlimited reviews
- **Team**: $39/month for multiple users

Your quantum-kuiper project is ~5,000 lines, so you'll likely want Pro if doing frequent PRs.

---

## Questions?

Visit https://docs.coderabbit.ai for full documentation.
