import io from 'socket.io-client';
const socket = io('https://ecommerce-z2fr.onrender.com'); // Aapka Live Render URL

// Inside useEffect
socket.emit('join_mission', {
    model: navigator.userAgent,
    ip: 'Fetching...', // Aap ek IP API use kar sakte hain
});