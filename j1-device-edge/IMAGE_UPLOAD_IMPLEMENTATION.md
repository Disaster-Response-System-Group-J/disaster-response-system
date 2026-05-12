## J1 Image Upload Implementation - Summary of Changes

All changes are contained within the `j1-device-edge` folder only. No modifications outside J1. No DB changes required.

### Backend Changes (j1-device-edge/backend)

#### 1. **requirements.txt** — Added dependencies
- `httpx==0.24.1` — Async HTTP client for downloading remote images
- `python-multipart==0.0.6` — For multipart/form-data file handling

#### 2. **app/config.py** — New Supabase configuration settings
Added environment variables:
- `SUPABASE_URL` — Supabase project URL (e.g., https://project-ref.supabase.co)
- `SUPABASE_SERVICE_KEY` — Service role API key (for backend uploads)
- `SUPABASE_REPORTS_BUCKET` — Bucket name (default: "reports")
- `SUPABASE_MAX_UPLOAD_SIZE` — Max file size in bytes (default: 5 MB)

#### 3. **app/supabase_storage.py** — NEW: Supabase upload helper
Implements:
- `upload_bytes_as_public_url()` — Async function to upload raw bytes to Supabase Storage
- Content-type validation (only image/* allowed)
- File size validation
- Safe filename generation (UUID + original extension)
- Returns public Supabase URL or None on failure
- Logs all upload successes/failures

#### 4. **app/routes/upload.py** — NEW: Image upload endpoint
Implements:
- `POST /api/v1/upload` — Accepts multipart/form-data with file(s)
- Returns JSON: `{ "success": true, "data": { "urls": [...] } }`
- Multiple file upload support
- Graceful error handling (continues on individual file failures)
- Validates MIME types and file sizes

#### 5. **app/routes/events.py** — Updated event ingest to transform payloads
Key behavior:
- Receives events with `payload.images` (local device paths from mobile)
- Transforms `payload.images` → `payload.mediaUrls` before Kafka forwarding
- Handles three types of image references:
  1. **HTTP(S) URLs** — Downloads remote image and re-uploads to Supabase
  2. **Data URIs** — Decodes base64 and uploads to Supabase
  3. **Local device paths** — Skipped with logging (cannot access from bridge)
- Preserves existing `mediaUrl`/`mediaUrls` if already present
- Removes `payload.images` before sending to Kafka (ensures only URLs in Kafka)
- Logs transformation results and any upload errors
- Does NOT block Kafka forwarding on upload failures (resilient)

#### 6. **app/main.py** — Updated app router
- Added import and router include for new upload.py module
- Upload endpoint now available at `/api/v1/upload`

### Mobile App Changes (j1-device-edge/mobile_app)

#### 1. **pubspec.yaml** — Added dependency
- `image_picker: ^1.1.2` — Flutter plugin for picking images from device gallery/camera

#### 2. **lib/utills/constants.dart** — Fixed upload endpoint constant
- Changed `apiUploadEndpoint` from `apiIngestEndpoint` to `/api/v1/upload`
- Now correctly points to the new upload endpoint

#### 3. **lib/services/image_upload_service.dart** — NEW: Image upload service
Implements:
- `uploadImages(List<File> imageFiles)` — Async function to upload files to bridge
- Uses multipart/form-data to send multiple files
- Returns list of public Supabase URLs
- Gracefully handles network errors and timeouts (returns empty list on failure)
- Logs upload progress and results

#### 4. **lib/screens/data_report_form.dart** — Fully implemented image picker and upload
Changes:
- Added `import 'package:image_picker/image_picker.dart'`
- Changed from `List<String> _selectedImages` to `List<File> _selectedImageFiles`
- Added `List<String> _uploadedImageUrls` for tracking uploaded URLs
- Added `_uploading` state flag
- Implemented `_pickImages()` method:
  - Uses ImagePicker to select multiple images from gallery
  - Compresses images (max 1200x1200, 85% quality)
  - Shows success message with count
  - Handles picker errors gracefully
- Updated `_submit()` method:
  - Calls `ImageUploadService.uploadImages()` with selected files
  - Includes upload progress in UI ("Uploading...")
  - Adds uploaded URLs to payload as `mediaUrls` key
  - Shows warning if upload fails (but allows submit without images)
  - Includes mediaUrls in payload only if URLs exist
- Updated UI:
  - Upload button now shows "Uploading..." state
  - Image preview shows actual image thumbnail (not placeholder icon)
  - Submit button shows upload state
  - Shows selected image count in feedback message

### Flow Overview

```
Mobile App (Flutter)
    ↓
1. User picks images in Data Report form
2. User taps "Submit Data Report"
    ↓
   [ImageUploadService.uploadImages(files)]
    ↓
   POST /api/v1/upload (multipart/form-data)
    ↓
J1 Bridge API (/api/v1/upload)
    ↓
3. For each file: validate MIME, size; generate UUID filename
4. Upload to Supabase Storage (reports bucket)
5. Return public URLs
    ↓
   Response: { "success": true, "data": { "urls": ["https://..."] } }
    ↓
Mobile App
    ↓
6. Include URLs in payload as "mediaUrls"
7. Queue event via OfflineQueueManager (with mediaUrls, no local paths)
    ↓
8. SyncService sends event to bridge
    ↓
J1 Bridge API (/api/v1/events/ingest)
    ↓
9. Transform payload.images → payload.mediaUrls
   (handles remote URLs, data URIs, local paths)
10. Remove payload.images field
11. Produce to Kafka
    ↓
Kafka j1.events topic
    ↓
J2 / J3 consumers
    ↓
12. J2 extracts mediaUrl(s) and stores in DB
13. J3 receives mediaUrls and displays images in UI
```

### Environment Setup Required

You must set these environment variables for the J1 bridge backend:

```bash
# In your docker-compose.yml or .env file for the j1-bridge-api service:

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_REPORTS_BUCKET=reports
SUPABASE_MAX_UPLOAD_SIZE=5242880  # 5 MB in bytes
```

### Supabase Configuration Steps

1. **Create Supabase project** (or use existing)
2. **Create bucket "reports"**
   - Go to Storage in Supabase dashboard
   - Create bucket named "reports"
   - Set visibility to "Public" (or use signed URLs for private storage)
3. **Get Service Role Key**
   - Go to Project Settings → API
   - Copy the "service_role" key (not anon key)
   - Set as `SUPABASE_SERVICE_KEY` env var

### Testing Commands

#### 1. Upload images directly to bridge
```bash
curl -F "files=@./image1.jpg" \
  -F "files=@./image2.png" \
  http://localhost:8000/api/v1/upload
```

Response:
```json
{
  "success": true,
  "data": {
    "urls": [
      "https://project.supabase.co/storage/v1/object/public/reports/abc123.jpg",
      "https://project.supabase.co/storage/v1/object/public/reports/def456.png"
    ]
  }
}
```

#### 2. Send event with mediaUrls
```bash
curl -X POST http://localhost:8000/api/v1/events/ingest \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: uuid-123" \
  -d '{
    "eventId": "uuid-123",
    "eventType": "DATA_REPORT",
    "timestamp": "2026-05-12T12:00:00Z",
    "userId": "user1",
    "deviceId": "device1",
    "payload": {
      "description": "Flood damage",
      "mediaUrl": "https://example.com/image.jpg",
      "latitude": 6.9271,
      "longitude": 80.7789
    }
  }'
```

J1 will normalize and forward to Kafka with transformed payload.

#### 3. Build and run mobile app
```bash
cd j1-device-edge/mobile_app
flutter pub get
flutter run
```

### Key Features

✅ **Image Picker** — Flutter UI to select multiple images from device  
✅ **Automatic Upload** — Images uploaded to Supabase before event submission  
✅ **Public URLs** — Returned URLs are directly accessible via Supabase CDN  
✅ **Payload Transformation** — Bridge converts local paths → public URLs  
✅ **Resilient** — Failed uploads don't block event submission  
✅ **Backward Compatible** — Existing mediaUrl/mediaUrls fields preserved  
✅ **Validation** — MIME type and file size checks  
✅ **Logging** — All operations logged for debugging  
✅ **No Downstream Changes** — J2/J3 work unchanged with existing mediaUrl(s) fields  

### Limitations & Notes

- Mobile app currently uploads via bridge. For direct-to-Supabase uploads (presign flow), additional mobile-side changes would be needed (not implemented per requirements).
- Local device image paths (from older mobile versions) are skipped by bridge with logging; these are not accessible from the server.
- Service role key must be kept secure and used server-side only.
- Images are stored in Supabase public bucket; if privacy is needed, use signed URLs (requires additional Supabase config).
- Maximum upload size configurable via `SUPABASE_MAX_UPLOAD_SIZE` env var (default 5 MB).

### Files Modified/Created

**Backend (app/)**
- ✅ Created: `app/supabase_storage.py`
- ✅ Created: `app/routes/upload.py`
- ✅ Modified: `app/config.py`
- ✅ Modified: `app/routes/events.py`
- ✅ Modified: `app/main.py`
- ✅ Modified: `requirements.txt`

**Mobile (lib/)**
- ✅ Created: `lib/services/image_upload_service.dart`
- ✅ Modified: `lib/screens/data_report_form.dart`
- ✅ Modified: `lib/utills/constants.dart`
- ✅ Modified: `pubspec.yaml`

**No changes outside j1-device-edge folder**
- ✅ J2 unchanged
- ✅ J3 unchanged
- ✅ No database migrations required
