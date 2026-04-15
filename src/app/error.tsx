"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-void-900 to-void-800">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Oops!</h1>
        <p className="text-gray-300 mb-8">{error.message || "Something went wrong"}</p>
        <button
          onClick={() => reset()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
