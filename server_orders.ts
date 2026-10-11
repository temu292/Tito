import fs from 'fs';
import path from 'path';

export interface PayPalOrderJournalEntry {
  orderId: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  serviceId: string;
  serviceTitle: string;
  planId: string;
  planName: string;
  amount: number;
  currency: 'EUR';
  durationDays: number;
  status: 'CREATED' | 'CAPTURING' | 'CAPTURED' | 'FAILED';
  createdAt: string;
  capturedAt?: string;
  captureId?: string;
  payerEmail?: string;
  expiresAt?: string;
  supabaseSyncStatus: 'synced' | 'pending' | 'skipped_no_credentials';
  supabaseSyncError?: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const JOURNAL_FILE = path.join(DATA_DIR, 'paypal_orders_journal.json');

// In-memory cache for ultra-fast lookup
const memoryCache = new Map<string, PayPalOrderJournalEntry>();

// Ensure directory exists and load persisted data
function initializeJournal() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(JOURNAL_FILE)) {
      const raw = fs.readFileSync(JOURNAL_FILE, 'utf-8');
      const data = JSON.parse(raw) as PayPalOrderJournalEntry[];
      for (const entry of data) {
        memoryCache.set(entry.orderId, entry);
      }
      console.log(`[PayPal Journal] Loaded ${memoryCache.size} orders from persistent storage.`);
    } else {
      fs.writeFileSync(JOURNAL_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('[PayPal Journal] Failed to initialize storage:', err);
  }
}

// Persist the entire journal atomically to disk
function persistToDisk() {
  try {
    const list = Array.from(memoryCache.values());
    const tempFile = `${JOURNAL_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(list, null, 2), 'utf-8');
    fs.renameSync(tempFile, JOURNAL_FILE);
  } catch (err) {
    console.error('[PayPal Journal] Failed to persist data to disk:', err);
  }
}

// Initialize on module load
initializeJournal();

export const ordersJournal = {
  createOrder(entry: Omit<PayPalOrderJournalEntry, 'status' | 'createdAt' | 'supabaseSyncStatus'>): PayPalOrderJournalEntry {
    const newEntry: PayPalOrderJournalEntry = {
      ...entry,
      status: 'CREATED',
      createdAt: new Date().toISOString(),
      supabaseSyncStatus: 'pending'
    };
    memoryCache.set(newEntry.orderId, newEntry);
    persistToDisk();
    return newEntry;
  },

  getOrder(orderId: string): PayPalOrderJournalEntry | undefined {
    return memoryCache.get(orderId);
  },

  /**
   * Atomic lock acquisition to prevent concurrent requests from double-capturing the same order
   */
  claimCaptureLock(orderId: string): { success: boolean; reason?: 'NOT_FOUND' | 'ALREADY_CAPTURED' | 'CONCURRENT_CAPTURE_IN_PROGRESS' } {
    const existing = memoryCache.get(orderId);
    if (!existing) {
      return { success: false, reason: 'NOT_FOUND' };
    }
    if (existing.status === 'CAPTURED') {
      return { success: false, reason: 'ALREADY_CAPTURED' };
    }
    if (existing.status === 'CAPTURING') {
      return { success: false, reason: 'CONCURRENT_CAPTURE_IN_PROGRESS' };
    }
    existing.status = 'CAPTURING';
    memoryCache.set(orderId, existing);
    persistToDisk();
    return { success: true };
  },

  /**
   * Release lock if capture failed or aborted before capture completion
   */
  releaseCaptureLock(orderId: string, failedReason?: string): void {
    const existing = memoryCache.get(orderId);
    if (existing && existing.status === 'CAPTURING') {
      existing.status = failedReason ? 'FAILED' : 'CREATED';
      if (failedReason) {
        existing.supabaseSyncError = failedReason;
      }
      memoryCache.set(orderId, existing);
      persistToDisk();
    }
  },

  markCaptured(
    orderId: string,
    captureId: string,
    payerEmail: string | undefined,
    expiresAt: string,
    syncStatus: 'synced' | 'pending' | 'skipped_no_credentials',
    syncError?: string
  ): PayPalOrderJournalEntry {
    const existing = memoryCache.get(orderId);
    if (!existing) {
      throw new Error(`Order ${orderId} not found in journal.`);
    }
    const updated: PayPalOrderJournalEntry = {
      ...existing,
      status: 'CAPTURED',
      capturedAt: new Date().toISOString(),
      captureId,
      payerEmail,
      expiresAt,
      supabaseSyncStatus: syncStatus,
      supabaseSyncError: syncError
    };
    memoryCache.set(orderId, updated);
    persistToDisk();
    return updated;
  },

  updateSyncStatus(
    orderId: string,
    syncStatus: 'synced' | 'pending',
    syncError?: string
  ): void {
    const existing = memoryCache.get(orderId);
    if (existing) {
      existing.supabaseSyncStatus = syncStatus;
      existing.supabaseSyncError = syncError;
      memoryCache.set(orderId, existing);
      persistToDisk();
    }
  },

  getPendingSyncOrders(): PayPalOrderJournalEntry[] {
    return Array.from(memoryCache.values()).filter(
      o => o.status === 'CAPTURED' && o.supabaseSyncStatus === 'pending'
    );
  },

  getUserOrders(userId: string): PayPalOrderJournalEntry[] {
    return Array.from(memoryCache.values()).filter(o => o.userId === userId);
  },

  getAllOrders(): PayPalOrderJournalEntry[] {
    return Array.from(memoryCache.values());
  }
};
