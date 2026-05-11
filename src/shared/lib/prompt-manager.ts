export interface PromptRecord {
  id: number;
  title: string;
  content: string;
  category: string;
  tags: string[];
  variables: string[];
  isFavorite: boolean;
  createdAt: number;
  lastUsed: number | null;
  useCount: number;
  favoriteOrder: number | null;
}

export interface PromptDraft {
  title?: string;
  content: string;
  category?: string;
  tags?: string[];
  variables?: string[];
  isFavorite?: boolean;
  createdAt?: number;
  lastUsed?: number | null;
  useCount?: number;
  favoriteOrder?: number | null;
}

export interface PromptLibraryPayload {
  version?: string;
  exportDate?: string;
  prompts: PromptDraft[];
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ error: string; prompt: string }>;
}

const DB_NAME = "ParallelAiDB";
const DB_VERSION = 1;
const PROMPTS_STORE = "prompts";

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 50_000;
const MAX_CATEGORY_LENGTH = 50;
const MAX_TAG_LENGTH = 30;
const MAX_TAGS_COUNT = 20;
const MAX_IDB_ATTEMPTS = 3;
const RETRY_DELAY_BASE_MS = 100;

let db: IDBDatabase | null = null;

function isQuotaExceeded(error: unknown) {
  return (
    error instanceof DOMException
      ? error.name === "QuotaExceededError"
      : typeof error === "object" &&
          error !== null &&
          "name" in error &&
          (error as { name?: unknown }).name === "QuotaExceededError"
  );
}

function buildQuotaError() {
  return new Error("Storage quota exceeded. Delete unused prompts to free space.");
}

function sanitizeString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function validatePromptData(promptData: PromptDraft) {
  const errors: string[] = [];

  if (typeof promptData.content !== "string" || promptData.content.trim().length === 0) {
    errors.push("Prompt content is required");
  }

  if (promptData.content && promptData.content.length > MAX_CONTENT_LENGTH) {
    errors.push(`Prompt content must be less than ${MAX_CONTENT_LENGTH} characters`);
  }

  if (promptData.title && promptData.title.length > MAX_TITLE_LENGTH) {
    errors.push(`Title must be less than ${MAX_TITLE_LENGTH} characters`);
  }

  if (promptData.category && promptData.category.length > MAX_CATEGORY_LENGTH) {
    errors.push(`Category must be less than ${MAX_CATEGORY_LENGTH} characters`);
  }

  if (promptData.tags && promptData.tags.length > MAX_TAGS_COUNT) {
    errors.push(`Maximum ${MAX_TAGS_COUNT} tags allowed`);
  }

  return errors;
}

function normalizePromptData(promptData: PromptDraft) {
  return {
    title: sanitizeString(promptData.title || "Untitled Prompt", MAX_TITLE_LENGTH),
    content: sanitizeString(promptData.content, MAX_CONTENT_LENGTH),
    category: sanitizeString(promptData.category || "General", MAX_CATEGORY_LENGTH),
    tags: Array.isArray(promptData.tags)
      ? promptData.tags
          .slice(0, MAX_TAGS_COUNT)
          .map((tag) => sanitizeString(tag, MAX_TAG_LENGTH))
          .filter(Boolean)
      : [],
    variables: Array.isArray(promptData.variables)
      ? promptData.variables.map((variable) => sanitizeString(variable, MAX_TAG_LENGTH)).filter(Boolean)
      : [],
    isFavorite: Boolean(promptData.isFavorite),
    createdAt: promptData.createdAt || Date.now(),
    lastUsed: promptData.lastUsed ?? null,
    useCount: promptData.useCount || 0,
    favoriteOrder:
      typeof promptData.favoriteOrder === "number" ? promptData.favoriteOrder : null,
  } satisfies Omit<PromptRecord, "id">;
}

function wrapRequest<Result>(
  request: IDBRequest,
  mapper?: (result: unknown) => Result,
): Promise<Result> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const value = mapper ? mapper(request.result) : (request.result as Result);
      resolve(value);
    };
    request.onerror = () => {
      if (isQuotaExceeded(request.error)) {
        reject(buildQuotaError());
      } else {
        reject(request.error);
      }
    };
  });
}

