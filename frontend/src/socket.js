import { io } from 'socket.io-client';

const URL = process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:5001';

export const socket = io(URL, {
    autoConnect: false, // We will connect manually when a user logs in
});
