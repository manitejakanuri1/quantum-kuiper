# Example Workflow - Data Processing Pipeline

## Objective
Demonstrate the WAT framework structure with a simple data processing example.

## Required Inputs
- Source data file path or URL
- Target format (csv, json, etc.)
- Output destination (file path or cloud service)

## Tools Used
- `tools/fetch_data.py` - Downloads or reads data from source
- `tools/transform_data.py` - Converts data to target format
- `tools/upload_output.py` - Saves result to destination

## Steps

### 1. Fetch Source Data
```bash
python tools/fetch_data.py <source> .tmp/raw_data.json
```
- If URL: Downloads and saves to `.tmp/`
- If file path: Copies to `.tmp/` for processing
- Validates data format and size

### 2. Transform Data
```bash
python tools/transform_data.py .tmp/raw_data.json .tmp/processed_data.csv --format csv
```
- Reads from `.tmp/raw_data.json`
- Applies transformations
- Outputs to `.tmp/processed_data.csv`

### 3. Upload Output
```bash
python tools/upload_output.py .tmp/processed_data.csv <destination>
```
- If Google Sheets: Uses OAuth to upload
- If file path: Copies to destination
- Returns shareable link or file path

## Expected Outputs
- Processed data file in target format
- Location/URL of final output
- Processing summary (rows processed, errors encountered)

## Edge Cases

### Source Data Unavailable
- **Issue**: URL returns 404 or file doesn't exist
- **Solution**: Report clear error, suggest checking source path

### Format Conversion Fails
- **Issue**: Data structure incompatible with target format
- **Solution**: Log specific conversion errors, suggest alternative formats

### Upload Rate Limited
- **Issue**: API returns rate limit error
- **Solution**: Wait and retry with exponential backoff (implemented in tool)

### Large Files
- **Issue**: Data file exceeds memory limits
- **Solution**: Use streaming processing in transform tool

## Notes
- All intermediate files saved to `.tmp/` are automatically cleaned up
- API keys for upload services stored in `.env`
- This is a template - adapt for specific use cases
