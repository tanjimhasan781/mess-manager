'use client';
import { useState } from 'react';

export function CopyLink({ url, name }: { url: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const text = `Join our mess on Mess Manager: ${url}`;
    if (navigator.share) {
      try { await navigator.share({ title: `Invite for ${name}`, text, url }); return; } catch {}
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-2 flex items-center gap-2">
      <input readOnly value={url} className="field py-1.5 text-xs" aria-label={`Invite link for ${name}`} onFocus={(e) => e.target.select()} />
      <button type="button" onClick={share} className="btn-ghost shrink-0 py-1.5 text-sm">{copied ? 'Copied' : 'Share'}</button>
    </div>
  );
}
