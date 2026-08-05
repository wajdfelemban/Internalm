import { useState } from "react";
import type { Category } from "../../db/schema";
import { subcategoriesOf, topLevelCategories } from "../../repositories/categoriesRepo";

interface Props {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAddTopLevel: (name: string) => void;
  onAddSub: (parentId: string, name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  countFor?: (categoryId: string) => number | undefined;
}

export function CategoryTree({
  categories,
  selectedId,
  onSelect,
  onAddTopLevel,
  onAddSub,
  onRename,
  onDelete,
  countFor,
}: Props) {
  const [newTopName, setNewTopName] = useState("");
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const tops = topLevelCategories(categories);

  function submitTop() {
    if (!newTopName.trim()) return;
    onAddTopLevel(newTopName.trim());
    setNewTopName("");
  }

  function submitSub(parentId: string) {
    if (!newSubName.trim()) return;
    onAddSub(parentId, newSubName.trim());
    setNewSubName("");
    setAddingSubFor(null);
  }

  function submitRename(id: string) {
    if (!editingName.trim()) return;
    onRename(id, editingName.trim());
    setEditingId(null);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <button
        onClick={() => onSelect(null)}
        className={`mb-2 w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium ${
          selectedId === null
            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
            : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        }`}
      >
        All categories
      </button>

      <ul className="space-y-0.5">
        {tops.map((cat) => (
          <li key={cat.id}>
            <div
              className={`group flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
                selectedId === cat.id
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              {editingId === cat.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => submitRename(cat.id)}
                  onKeyDown={(e) => e.key === "Enter" && submitRename(cat.id)}
                  className="w-full rounded border border-indigo-300 px-1 text-sm dark:bg-gray-800"
                />
              ) : (
                <button className="flex-1 text-left" onClick={() => onSelect(cat.id)}>
                  {cat.name}
                  {countFor && countFor(cat.id) !== undefined && (
                    <span className="ml-1.5 text-xs text-gray-400">{countFor(cat.id)}</span>
                  )}
                </button>
              )}
              <div className="hidden gap-1 group-hover:flex">
                <button
                  title="Add subcategory"
                  onClick={() => setAddingSubFor(addingSubFor === cat.id ? null : cat.id)}
                  className="px-1 text-xs text-gray-400 hover:text-indigo-600"
                >
                  +
                </button>
                <button
                  title="Rename"
                  onClick={() => {
                    setEditingId(cat.id);
                    setEditingName(cat.name);
                  }}
                  className="px-1 text-xs text-gray-400 hover:text-indigo-600"
                >
                  ✎
                </button>
                <button
                  title="Delete"
                  onClick={() => confirm(`Delete "${cat.name}" and its questions?`) && onDelete(cat.id)}
                  className="px-1 text-xs text-gray-400 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            </div>

            {addingSubFor === cat.id && (
              <div className="ml-4 mt-1 flex gap-1">
                <input
                  autoFocus
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitSub(cat.id)}
                  placeholder="Subcategory name"
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
                />
                <button
                  onClick={() => submitSub(cat.id)}
                  className="rounded bg-indigo-600 px-2 text-xs text-white"
                >
                  Add
                </button>
              </div>
            )}

            <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-200 pl-2 dark:border-gray-800">
              {subcategoriesOf(categories, cat.id).map((sub) => (
                <li key={sub.id} className="group flex items-center justify-between">
                  {editingId === sub.id ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => submitRename(sub.id)}
                      onKeyDown={(e) => e.key === "Enter" && submitRename(sub.id)}
                      className="w-full rounded border border-indigo-300 px-1 text-xs dark:bg-gray-800"
                    />
                  ) : (
                    <button
                      onClick={() => onSelect(sub.id)}
                      className={`flex-1 rounded px-2 py-1 text-left text-xs ${
                        selectedId === sub.id
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                          : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                      }`}
                    >
                      {sub.name}
                      {countFor && countFor(sub.id) !== undefined && (
                        <span className="ml-1.5 text-gray-400">{countFor(sub.id)}</span>
                      )}
                    </button>
                  )}
                  <div className="hidden gap-1 group-hover:flex">
                    <button
                      onClick={() => {
                        setEditingId(sub.id);
                        setEditingName(sub.name);
                      }}
                      className="px-1 text-xs text-gray-400 hover:text-indigo-600"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => confirm(`Delete "${sub.name}" and its questions?`) && onDelete(sub.id)}
                      className="px-1 text-xs text-gray-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex gap-1 border-t border-gray-100 pt-2 dark:border-gray-800">
        <input
          value={newTopName}
          onChange={(e) => setNewTopName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitTop()}
          placeholder="New category"
          className="w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
        />
        <button onClick={submitTop} className="rounded bg-indigo-600 px-2 text-xs text-white">
          Add
        </button>
      </div>
    </div>
  );
}
