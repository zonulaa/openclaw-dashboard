"use client";

import { useState, useEffect } from "react";
import { Star, GripVertical, X } from "lucide-react";

interface PinnedDoc {
  docId: string;
  pinnedAt: string;
  order: number;
  label?: string;
}

interface PinnedMemoryDocsProps {
  onDocSelect: (docId: string) => void;
}

export function PinnedMemoryDocs({ onDocSelect }: PinnedMemoryDocsProps) {
  const [pinnedDocs, setPinnedDocs] = useState<PinnedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedDoc, setDraggedDoc] = useState<string | null>(null);

  useEffect(() => {
    const fetchPinned = async () => {
      try {
        const response = await fetch("/api/memory/pinned");
        if (response.ok) {
          const data = await response.json();
          setPinnedDocs(data.pinnedDocs);
        }
      } catch (err) {
        console.error("Failed to fetch pinned docs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPinned();
  }, []);

  const handleUnpin = async (docId: string) => {
    try {
      const response = await fetch(`/api/memory/${encodeURIComponent(docId)}/pin`, {
        method: "DELETE",
      });
      if (response.ok) {
        setPinnedDocs((prev) => prev.filter((doc) => doc.docId !== docId));
      }
    } catch (err) {
      console.error("Failed to unpin:", err);
    }
  };

  const handleDragStart = (docId: string) => {
    setDraggedDoc(docId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetDocId: string) => {
    if (draggedDoc && draggedDoc !== targetDocId) {
      // Swap order
      setPinnedDocs((prev) => {
        const draggedIndex = prev.findIndex((d) => d.docId === draggedDoc);
        const targetIndex = prev.findIndex((d) => d.docId === targetDocId);

        if (draggedIndex === -1 || targetIndex === -1) return prev;

        const newDocs = [...prev];
        const temp = newDocs[draggedIndex];
        newDocs[draggedIndex] = newDocs[targetIndex];
        newDocs[targetIndex] = temp;

        // Update orders
        return newDocs.map((doc, i) => ({ ...doc, order: i + 1 }));
      });
    }
    setDraggedDoc(null);
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-sm text-gray-500">Loading pinned docs...</div>
      </div>
    );
  }

  if (pinnedDocs.length === 0) {
    return (
      <div className="p-4">
        <div className="text-sm text-gray-500">No pinned documents yet</div>
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-gray-200">
      <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <Star className="w-4 h-4 text-yellow-500" fill="currentColor" />
        Pinned
      </h3>
      <div className="space-y-2">
        {pinnedDocs.map((doc) => (
          <div
            key={doc.docId}
            draggable
            onDragStart={() => handleDragStart(doc.docId)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(doc.docId)}
            className="group flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 cursor-move"
          >
            <GripVertical className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
            <button
              onClick={() => onDocSelect(doc.docId)}
              className="flex-1 text-left text-sm text-gray-700 hover:text-gray-900 truncate"
              title={doc.label || doc.docId}
            >
              {doc.label || doc.docId}
            </button>
            <button
              onClick={() => handleUnpin(doc.docId)}
              className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
