# Baby Activity Sync API - Updated Documentation

This document describes the updated API endpoints for syncing baby activity data with **Offline-first + Soft Delete** support.

## Overview

The Baby Activity Sync API now supports:
1. **Offline-first**: Data is stored locally and synced when online
2. **Soft Delete**: Deleted items are marked with `deleted_at` instead of being removed
3. **Conflict Resolution**: Server `updatedAt` is the canonical time source
4. **Transactional Sync**: All-or-nothing sync operations

---

## Schema Changes

### Baby Activity (`baby-activities`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| local_id | String | Yes | Client-generated UUID for deduplication |
| type | Enum | Yes | `feeding`, `sleep`, `pee`, `poop`, `weight`, `solid` |
| timestamp | DateTime | Yes | When the activity occurred |
| data | JSON | Yes | Activity-specific data |
| baby_profile | Relation | Yes | Which baby this activity belongs to |
| user | Relation | Yes | Owner user |
| synced_at | DateTime | No | Server timestamp when synced |
| **deleted_at** | DateTime | No | **NEW:** Soft delete timestamp (null = active) |
| **client_updated_at** | DateTime | No | **NEW:** Client's update time for conflict detection |

---

## Sync Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         OFFLINE-FIRST SYNC FLOW                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [Phone A]                    [Server]                    [iPad B]       │
│                                                                          │
│  1. User deletes Activity A                                              │
│     ↓                                                                    │
│  Mark in MMKV:                                                           │
│  deleted_at: "2024-01-15T10:00:00Z"                                      │
│     ↓                                                                    │
│  2. POST /sync ────────────────→ 3. Upsert in DB                         │
│     {activities: [A]}              deleted_at = timestamp                │
│                                    updatedAt = now()                     │
│                                         │                                │
│                                         ↓                                │
│                              4. GET /sync?since=... ←──── 5. iPad syncs  │
│                                         │                                │
│                                         ↓                                │
│                              6. Returns Activity A                       │
│                                 (with deleted_at)                        │
│                                         │                                │
│                                         ↓                                │
│                              7. iPad sees deleted_at ────→ Remove from   │
│                                                            UI & local DB │
│                                                                          │
│  Result: Data synchronized perfectly across devices                      │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### 1. Pull Sync - GET /api/baby-activities/sync

**Purpose:** Retrieve activities updated after a specific time (including soft-deleted records).

```http
GET /api/baby-activities/sync?baby_profile_id=<documentId>&since=<ISO_timestamp>&limit=500&offset=0
Authorization: Bearer <token>
```

**Query Parameters:**
| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| baby_profile_id | Yes | - | Document ID of the baby profile |
| since | No | - | ISO timestamp - get activities updated after this time |
| limit | No | 500 | Max items per request (max 500) |
| offset | No | 0 | Pagination offset |

**⚠️ IMPORTANT:** Response includes ALL records, including soft-deleted ones (`deleted_at IS NOT NULL`), so clients can sync deletions.

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "documentId": "abc123",
      "local_id": "uuid-from-client",
      "type": "feeding",
      "timestamp": "2024-01-15T08:00:00.000Z",
      "data": { "amountMl": 120, "feedingType": "bottle" },
      "synced_at": "2024-01-15T10:00:00.000Z",
      "deleted_at": null,
      "client_updated_at": "2024-01-15T09:59:00.000Z",
      "createdAt": "2024-01-15T08:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    },
    {
      "id": 2,
      "documentId": "def456",
      "local_id": "uuid-deleted",
      "type": "sleep",
      "timestamp": "2024-01-14T20:00:00.000Z",
      "data": { "sleepType": "night" },
      "synced_at": "2024-01-15T10:00:00.000Z",
      "deleted_at": "2024-01-15T09:00:00.000Z",  // ← Soft deleted
      "client_updated_at": "2024-01-15T08:59:00.000Z",
      "createdAt": "2024-01-14T20:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "offset": 0,
      "limit": 500,
      "total": 2,
      "hasMore": false
    },
    "serverTime": "2024-01-15T12:00:00.000Z",
    "lastSyncedAt": "2024-01-15T12:00:00.000Z"
  }
}
```

### 2. Push Sync - POST /api/baby-activities/sync

**Purpose:** Bulk upsert activities with transactional safety.

```http
POST /api/baby-activities/sync
Authorization: Bearer <token>
Content-Type: application/json

{
  "baby_profile_id": "abc123",
  "activities": [
    {
      "local_id": "uuid-1",
      "type": "feeding",
      "timestamp": "2024-01-15T08:00:00.000Z",
      "data": { "amountMl": 120, "feedingType": "bottle" },
      "client_updated_at": "2024-01-15T09:59:00.000Z"
    },
    {
      "local_id": "uuid-2",
      "type": "sleep",
      "timestamp": "2024-01-14T20:00:00.000Z",
      "data": { "sleepType": "night" },
      "deleted_at": "2024-01-15T09:00:00.000Z"  // ← Mark as deleted
    }
  ]
}
```

**Features:**
- ✅ **Database Transaction**: All changes are atomic (all succeed or all rollback)
- ✅ **Upsert Logic**: Creates new or updates existing based on `local_id`
- ✅ **Soft Delete**: Respects `deleted_at` field
- ✅ **Server Time**: Overwrites `updatedAt` with server time for consistency

**Response (Success):**
```json
{
  "success": true,
  "created": 1,
  "updated": 0,
  "softDeleted": 1,
  "syncedAt": "2024-01-15T12:00:00.000Z"
}
```

**Response (Validation Error - 400):**
```json
{
  "message": "Validation failed",
  "errors": [
    { "index": 0, "local_id": "uuid-1", "error": "amountMl must be a non-negative number" }
  ]
}
```

**Response (Transaction Failed - 500):**
```json
{
  "message": "Failed to sync activities. Transaction rolled back.",
  "error": "Database error message"
}
```

---

## Database Indexing (PostgreSQL)

For optimal sync performance, add these indexes:

```sql
-- 1. Index on user link table (critical for sync)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_baby_activities_user_updated 
ON baby_activities_user_lnk(user_id);

