const { saveGameHistory } = require('../utils/historyHelper');

class GameSession {
    constructor(roomId, gameType, totalMatches = 3, onMatchOver = null) {
        this.roomId = roomId;
        this.gameType = gameType;
        this.totalMatches = totalMatches;
        this.onMatchOverCallback = onMatchOver;
        this.currentMatch = 1;
        this.players = []; // { socketId, user, isReady }
        this.spectators = []; // { socketId, user }
        this.scores = {}; // username -> score
        this.matchHistory = []; // { matchNumber, winner, scores, moves }
        this.state = 'waiting'; // 'waiting', 'playing', 'finished'
        this.gameState = {};
        this.turnTimer = null;
        this.turnTimeout = 10000; // 10 seconds
        this.lastMoveTimestamp = Date.now();
        this.turnStartTime = null;
        this.lastActivity = Date.now();
    }

    addPlayer(socketId, user) {
        if (this.players.length < 2) {
            this.players.push({ socketId, user, isReady: false });
            this.scores[user.username] = this.scores[user.username] || 0;
            return true;
        }
        return false;
    }

    addSpectator(socketId, user) {
        this.spectators.push({ socketId, user });
        return true;
    }

    removeParticipant(socketId) {
        this.players = this.players.filter(p => p.socketId !== socketId);
        this.spectators = this.spectators.filter(s => s.socketId !== socketId);
    }

    updateActivity() {
        this.lastActivity = Date.now();
    }

    setReady(username) {
        this.updateActivity();
        const player = this.players.find(p => p.user.username === username);
        if (player) {
            player.isReady = true;
        }
        return this.players.every(p => p.isReady) && this.players.length === 2;
    }

    startMatch(io, initialGameState) {
        this.updateActivity();
        this.state = 'playing';
        this.gameState = initialGameState;
        this.players.forEach(p => p.isReady = false);
        this.startTurnTimer(io);
    }

    startTurnTimer(io) {
        this.stopTurnTimer();
        this.turnStartTime = Date.now();

        io.to(this.roomId).emit('turn_timer_start', {
            timeout: this.turnTimeout,
            startTime: this.turnStartTime
        });

        this.turnTimer = setTimeout(() => {
            this.handleTimeout(io);
        }, this.turnTimeout);
    }

    stopTurnTimer() {
        if (this.turnTimer) {
            clearTimeout(this.turnTimer);
            this.turnTimer = null;
        }
    }

    handleTimeout(io) {
        console.log(`[DEBUG] Turn timeout in room ${this.roomId}`);
        io.to(this.roomId).emit('turn_timer_end', { reason: 'timeout' });

        const currentTurnPlayer = this.getCurrentTurnPlayer();
        const opponent = this.players.find(p => p.user.username !== currentTurnPlayer);

        if (opponent && this.onMatchOverCallback) {
            this.onMatchOverCallback(io, this.roomId, opponent.user.username);
        }
    }

    getCurrentTurnPlayer() {
        if (this.gameType === 'tictactoe') return this.gameState.players[this.gameState.currentTurn];
        if (this.gameType === 'drawing') return this.gameState.drawer;
        if (this.gameType === 'territory') {
            // Territory doesn't have strict turns, but we can track last activity
            return null;
        }
        return null;
    }

    handleMatchOver(winner, isDraw = false) {
        this.updateActivity();
        this.stopTurnTimer();
        if (isDraw) {
            this.players.forEach(p => {
                this.scores[p.user.username] = (this.scores[p.user.username] || 0) + 1;
            });
        } else if (winner) {
            this.scores[winner] = (this.scores[winner] || 0) + 1;
        }

        const matchRecord = {
            matchNumber: this.currentMatch,
            winner: isDraw ? 'Draw' : winner,
            scores: { ...this.scores }
        };
        this.matchHistory.push(matchRecord);

        // Save to DB via helper
        saveGameHistory(this.gameType, this.players.map(p => p.user.username), isDraw ? 'Draw' : winner);

        if (this.currentMatch >= this.totalMatches) {
            this.state = 'finished';
            return { seriesOver: true, winner: this.calculateSeriesWinner() };
        } else {
            this.currentMatch++;
            this.state = 'waiting'; // Wait for next round ready
            this.players.forEach(p => p.isReady = false); // RESET READY STATE
            return { seriesOver: false };
        }
    }

    restartSeries() {
        this.currentMatch = 1;
        this.matchHistory = [];
        this.state = 'waiting';
        this.players.forEach(p => {
            this.scores[p.user.username] = 0;
            p.isReady = false;
        });
    }

    calculateSeriesWinner() {
        const usernames = Object.keys(this.scores);
        if (usernames.length < 2) return 'Draw';
        const [p1, p2] = usernames;
        if (this.scores[p1] > this.scores[p2]) return p1;
        if (this.scores[p2] > this.scores[p1]) return p2;
        return 'Draw';
    }

    toJSON() {
        return {
            roomId: this.roomId,
            gameType: this.gameType,
            players: this.players.map(p => ({ username: p.user.username, isReady: p.isReady })),
            spectatorsCount: this.spectators.length,
            scores: this.scores,
            currentMatch: this.currentMatch,
            totalMatches: this.totalMatches,
            state: this.state,
            gameState: this.gameState
        };
    }
}

module.exports = GameSession;
