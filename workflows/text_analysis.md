# Text Analysis Workflow

## Objective
Analyze text files to extract statistics and insights (word count, character count, most common words, etc.)

## Required Inputs
- Input text file path
- Optional: Number of top words to show (default: 10)

## Tools Used
- `tools/analyze_text.py` - Analyzes text and generates statistics

## Steps

### 1. Analyze Text File
```bash
python tools/analyze_text.py <input_file> --output .tmp/analysis.json --top-words 10
```
- Reads the input text file
- Counts words, characters, lines
- Identifies most common words
- Saves results to `.tmp/analysis.json`

### 2. Display Results
Results are automatically printed to stdout and saved to JSON for further processing.

## Expected Outputs
- Word count
- Character count
- Line count
- Top N most common words
- Average word length
- JSON file with detailed statistics in `.tmp/`

## Edge Cases

### File Not Found
- **Issue**: Input file doesn't exist
- **Solution**: Tool will show clear error message with file path

### Empty File
- **Issue**: File exists but is empty
- **Solution**: Tool returns zero counts and empty word list

### Large Files
- **Issue**: File is very large (>100MB)
- **Solution**: Tool processes in chunks to avoid memory issues

### Non-text Files
- **Issue**: Binary or unsupported file format
- **Solution**: Tool attempts to read as UTF-8, reports error if fails

## Usage Example

```bash
# Analyze a README file
python tools/analyze_text.py README.md

# Analyze with custom top words count
python tools/analyze_text.py myfile.txt --top-words 20 --output .tmp/stats.json
```

## Notes
- Supports UTF-8 text files
- Case-insensitive word counting
- Punctuation is stripped from words
- Common stop words can be filtered (optional feature)
