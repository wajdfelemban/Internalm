import { getDatabase } from "../db/dexie";
import { newId } from "../lib/id";
import type { Category } from "../db/schema";
import { baseFields, insertRow, softDeleteRow, updateRow } from "./base";

export async function createCategory(
  ownerId: string,
  name: string,
  parentId: string | null = null,
  position = 0,
): Promise<Category> {
  const category: Category = {
    ...baseFields(ownerId, newId()),
    name,
    parentId,
    position,
  };
  return insertRow("categories", category);
}

export async function renameCategory(id: string, name: string): Promise<void> {
  await updateRow<Category>("categories", id, { name });
}

export async function deleteCategory(id: string): Promise<void> {
  await softDeleteRow("categories", id);
}

export async function listCategories(ownerId: string): Promise<Category[]> {
  const db = getDatabase();
  return db.categories
    .where("ownerId")
    .equals(ownerId)
    .filter((c) => c.deletedAt === null)
    .sortBy("position");
}

export function topLevelCategories(categories: Category[]): Category[] {
  return categories.filter((c) => c.parentId === null);
}

export function subcategoriesOf(categories: Category[], parentId: string): Category[] {
  return categories.filter((c) => c.parentId === parentId);
}

/**
 * Finds-or-creates a top-level category (and optionally a subcategory under
 * it) by name, case-insensitively. Used by CSV import so re-running an
 * import, or importing a second file with overlapping categories, doesn't
 * create duplicates. Mutates and returns the running `categories` list so
 * callers can chain multiple lookups without re-querying Dexie each time.
 */
export async function ensureCategoryPath(
  ownerId: string,
  categories: Category[],
  topName: string,
  subName: string | null,
): Promise<{ categoryId: string; categories: Category[] }> {
  let list = categories;
  const normalizedTop = topName.trim().toLowerCase();

  let top = list.find((c) => c.parentId === null && c.name.trim().toLowerCase() === normalizedTop);
  if (!top) {
    top = await createCategory(ownerId, topName.trim(), null, list.length);
    list = [...list, top];
  }

  if (!subName || !subName.trim()) {
    return { categoryId: top.id, categories: list };
  }

  const normalizedSub = subName.trim().toLowerCase();
  let sub = list.find(
    (c) => c.parentId === top!.id && c.name.trim().toLowerCase() === normalizedSub,
  );
  if (!sub) {
    sub = await createCategory(ownerId, subName.trim(), top.id, list.length);
    list = [...list, sub];
  }

  return { categoryId: sub.id, categories: list };
}

/** A category plus every descendant subcategory id (used to scope study sessions). */
export function categoryAndDescendantIds(
  categories: Category[],
  categoryId: string,
): string[] {
  const ids = [categoryId];
  const children = categories.filter((c) => c.parentId === categoryId);
  for (const child of children) {
    ids.push(...categoryAndDescendantIds(categories, child.id));
  }
  return ids;
}
