// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBudszTUPjO7rV1YYvT2ZtHjAD4Y2k18m0',
  authDomain: 'namm2306-ac7ff.firebaseapp.com',
  projectId: 'namm2306-ac7ff',
  storageBucket: 'namm2306-ac7ff.appspot.com',
  messagingSenderId: '543997404992',
  appId: '1:543997404992:web:42b3f2e16008245216bca5',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'Thông báo', {
    body: body || '',
    icon: icon || '/logo192.png',
  });
});
