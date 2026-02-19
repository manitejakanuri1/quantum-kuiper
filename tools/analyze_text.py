#!/usr/bin/env python3
"""
Text Analysis Tool - Analyzes text files for statistics and insights

Usage:
    python analyze_text.py <input_file> [--output <file>] [--top-words N]

Example:
    python analyze_text.py README.md --output .tmp/stats.json --top-words 10
"""

import os
import sys
import json
import argparse
from collections import Counter
from dotenv import load_dotenv

# Fix Windows console encoding
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Load environment variables
load_dotenv()


def analyze_text(filepath: str, top_n: int = 10) -> dict:
    """
    Analyze a text file and return statistics.

    Args:
        filepath: Path to text file
        top_n: Number of top words to return

    Returns:
        Dictionary with text statistics
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")

    # Read file
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    # Basic counts
    lines = content.split('\n')
    words = content.split()

    # Clean words (remove punctuation, convert to lowercase)
    cleaned_words = []
    for word in words:
        # Remove punctuation from start and end
        cleaned = word.strip('.,!?;:"()[]{}').lower()
        if cleaned:  # Only add non-empty words
            cleaned_words.append(cleaned)

    # Calculate statistics
    total_chars = len(content)
    total_words = len(cleaned_words)
    total_lines = len(lines)

    # Most common words
    word_counts = Counter(cleaned_words)
    top_words = word_counts.most_common(top_n)

    # Average word length
    avg_word_length = sum(len(word) for word in cleaned_words) / total_words if total_words > 0 else 0

    return {
        'file': filepath,
        'statistics': {
            'total_characters': total_chars,
            'total_words': total_words,
            'total_lines': total_lines,
            'unique_words': len(word_counts),
            'average_word_length': round(avg_word_length, 2)
        },
        'top_words': [
            {'word': word, 'count': count}
            for word, count in top_words
        ]
    }


def save_output(data: dict, filepath: str) -> None:
    """
    Save analysis results to JSON file.

    Args:
        data: Analysis results dictionary
        filepath: Destination file path
    """
    # Ensure directory exists
    os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else '.', exist_ok=True)

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

    print(f"[SUCCESS] Analysis saved to: {filepath}")


def print_results(data: dict) -> None:
    """Print analysis results in a readable format."""
    print("\n" + "="*60)
    print(f"TEXT ANALYSIS: {data['file']}")
    print("="*60)

    stats = data['statistics']
    print(f"\nStatistics:")
    print(f"  Total Characters: {stats['total_characters']:,}")
    print(f"  Total Words:      {stats['total_words']:,}")
    print(f"  Total Lines:      {stats['total_lines']:,}")
    print(f"  Unique Words:     {stats['unique_words']:,}")
    print(f"  Avg Word Length:  {stats['average_word_length']}")

    print(f"\nTop {len(data['top_words'])} Most Common Words:")
    for i, item in enumerate(data['top_words'], 1):
        print(f"  {i:2d}. {item['word']:20s} ({item['count']:,} times)")

    print("="*60 + "\n")


def main():
    """Main execution function"""
    parser = argparse.ArgumentParser(
        description='Analyze text files for statistics and insights'
    )
    parser.add_argument(
        'input_file',
        help='Text file to analyze'
    )
    parser.add_argument(
        '--output',
        '-o',
        help='Output JSON file path (optional)'
    )
    parser.add_argument(
        '--top-words',
        '-t',
        type=int,
        default=10,
        help='Number of top words to show (default: 10)'
    )

    args = parser.parse_args()

    try:
        # Analyze the text
        results = analyze_text(args.input_file, args.top_words)

        # Print results to console
        print_results(results)

        # Save to file if requested
        if args.output:
            save_output(results, args.output)

        return 0

    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
