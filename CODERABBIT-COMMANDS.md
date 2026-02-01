# 🤖 How to Ask CodeRabbit for Reports

## 📊 Getting Issue Reports from CodeRabbit

### Method 1: Automatic Report (Happens by Default)
When you create a PR, CodeRabbit **automatically posts** a comprehensive report within 60 seconds:
- Summary of all issues found
- Severity levels (Critical, Warning, Info)
- Line-by-line comments
- Suggested fixes

**You don't need to ask - it just appears!**

---

## 💬 Method 2: Using @coderabbitai Commands in PR Comments

After creating your PR, you can comment with these commands:

### Get Full Report:
```
@coderabbitai summary
```
**Returns:** High-level summary of all changes and issues

### Get Security Report:
```
@coderabbitai review --focus security
```
**Returns:** Security-focused analysis (SSRF, XSS, SQL injection, etc.)

### Get Performance Report:
```
@coderabbitai review --focus performance
```
**Returns:** Performance issues and optimization suggestions

### Review Specific File:
```
@coderabbitai review src/app/api/test-coderabbit/route.ts
```
**Returns:** Detailed review of that specific file

### Ask Questions:
```
@coderabbitai what security issues are in this PR?
```
**Returns:** Natural language explanation of security problems

### Request Changes Summary:
```
@coderabbitai what needs to be fixed?
```
**Returns:** Prioritized list of issues to address

### Get Test Coverage Report:
```
@coderabbitai analyze test coverage
```
**Returns:** Test quality and coverage analysis

---

## 📝 Example Conversation in PR Comments

### You comment:
```
@coderabbitai summary
```

### CodeRabbit responds:
```
## Summary
This PR adds test endpoints with the following issues:

### 🔴 Critical Issues (3)
1. SSRF vulnerability at line 18 - Unvalidated URL fetching
2. XSS vulnerability at line 52 - Unsanitized user input
3. Sensitive data logging at line 26 - Password in logs

### 🟡 Warnings (4)
1. Missing input validation - No Zod schema usage
2. Race condition at lines 31-34 - Non-transactional update
3. Poor error handling at line 41 - Stack trace exposure
4. Missing authentication check - No auth on endpoints

### 🔵 Suggestions (2)
1. Add test coverage for error cases
2. Fix flaky async test at line 11

**Recommendation:** Address critical issues before merging.
```

---

## 🎯 Specific Report Requests

### For Your Test PR, Ask:

#### 1. Get Security Report:
```
@coderabbitai review --focus security
```

#### 2. Get All Issues List:
```
@coderabbitai list all issues with severity levels
```

#### 3. Get Fix Recommendations:
```
@coderabbitai how do I fix the SSRF vulnerability?
```

#### 4. Compare with Best Practices:
```
@coderabbitai compare this code with our validation.ts patterns
```

#### 5. Get Test Quality Report:
```
@coderabbitai review tests/coderabbit-demo.test.ts --focus quality
```

---

## 📊 Advanced Report Commands

### Generate Issue Summary Table:
```
@coderabbitai create a table of all issues with:
- Issue type
- Severity
- File location
- Recommended fix
```

### Get Code Quality Score:
```
@coderabbitai rate this PR's code quality
```

### Get Architecture Review:
```
@coderabbitai does this follow our 3-tier RAG architecture?
```

### Get Performance Analysis:
```
@coderabbitai will this meet our <100ms Q&A performance target?
```

---

## 🔄 Re-Review After Fixes

After you fix issues, ask CodeRabbit to verify:

```
@coderabbitai review changes since last commit
```

Or:

```
@coderabbitai verify all security issues are fixed
```

---

## 📋 Getting Reports in Different Formats

### As Checklist:
```
@coderabbitai create a checklist of items to fix
```

### As Priority List:
```
@coderabbitai prioritize issues by severity
```

### As JSON Report:
```
@coderabbitai export issues as structured data
```

---

## 🎓 Best Practices for Asking CodeRabbit

### ✅ Good Requests:
```
@coderabbitai what security vulnerabilities exist in this PR?
@coderabbitai review the error handling in route.ts
@coderabbitai does this code follow TypeScript best practices?
@coderabbitai explain the SSRF risk and how to fix it
```

### ❌ Avoid:
```
@coderabbitai fix everything (too vague)
@coderabbitai is this good? (yes/no questions)
```

---

## 🚀 Quick Reference Card

| Want to know... | Command |
|-----------------|---------|
| **All issues** | `@coderabbitai summary` |
| **Security issues** | `@coderabbitai review --focus security` |
| **How to fix** | `@coderabbitai what needs to be fixed?` |
| **Specific file** | `@coderabbitai review [filename]` |
| **After fixes** | `@coderabbitai verify fixes` |
| **Performance** | `@coderabbitai review --focus performance` |
| **Test quality** | `@coderabbitai analyze test coverage` |
| **Custom question** | `@coderabbitai [your question]` |

---

## 📍 Where to Use These Commands

### In Pull Request Comments:
1. Go to your PR: https://github.com/manitejakanuri1/quantum-kuiper/pulls
2. Scroll to the comment box at the bottom
3. Type your `@coderabbitai` command
4. Click "Comment"
5. Wait 5-10 seconds for CodeRabbit's response

### In Code Review Comments:
You can also comment on specific lines:
1. Click the "+" next to a line of code
2. Type: `@coderabbitai explain this issue`
3. CodeRabbit will respond with context-specific analysis

---

## 🎯 For Your Test PR - Try These:

After creating the PR, post these comments one by one:

### Comment 1:
```
@coderabbitai summary
```
*See overall report with severity levels*

### Comment 2:
```
@coderabbitai review --focus security
```
*Get detailed security analysis*

### Comment 3:
```
@coderabbitai create a prioritized checklist of fixes needed
```
*Get actionable to-do list*

### Comment 4:
```
@coderabbitai how many critical vs warning vs info issues are there?
```
*Get breakdown by severity*

---

## 💡 Pro Tips

1. **Be specific** - "Review the authentication logic" vs "Is this good?"
2. **Ask follow-ups** - CodeRabbit remembers context in the same PR
3. **Request examples** - "Show me how to fix this with code examples"
4. **Compare patterns** - "Does this follow the pattern in validation.ts?"
5. **Verify fixes** - After pushing changes, ask CodeRabbit to re-review

---

## 🎬 Example Workflow

```
1. Create PR
   ↓
2. Wait 60 seconds (CodeRabbit auto-reviews)
   ↓
3. Comment: "@coderabbitai summary"
   ↓
4. Comment: "@coderabbitai review --focus security"
   ↓
5. Fix issues based on feedback
   ↓
6. Push fixes
   ↓
7. Comment: "@coderabbitai verify all critical issues are resolved"
   ↓
8. Merge when CodeRabbit approves ✅
```

---

## 🔗 After You Create the Test PR:

1. **Go to:** https://github.com/manitejakanuri1/quantum-kuiper/pulls
2. **Open your PR**
3. **Scroll down to comments**
4. **Post:** `@coderabbitai summary`
5. **Watch CodeRabbit respond with a full report!**

---

**Start by creating the PR, then try the commands above! 🚀**
