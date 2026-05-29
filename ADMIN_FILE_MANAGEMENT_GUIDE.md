# Admin File Management System - Setup & Usage Guide

## 🎯 Overview

The Admin File Management System gives administrators complete control ("god mode") over all user-uploaded files. You can:
- ✅ View all files from all users
- ✅ Search and filter files
- ✅ Access individual user dashboards
- ✅ Download file content with original text and summaries
- ✅ Add admin notes and flag files for review
- ✅ Delete files (soft delete or permanent)
- ✅ View user information and file metadata

---

## 📋 What Was Created

### Database Schema Update
**File model enhancements:**
- `fileSize` - Store file size in bytes
- `textLength` - Store character count
- `adminNotes` - Store admin notes about the file
- `flagged` - Boolean to flag suspicious files
- `downloadedByAdminAt` - Audit trail of admin downloads
- `deletedByAdminAt` - Soft delete timestamp

### API Endpoints

#### 1. List All Files
```bash
GET /api/admin/files?page=1&pageSize=20&search=pdf
```
Returns paginated list of all files with user info.

#### 2. Get File Details
```bash
GET /api/admin/files/[id]
```
Returns complete file information including:
- File content and summary
- User details
- Admin notes and flags
- Video generation status
- Download history

#### 3. Update File Metadata
```bash
PUT /api/admin/files/[id]
Body: { adminNotes: string, flagged: boolean }
```
Update admin notes and flag status.

#### 4. Download File
```bash
GET /api/admin/files/download/[id]
```
Downloads file as JSON with:
- Original text
- Summary
- Owner information
- Download timestamp

#### 5. Delete File
```bash
DELETE /api/admin/files/[id]
Body: { hardDelete: boolean }
```
- `hardDelete: false` - Soft delete (keeps data, marks as deleted)
- `hardDelete: true` - Permanent deletion (removes from database)

#### 6. Get User's Files
```bash
GET /api/admin/users/[userId]/files?page=1&pageSize=20
```
Returns all files for a specific user with:
- User profile information
- Complete file list
- Pagination info

### UI Components

**AdminFilesPanel.tsx** - Complete admin interface with:
- Two views: "All Files" and "User Files"
- Search and filtering
- File details modal
- Admin notes editor
- File flagging
- Download and delete actions
- User information display

---

## 🚀 Setup Instructions

### Step 1: Update Database Schema
```bash
# The schema is already updated in prisma/schema.prisma
# Run migration:
npx prisma migrate dev --name add_admin_file_fields
```

### Step 2: Integrate into Admin Panel
Add to `src/app/admin/page.tsx`:

```typescript
import { AdminFilesPanel } from '@/components/AdminFilesPanel';

// In the FilesTab component, replace with:
function FilesTab() {
  return <AdminFilesPanel />;
}
```

### Step 3: Test the System
1. Start dev server: `npm run dev`
2. Go to admin panel: `/admin`
3. Navigate to "Files & Documents" tab
4. Try viewing all files or accessing a user's files

---

## 💡 How to Use

### View All Files
1. Click "📁 All Files" tab
2. Use search to find files by name
3. Click a file row to see details
4. Use download/delete buttons in hover actions

### Access User Dashboard
1. Click "👤 User Files" tab
2. Enter a user ID
3. Click "Load Files"
4. View all files for that user
5. Click file to see details with options:
   - **Add Admin Notes** - Store notes about the file
   - **Flag for Review** - Mark suspicious files
   - **Download** - Export file content as JSON
   - **Delete** - Remove file from system

### Download Files
- Downloads include original text, summary, and owner info
- Automatically saved as JSON
- Tracks download timestamp for audit trail

### Delete Files
- Default: Soft delete (data preserved in database)
- Harddelete option: Permanent removal
- Deleted files excluded from normal queries
- Audit trail maintained

### Flag Files
- Mark suspicious or problematic files
- Add context in admin notes
- Flagged files display warning badge (⚠️)

---

## 🔒 Security & Permissions

### Authorization
All endpoints require admin authentication (enforced by existing middleware).

### Audit Trail
The system tracks:
- When admin downloads files
- When files are deleted or modified
- Admin notes for context

