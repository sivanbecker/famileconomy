# Known Issues

## CAL XLSX Import Fails with ExcelJS Multipart Buffer

**Status:** Open
**Impact:** CAL users must use CSV import; XLSX import returns 422 FORMAT_MISMATCH error
**Affected Component:** `apps/api/src/lib/parsers/cal-xlsx-parser.ts`

### Symptoms

When uploading a valid CAL XLSX file via the import modal, the API returns:

```json
{
  "statusCode": 422,
  "error": "FORMAT_MISMATCH",
  "message": "הקובץ אינו תואם לספק שנבחר."
}
```

Internally, ExcelJS fails with:

```
Cannot read properties of undefined (reading 'sheets')
```

### Root Cause

ExcelJS v4.4.0 fails to parse CAL XLSX files when loaded from a multipart form buffer. The error originates inside ExcelJS's internal ZIP parsing logic. This is **not** a file format issue:

- ✅ The file is valid XLSX (correct magic bytes `0x504b`)
- ✅ Loading the same file directly in Node.js with ExcelJS works
- ✅ MAX XLSX files load successfully via the same multipart route
- ❌ Only CAL XLSX fails when coming from multipart form data

The difference suggests one of:

1. CAL XLSX has specific internal structure (macros, merged cells, XML ordering) that ExcelJS's multipart handler struggles with
2. Version incompatibility between ExcelJS and the CAL export format
3. Buffer state/mutation issue when passing through multipart parser

### Workaround

- **For MAX cards:** Use XLSX import (default option in modal) ✅ Works
- **For CAL cards:** Use CSV import (alternative option in modal) ✅ Works

### How to Fix

1. **Test ExcelJS versions:** Try upgrading/downgrading to find a compatible version
2. **Alternative library:** Evaluate `node-xlsx`, `xlsx-populated`, or other XLSX parsers
3. **Pre-processing:** Convert XLSX → CSV server-side before parsing
4. **Buffer inspection:** Add OpenTelemetry spans to ExcelJS internals to find exact failure point
5. **File preprocessing:** Validate/reconstruct XLSX structure before handing to ExcelJS

### Testing

The CAL XLSX parser has 12 passing unit tests (fixtures with synthesized XLSX files), proving the parser logic is correct. The issue is specific to real-world files coming through the multipart upload route.

Files are located in:

- `examples/Copy of cal-may-2026-20260512175218-4033.xlsm` — real CAL file that fails
- `apps/api/src/__tests__/cal-xlsx-parser.test.ts` — unit tests (12 passing)
