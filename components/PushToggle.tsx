'use client';
import { useEffect, useState } from 'react';

function keyToBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = 'loading' | 'unsupported' | 'ios-install' | 'off' | 'on' | 'denied' | 'no-keys';

export function PushToggle() {
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
      if (!key) return setState('no-keys');
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return setState(ios && !standalone ? 'ios-install' : 'unsupported');
      if (Notification.permission === 'denied') return setState('denied');
      const reg = await navigator.serviceWorker.ready;
      setState((await reg.pushManager.getSubscription()) ? 'on' : 'off');
    })();
  }, [key]);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return setState(perm === 'denied' ? 'denied' : 'off');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(key!) });
      const res = await fetch('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub) });
      setState(res.ok ? 'on' : 'off');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setState('off');
    setBusy(false);
  }

  const msg: Record<State, string> = {
    loading: 'Checking…',
    unsupported: 'This browser cannot receive notifications. Try Chrome on Android, or Safari on iPhone after adding the app to your home screen.',
    'ios-install': 'On iPhone: tap Share, then "Add to Home Screen". Open Mess from your home screen and come back here to turn on notifications.',
    off: 'Get a notification on this phone every time money is cut from your balance.',
    on: 'Notifications are on for this phone.',
    denied: 'Notifications are blocked for this site. Allow them in your browser settings, then reload.',
    'no-keys': 'Phone notifications are not set up on the server yet (missing VAPID keys). You can still see everything here.',
  };

  return (
    <section className="card">
      <h2 className="h2">Phone notifications</h2>
      <p className="muted my-1">{msg[state]}</p>
      {state === 'off' && <button className="btn mt-1" onClick={enable} disabled={busy}>Turn on notifications</button>}
      {state === 'on' && <button className="btn-ghost mt-1" onClick={disable} disabled={busy}>Turn off on this phone</button>}
    </section>
  );
}