### Data Protection
- Soft deletes preserve data for audit
- No credentials exposed in file exports
- Email addresses visible only in admin interface

---

## 📊 API Examples

### Fetch All Files
```javascript
const response = await fetch('/api/admin/files?page=1&pageSize=20&search=contract');
const { data } = await response.json();
console.log(data.items); // Array of files
console.log(data.total); // Total count
```

### Get File Details
```javascript
const response = await fetch('/api/admin/files/file_id_here');
const { data } = await response.json();
console.log(data.fileName);
console.log(data.summary);
console.log(data.owner); // User who uploaded
```

### Add Admin Notes
```javascript
const response = await fetch('/api/admin/files/file_id_here', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    adminNotes: 'Suspicious content - potential copyright violation',
    flagged: true
  })
});
```

### Download File
```javascript
const response = await fetch('/api/admin/files/download/file_id_here');
const data = await response.json();
// data contains: fileName, owner, downloadedAt, content
```

### Delete File
```javascript
const response = await fetch('/api/admin/files/file_id_here', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ hardDelete: false }) // soft delete
});
```

### Get User's Files
```javascript
const response = await fetch('/api/admin/users/user_id_here/files?page=1&pageSize=20');
const { data } = await response.json();
console.log(data.user); // User info
console.log(data.files); // Array of files
console.log(data.pagination); // Page info
```

---

## 🎨 UI Features

### File List View
- **File Name** - Truncated with tooltip
- **Owner Info** - User name and email
- **Size** - Human-readable format
- **Media Icons** - Shows 🔊 for audio, 🎬 for video
- **Flag Status** - ⚠️ for flagged files
- **Actions** - Download, delete (appears on hover)

### File Details Panel
- **Summary Preview** - First 500 characters
- **Admin Notes** - Editable textarea
- **Flagging** - Checkbox to flag
- **User Info** - Complete uploader details
- **Timestamps** - Created and updated times
- **Action Buttons** - Download, Delete, Save Notes

### User Dashboard View
- **User Card** - Shows name, email, credits, total files
- **Files Table** - All files with filters
- **File Details** - Click to expand and manage
- **Pagination** - Navigate through file lists

---

## 📈 Use Cases

### Content Moderation
1. Search for problematic content
2. View file with admin notes section
3. Flag file and add moderation notes
4. Download for external review if needed

### User Support
1. Enter user ID
2. View all their files and uploads
3. Add notes about support tickets
4. Help troubleshoot file processing issues

### Compliance & Audit
1. Download files as JSON for records
2. Track who accessed what files
3. View audit trail of deletions
4. Maintain compliance records

### Data Management
1. Soft delete unused files
2. Recover deleted files if needed
3. Monitor storage usage per user
4. Track file processing success

---

## 🔧 Troubleshooting

### Files not showing
- Check database has been migrated
- Verify user has uploaded files
- Check pagination (page, pageSize parameters)

### Download failing
- Verify file exists in database
- Check browser download settings
- File should save as JSON automatically

### Can't add notes
- Ensure admin role is active
- Check network request in DevTools
- Verify user ID is correct

---

## 📝 Database Query Examples

### Get all flagged files
```sql
SELECT * FROM File WHERE flagged = true;
```

### Get files by user
```sql
SELECT * FROM File WHERE userId = 'user_id' AND deletedByAdminAt IS NULL;
```

### Find recently deleted files
```sql
SELECT * FROM File WHERE deletedByAdminAt IS NOT NULL ORDER BY deletedByAdminAt DESC;
```

### Get downloads by admin
```sql
SELECT * FROM File WHERE downloadedByAdminAt IS NOT NULL;
```

---

## 🎓 Next Steps

1. ✅ Update Prisma schema (done)
2. ✅ Create API endpoints (done)
3. ✅ Build React component (done)
4. **→ Run migration**: `npx prisma migrate dev`
5. **→ Integrate into admin page**: Update FilesTab
6. **→ Test endpoints**: Use cURL or API client
7. **→ Deploy**: Push to production

---

## 📞 Support

- **API Endpoints**: See `/api/admin/files/` directory
- **UI Component**: `src/components/AdminFilesPanel.tsx`
- **Type Definitions**: Check `src/types/admin.ts`

All endpoints are fully documented with comments in source code.
