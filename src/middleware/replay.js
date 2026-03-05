const usedNonces = new Set();
const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Middleware to prevent Replay Attacks
 * Requires x-timestamp and x-nonce headers.
 * Rejects requests older than REPLAY_WINDOW_MS or using a duplicate nonce.
 */
function preventReplay(req, res, next) {
    const timestamp = req.headers['x-timestamp'] || req.body.timestamp;
    const nonce = req.headers['x-nonce'] || req.body.nonce;

    if (!timestamp || !nonce) {
        return res.status(400).json({ error: 'Missing timestamp or nonce for replay protection' });
    }

    const timeDiff = Math.abs(Date.now() - parseInt(timestamp, 10));
    if (timeDiff > REPLAY_WINDOW_MS) {
        return res.status(400).json({ error: 'Request expired (possible replay attack)' });
    }

    if (usedNonces.has(nonce)) {
        return res.status(400).json({ error: 'Duplicate request detected (replay attack)' });
    }

    usedNonces.add(nonce);

    // Clean up nonce after the replay window expires to prevent memory leak
    setTimeout(() => {
        usedNonces.delete(nonce);
    }, REPLAY_WINDOW_MS);

    next();
}

module.exports = { preventReplay };
