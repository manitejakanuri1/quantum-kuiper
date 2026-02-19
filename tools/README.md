# Tools Directory

This directory contains Python scripts that perform deterministic execution. Tools are called by the agent based on workflow instructions.

## Tool Guidelines

### What Makes a Good Tool

1. **Single Responsibility** - Each tool does one thing well
2. **Deterministic** - Same inputs always produce same outputs
3. **Error Handling** - Clear error messages and graceful failures
4. **Configuration** - Uses `.env` for API keys and credentials
5. **Documentation** - Clear docstrings and usage examples

### Tool Template

```python
#!/usr/bin/env python3
"""
Tool Name - Brief description

Usage:
    python tool_name.py <arg1> <arg2>

Example:
    python tool_name.py input.txt output.txt
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def main():
    """Main execution function"""
    try:
        # Tool logic here
        pass
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
```

### Best Practices

- Use argparse for command-line arguments
- Load API keys from environment variables
- Write output files to `.tmp/` directory
- Include helpful error messages
- Return non-zero exit codes on failure
- Log progress for long-running operations

### Common Patterns

**API Integration**
- Handle rate limiting gracefully
- Retry with exponential backoff
- Cache responses when appropriate

**Data Processing**
- Validate inputs before processing
- Use streaming for large files
- Save intermediate results

**File Operations**
- Use absolute paths
- Check if files exist before reading
- Clean up temporary files
