// 휴대폰 알림 받기용 서비스 워커 (알림 문구는 사용자가 정한 것만, 채팅 내용은 오지 않음)
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let d = {}
  try {
    d = e.data ? e.data.json() : {}
  } catch {
    d = {}
  }
  e.waitUntil(
    self.registration.showNotification(d.title || '알림', {
      body: d.body || '',
      icon: '/push-icon-192.png',
      badge: '/push-badge-96.png',
      tag: d.tag || 'msg',
      renotify: true,
    }),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
})