-- 2. Index on updated_at for sync queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_baby_activities_updated_at 
ON baby_activities(updated_at DESC);

-- 3. Composite index for sync pattern
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_baby_activities_sync 
ON baby_activities(updated_at DESC, id);

-- 4. Index on local_id for upsert lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_baby_activities_local_id 
ON baby_activities(local_id);

-- 5. Index on baby_profile for filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_baby_activities_baby_profile 
ON baby_activities_baby_profile_lnk(baby_profile_id);

-- 6. Partial index for non-deleted records
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_baby_activities_not_deleted 
ON baby_activities(id) 
WHERE deleted_at IS NULL;

-- 7. Index on timestamp for date range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_baby_activities_timestamp 
ON baby_activities(timestamp DESC);

-- 8. Index on type for filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_baby_activities_type 
ON baby_activities(type);

-- Refresh statistics
ANALYZE baby_activities;
ANALYZE baby_activities_user_lnk;
ANALYZE baby_activities_baby_profile_lnk;
```

### Index Priority
1. **idx_baby_activities_user_updated** - Most critical for sync queries
2. **idx_baby_activities_local_id** - Critical for upsert lookups
3. **idx_baby_activities_updated_at** - Important for pull sync
4. Others - Nice to have for filtering

---

## Client Implementation Guide

### 1. Initial Sync (First Login)

```typescript
// Fetch all activities (no 'since' parameter)
const response = await api.get('/baby-activities/sync', {
  params: { baby_profile_id: profileId }
});

// Store all in local DB (MMKV/SQLite)
for (const activity of response.data.data) {
  if (activity.deleted_at) {
    // Skip or mark as deleted locally
    continue;
  }
  await localDB.upsert('activities', activity);
}

// Save lastSyncedAt for incremental sync
await storage.set('lastSyncedAt', response.data.meta.lastSyncedAt);
```

### 2. Incremental Sync (Subsequent Syncs)

```typescript
const lastSyncedAt = await storage.get('lastSyncedAt');

const response = await api.get('/baby-activities/sync', {
  params: { 
    baby_profile_id: profileId,
    since: lastSyncedAt
  }
});

for (const activity of response.data.data) {
  if (activity.deleted_at) {
    // Remove from local DB
    await localDB.delete('activities', activity.local_id);
  } else {
    // Update local DB
    await localDB.upsert('activities', activity);
  }
}

// Update lastSyncedAt
await storage.set('lastSyncedAt', response.data.meta.lastSyncedAt);
```

### 3. Push Local Changes

```typescript
// Get pending changes from sync queue
const pendingActivities = await syncQueue.getPending();

if (pendingActivities.length > 0) {
  try {
    const response = await api.post('/baby-activities/sync', {
      baby_profile_id: profileId,
      activities: pendingActivities.map(a => ({
        local_id: a.local_id,
        type: a.type,
        timestamp: a.timestamp,
        data: a.data,
        deleted_at: a.deleted_at,
        client_updated_at: a.client_updated_at
      }))
    });

    if (response.data.success) {
      // Mark as synced
      await syncQueue.markSynced(pendingActivities);
    }
  } catch (error) {
    // Transaction rolled back, retry later
    console.error('Sync failed:', error);
  }
}
```

### 4. Deleting an Activity Locally

```typescript
async function deleteActivity(localId: string) {
  const now = new Date().toISOString();
  
  // 1. Mark as deleted in local DB (don't remove yet)
  await localDB.update('activities', localId, {
    deleted_at: now,
    client_updated_at: now
  });
  
  // 2. Add to sync queue
  await syncQueue.add({
    local_id: localId,
    deleted_at: now,
    client_updated_at: now
  });
  
  // 3. Remove from UI immediately
  removeFromUI(localId);
}
```

---

## Error Handling

| Error Code | Description | Client Action |
|------------|-------------|---------------|
| 400 | Validation failed | Show error details to user |
| 401 | Not authenticated | Redirect to login |
| 403 | Not authorized | Check profile ownership |
| 404 | Profile not found | Re-fetch profiles |
| 500 | Transaction failed | Retry with exponential backoff |

---

## Best Practices

1. **Batch Size**: Keep sync batches under 500 items
2. **Retry Logic**: Implement exponential backoff for failed syncs
3. **Conflict Resolution**: Server time wins (last-write-wins)
4. **Pagination**: Use `offset` and `hasMore` for large datasets
5. **Background Sync**: Use background tasks for sync operations
6. **Local-First**: Always update local DB before syncing

---

## Testing Checklist

- [ ] Create activity on Device A
- [ ] Sync to server
- [ ] Pull on Device B - activity appears
- [ ] Delete activity on Device A (soft delete)
- [ ] Sync to server
- [ ] Pull on Device B - activity removed from UI
- [ ] Verify transaction rollback on partial failure
- [ ] Test pagination with large datasets
- [ ] Test offline → online sync queue
