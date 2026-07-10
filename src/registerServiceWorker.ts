export function register() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('ZMMS Service Worker registered successfully with scope:', registration.scope);
        })
        .catch((error) => {
          console.error('ZMMS Service Worker registration failed:', error);
        });
    });
  }
}