function runWithRetry<Result>(operation: () => Promise<Result> | Result, attempt = 1): Promise<Result> {
  return new Promise((resolve, reject) => {
    try {
      Promise.resolve(operation())
        .then(resolve)
        .catch((error) => {
          if (isQuotaExceeded(error)) {
            reject(buildQuotaError());
            return;
          }

          if (attempt < MAX_IDB_ATTEMPTS) {
            const delay = RETRY_DELAY_BASE_MS * Math.pow(2, attempt - 1);
            window.setTimeout(() => {
              runWithRetry(operation, attempt + 1).then(resolve).catch(reject);
            }, delay);
            return;
          }

          reject(error);
        });
    } catch (error) {
      reject(error);
    }
  });
}

export async function initPromptDB() {
  if (db) {
    try {
      db.objectStoreNames.length;
      return db;
    } catch {
      db = null;
    }
  }

  if (!("indexedDB" in globalThis)) {
    throw new Error("IndexedDB is not available in this environment");
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      db.onclose = () => {
        db = null;
      };
      resolve(db);
    };
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROMPTS_STORE)) {
        const promptsStore = database.createObjectStore(PROMPTS_STORE, {
          autoIncrement: true,
          keyPath: "id",
        });

        promptsStore.createIndex("title", "title", { unique: false });
        promptsStore.createIndex("category", "category", { unique: false });
        promptsStore.createIndex("tags", "tags", { multiEntry: true, unique: false });
        promptsStore.createIndex("createdAt", "createdAt", { unique: false });
        promptsStore.createIndex("lastUsed", "lastUsed", { unique: false });
        promptsStore.createIndex("isFavorite", "isFavorite", { unique: false });
      }
    };
  });
}

async function ensureDb() {
  if (!db) {
    await initPromptDB();
  }

  if (!db) {
    throw new Error("Prompt database unavailable");
  }

  return db;
}

export async function savePrompt(promptData: PromptDraft) {
  await ensureDb();

  const validationErrors = validatePromptData(promptData);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join(", "));
  }

  const prompt = normalizePromptData(promptData);

  return runWithRetry(async () => {
    const database = await ensureDb();
    const transaction = database.transaction([PROMPTS_STORE], "readwrite");
    const store = transaction.objectStore(PROMPTS_STORE);
    const request = store.add(prompt);
    return wrapRequest(request, (result) => ({ ...prompt, id: result as number }));
  });
}

export async function getPrompt(id: number) {
  await ensureDb();

  return runWithRetry(async () => {
    const database = await ensureDb();
    const request = database.transaction([PROMPTS_STORE], "readonly").objectStore(PROMPTS_STORE).get(id);
    return wrapRequest(request, (result) => (result as PromptRecord | undefined) ?? null);
  });
}

export async function getAllPrompts() {
  await ensureDb();

  return runWithRetry(async () => {
    const database = await ensureDb();
    const request = database.transaction([PROMPTS_STORE], "readonly").objectStore(PROMPTS_STORE).getAll();
    return wrapRequest(request, (result) => ((result as PromptRecord[] | undefined) ?? []).sort((left, right) => right.createdAt - left.createdAt));
  });
}

export async function updatePrompt(id: number, updates: Partial<PromptDraft>) {
  await ensureDb();

  return runWithRetry(async () => {
    const prompt = await getPrompt(id);
    if (!prompt) {
      throw new Error(`Prompt with id ${id} not found`);
    }

    const merged = {
      ...prompt,
      ...normalizePromptData({
        ...prompt,
        ...updates,
      }),
      id,
    } satisfies PromptRecord;

    const database = await ensureDb();
    const request = database
      .transaction([PROMPTS_STORE], "readwrite")
      .objectStore(PROMPTS_STORE)
      .put(merged);

    return wrapRequest(request, () => merged);
  });
}

export async function deletePrompt(id: number) {
  await ensureDb();

  return runWithRetry(async () => {
    const database = await ensureDb();
    const request = database.transaction([PROMPTS_STORE], "readwrite").objectStore(PROMPTS_STORE).delete(id);
    return wrapRequest(request, () => true);
  });
}

export async function searchPrompts(searchText: string) {
  const allPrompts = await getAllPrompts();
  const search = searchText.toLowerCase();

  return allPrompts.filter(
    (prompt) =>
      prompt.title.toLowerCase().includes(search) ||
      prompt.content.toLowerCase().includes(search) ||
      prompt.tags.some((tag) => tag.toLowerCase().includes(search)),
  );
}

export async function getPromptsByCategory(category: string) {
  if (!category) {
    return getAllPrompts();
  }

  const allPrompts = await getAllPrompts();
  return allPrompts.filter((prompt) => prompt.category === category);
}

