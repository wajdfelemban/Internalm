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
