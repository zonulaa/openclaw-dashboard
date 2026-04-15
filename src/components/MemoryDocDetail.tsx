"use client";

import { useState, useEffect } from "react";
import { Star, Link2, ArrowLeft } from "lucide-react";

interface DocDetailProps {
  docId: string;
  onBack: () => void;
}

interface DocData {
  id: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  relatedDocs: string[];
  backrefs: Array<{ sourceDocId: string; title: string }>;
}

export function MemoryDocDetail({ docId, onBack }: DocDetailProps) {
  const [doc, setDoc] = useState<DocData | null>(null);
  const [pinned, setPinned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const response = await fetch(`/api/memory/${encodeURIComponent(docId)}`);
        if (!response.ok) throw new Error("Failed to load document");
        const data = await response.json();
        setDoc(data);

        // Check if pinned
        const pinnedResponse = await fetch("/api/memory/pinned");
        if (pinnedResponse.ok) {
          const pinnedData = await pinnedResponse.json();
          setPinned(
            pinnedData.pinnedDocs.some((p: { docId: string }) => p.docId === docId)
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [docId]);

  const togglePin = async () => {
    try {
      if (pinned) {
        const response = await fetch(`/api/memory/${encodeURIComponent(docId)}/pin`, {
          method: "DELETE",
        });
        if (response.ok) setPinned(false);
      } else {
        const response = await fetch(`/api/memory/${encodeURIComponent(docId)}/pin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (response.ok) setPinned(true);
      }
    } catch (err) {
      console.error("Pin toggle failed:", err);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!doc) return <div className="p-8">Document not found</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <button
          onClick={togglePin}
          className={`p-2 rounded-lg transition-colors ${
            pinned
              ? "bg-yellow-100 text-yellow-600"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <Star className="w-5 h-5" fill={pinned ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Metadata */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <h1 className="text-3xl font-bold mb-4">{docId}</h1>
        <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
          <div>
            <span className="font-semibold">Created:</span>{" "}
            {new Date(doc.createdAt).toLocaleDateString()}
          </div>
          <div>
            <span className="font-semibold">Updated:</span>{" "}
            {new Date(doc.updatedAt).toLocaleDateString()}
          </div>
          <div>
            <span className="font-semibold">Usage:</span> {doc.usageCount} times
          </div>
        </div>

        {/* Tags */}
        {doc.tags.length > 0 && (
          <div className="mt-4">
            <div className="font-semibold text-gray-700 mb-2">Tags</div>
            <div className="flex gap-2 flex-wrap">
              {doc.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Content</h2>
        <div className="bg-gray-50 p-6 rounded-lg whitespace-pre-wrap text-gray-800">
          {doc.content}
        </div>
      </div>

      {/* Related Docs */}
      {doc.relatedDocs.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Related Documents
          </h2>
          <div className="space-y-2">
            {doc.relatedDocs.map((relatedId) => (
              <div
                key={relatedId}
                className="p-3 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer"
              >
                {relatedId}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Backrefs */}
      {doc.backrefs.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Mentioned In</h2>
          <div className="space-y-2">
            {doc.backrefs.map((ref) => (
              <div
                key={ref.sourceDocId}
                className="p-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 cursor-pointer"
              >
                <div className="font-semibold text-purple-900">
                  {ref.title}
                </div>
                <div className="text-sm text-purple-700">{ref.sourceDocId}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