export async function getFavoritePrompts() {
  const allPrompts = await getAllPrompts();
  return allPrompts.filter((prompt) => prompt.isFavorite);
}

export async function toggleFavorite(id: number) {
  const prompt = await getPrompt(id);
  if (!prompt) {
    throw new Error(`Prompt ${id} not found`);
  }

  return updatePrompt(id, { isFavorite: !prompt.isFavorite });
}

export async function recordPromptUsage(id: number) {
  const prompt = await getPrompt(id);
  if (!prompt) {
    throw new Error(`Prompt ${id} not found`);
  }

  return updatePrompt(id, {
    lastUsed: Date.now(),
    useCount: (prompt.useCount || 0) + 1,
  });
}

export async function getAllCategories() {
  const prompts = await getAllPrompts();
  return [...new Set(prompts.map((prompt) => prompt.category).filter(Boolean))].sort();
}

export async function getAllTags() {
  const prompts = await getAllPrompts();
  return [...new Set(prompts.flatMap((prompt) => prompt.tags))].sort();
}

export async function exportPrompts(): Promise<PromptLibraryPayload> {
  return {
    exportDate: new Date().toISOString(),
    prompts: await getAllPrompts(),
    version: "1.0",
  };
}

function normalizeLibraryPayload(input: PromptLibraryPayload | PromptDraft[] | null | undefined) {
  if (Array.isArray(input)) {
    return { prompts: input };
  }

  if (!input || !Array.isArray(input.prompts)) {
    return null;
  }

  return input;
}

export async function importPrompts(
  data: PromptLibraryPayload | PromptDraft[] | null | undefined,
  mergeStrategy: "overwrite" | "skip" = "skip",
) {
  const payload = normalizeLibraryPayload(data);
  if (!payload) {
    throw new Error("Invalid import data format");
  }

  const results: ImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
  };

  for (const promptData of payload.prompts) {
    try {
      const allPrompts = await getAllPrompts();
      const matchingPrompt = allPrompts.find(
        (prompt) => prompt.title.toLowerCase().trim() === (promptData.title || "").toLowerCase().trim(),
      );

      if (matchingPrompt && mergeStrategy === "skip") {
        results.skipped += 1;
        continue;
      }

      if (matchingPrompt && mergeStrategy === "overwrite") {
        await updatePrompt(matchingPrompt.id, promptData);
      } else {
        await savePrompt(promptData);
      }

      results.imported += 1;
    } catch (error) {
      results.errors.push({
        error: error instanceof Error ? error.message : "Unknown import error",
        prompt: promptData.title || "Untitled Prompt",
      });
    }
  }

  return results;
}

export async function clearAllPrompts() {
  await ensureDb();

  return runWithRetry(async () => {
    const database = await ensureDb();
    const request = database.transaction([PROMPTS_STORE], "readwrite").objectStore(PROMPTS_STORE).clear();
    return wrapRequest(request, () => true);
  });
}

export async function getRecentlyUsedPrompts(limit = 5) {
  const prompts = await getAllPrompts();
  return prompts
    .filter((prompt) => prompt.lastUsed !== null && prompt.lastUsed !== undefined)
    .sort((left, right) => (right.lastUsed ?? 0) - (left.lastUsed ?? 0))
    .slice(0, limit);
}

export async function getTopFavorites(limit = 5) {
  const favorites = await getFavoritePrompts();
  return favorites.sort((left, right) => right.useCount - left.useCount).slice(0, limit);
}

export async function importDefaultLibrary(data: PromptLibraryPayload | PromptDraft[] | null | undefined) {
  const payload = normalizeLibraryPayload(data);
  if (!payload) {
    throw new Error("Invalid library data format");
  }

  const existingTitles = new Set(
    (await getAllPrompts()).map((prompt) => prompt.title.toLowerCase().trim()),
  );

  const results: ImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
  };

  for (const promptData of payload.prompts) {
    try {
      const titleKey = (promptData.title || "").toLowerCase().trim();
      if (titleKey && existingTitles.has(titleKey)) {
        results.skipped += 1;
        continue;
      }

      await savePrompt(promptData);
      if (titleKey) {
        existingTitles.add(titleKey);
      }
      results.imported += 1;
    } catch (error) {
      results.errors.push({
        error: error instanceof Error ? error.message : "Unknown import error",
        prompt: promptData.title || "Untitled Prompt",
      });
    }
  }

  return results;
}
