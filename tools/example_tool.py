#!/usr/bin/env python3
"""
Example Tool - Demonstrates WAT framework tool structure

This is a template showing best practices for building tools.

Usage:
    python example_tool.py <input_text> [--output <file>]

Example:
    python example_tool.py "Hello World" --output .tmp/result.txt
"""

import os
import sys
import argparse
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()


def process_text(text: str) -> str:
    """
    Process input text (example transformation).

    Args:
        text: Input text to process

    Returns:
        Processed text
    """
    # Example: Convert to uppercase and add metadata
    result = f"PROCESSED: {text.upper()}"
    return result


def save_output(content: str, filepath: str) -> None:
    """
    Save content to file.

    Args:
        content: Text content to save
        filepath: Destination file path
    """
    # Ensure directory exists
    os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else '.', exist_ok=True)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"[SUCCESS] Output saved to: {filepath}")


def main():
    """Main execution function"""
    parser = argparse.ArgumentParser(
        description='Example tool demonstrating WAT framework patterns'
    )
    parser.add_argument(
        'input_text',
        help='Text to process'
    )
    parser.add_argument(
        '--output',
        '-o',
        help='Output file path (default: print to stdout)'
    )

    args = parser.parse_args()

    try:
        # Process the input
        result = process_text(args.input_text)

        # Output result
        if args.output:
            save_output(result, args.output)
        else:
            print(result)

        # Success
        return 0

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
