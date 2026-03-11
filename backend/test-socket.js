const { io } = require("socket.io-client");

const socket1 = io("http://localhost:5001");
const socket2 = io("http://localhost:5001");

socket1.on("connect", () => {
    console.log("Socket 1 connected:", socket1.id);
    socket1.emit("join_queue", {
        gameType: "tictactoe",
        user: { username: "bot1", rating: 1000 }
    });
});

socket2.on("connect", () => {
    console.log("Socket 2 connected:", socket2.id);
    setTimeout(() => {
        socket2.emit("join_queue", {
            gameType: "tictactoe",
            user: { username: "bot2", rating: 1000 }
        });
    }, 500); // 0.5s delay to assure the queue is sequential
});

socket1.on("match_found", (data) => {
    console.log("Socket 1 Match Found:", data.roomId);
    process.exit(0);
});

socket2.on("match_found", (data) => {
    console.log("Socket 2 Match Found:", data.roomId);
});

setTimeout(() => {
    console.log("Timeout waiting for match.");
    process.exit(1);
}, 5000);
