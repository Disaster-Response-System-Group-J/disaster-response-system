We need to implement image upload support ONLY inside J1 (bridge/backend layer). No changes are allowed in J2, J3, or the mobile app architecture beyond consuming the existing payload structure.

Current situation:
Mobile app currently sends payload.images containing LOCAL DEVICE PATHS.
Kafka bridge forwards payloads unchanged.
Downstream systems expect public image URLs (mediaUrl or ideally mediaUrls).
End-to-end image display does not work because local paths are not accessible outside the device.
Goal:

Implement image upload + URL replacement entirely inside J1 while preserving the existing Kafka flow.

Use Supabase Storage as the object storage backend.

Requirements:
1. Storage Backend

Use:

Supabase Storage

Create a bucket:

reports

Ensure it is configured for public file access OR use signed URLs if needed.

2. J1 Responsibilities

J1 must:

receive the existing payload
inspect payload.images
for each image reference:
attempt to upload image to Supabase Storage
if image is invalid or not accessible, gracefully skip it (do NOT break flow)
3. Upload Endpoint

Add:

POST /upload

Accept:

multipart/form-data

Input:

image file(s)

Output:

Supabase public URL(s)
4. Upload Process (Supabase)

For each image:

generate UUID filename
preserve original file extension
upload to Supabase bucket reports
retrieve public URL from Supabase

Example URL format:

https://<project-ref>.supabase.co/storage/v1/object/public/reports/<file>.jpg
5. Payload Transformation

Replace:

payload.images

WITH:

payload.mediaUrls

Where:

"mediaUrls": [
  "https://...supabase.../file1.jpg"
]
6. Kafka Rule (IMPORTANT)

Kafka messages MUST contain:

ONLY URLs
NO binary data
NO base64 encoding
NO local device paths
7. Backward Compatibility

Ensure:

If mediaUrl exists → keep it unchanged
Also support mediaUrls array (preferred future format)
8. J2 & J3 constraints

Do NOT modify:

J2 (consumer/API layer)
J3 (DB + frontend)
mobile app

All adaptation must happen inside J1 only.

9. DB / Downstream expectation alignment

Downstream systems already support:

mediaUrl
mediaUrls

So J1 must normalize everything into:

mediaUrls (primary)
optionally map single image → array
10. Failure Handling

If upload fails:

log error
continue processing payload
do NOT block Kafka forwarding

System must be resilient.

11. Security / Validation
Validate MIME types (only images)
Reject non-image uploads
Limit file size
Prevent unsafe filenames
12. Logging

J1 must log:

upload success/failure
generated Supabase URLs
payload transformation result
Suggested Flow:

Client
↓
J1 receives payload
↓
Extract images
↓
Upload images to Supabase Storage
↓
Get public URLs
↓
Replace payload.images → payload.mediaUrls
↓
Send to Kafka
↓
J2 consumer processes
↓
J3 stores + UI displays images

Desired Outcome:

Without modifying any downstream services, all uploaded images must become publicly accessible Supabase URLs that:

are stored in Kafka messages
are saved in DB
are rendered correctly in UI via existing mediaUrl/mediaUrls logic