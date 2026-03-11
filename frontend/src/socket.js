import { io } from 'socket.io-client';

const URL = "https://game-hub-9smt.onrender.com";

export const socket = io(URL, {
    autoConnect: false, // We will connect manually when a user logs in
});
