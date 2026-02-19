# Workflows Directory

This directory contains workflow definitions - markdown-based Standard Operating Procedures (SOPs) that define what needs to be done and how.

## Workflow Structure

Each workflow should include:

1. **Objective** - What this workflow accomplishes
2. **Required Inputs** - What information/data is needed to start
3. **Tools Used** - Which tools from `/tools` this workflow uses
4. **Steps** - Clear, sequential instructions
5. **Expected Outputs** - What gets produced
6. **Edge Cases** - How to handle errors and unusual situations

## Example Workflow Template

```markdown
# Workflow Name

## Objective
Brief description of what this workflow accomplishes.

## Required Inputs
- Input 1: description
- Input 2: description

## Tools Used
- `tools/script_name.py` - what it does

## Steps
1. First step
2. Second step
3. Third step

## Expected Outputs
- Output 1: where it goes
- Output 2: where it goes

## Edge Cases
- **Issue**: How to handle
- **Error**: Recovery steps
```

## Best Practices

- Keep workflows focused on one clear objective
- Update workflows when you discover better approaches
- Document rate limits, timing issues, and API quirks
- Reference actual tool filenames
- Write for future use - assume someone else will run this
