import React, { useEffect, useState } from 'react';
import { marked } from 'marked';

const ReadmeViewer: React.FC = () => {
  const [markdown, setMarkdown] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/READMEDownload.md')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch README.md: ${res.status}`);
        }
        return res.text();
      })
      .then((text) => setMarkdown(text))
      .catch((err) => {
        console.error(err);
        setError('Failed to load README.md');
      });
  }, []);

  const html = markdown ? marked.parse(markdown) : '';

  return (
    <div className="flex flex-col h-screen">
      {error ? (
        <div className="text-red-500 p-6">{error}</div>
      ) : (
        <div
          className="prose max-w-none bg-white p-6 rounded shadow max-h-[80vh] overflow-y-auto min-h-0"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
};

export default ReadmeViewer;