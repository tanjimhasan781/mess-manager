// Prints a fresh key pair for push notifications. Usage: npm run vapid
import webpush from 'web-push';
const k = webpush.generateVAPIDKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${k.publicKey}\nVAPID_PRIVATE_KEY=${k.privateKey}`);
