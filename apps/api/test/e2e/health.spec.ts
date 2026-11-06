import axios from 'axios';

const BASE = 'http://localhost:3000/v1';

describe('Health', () => {
  describe('GET /health/live', () => {
    it('returns ok', async () => {
      const { status, data } = await axios.get(`${BASE}/health/live`);
      expect(status).toBe(200);
      expect(data).toHaveProperty('status', 'ok');
    });
  });

  describe('GET /health/ready', () => {
    it('returns database + wallet + daemon checks', async () => {
      const { status, data } = await axios.get(`${BASE}/health/ready`);
      expect(status).toBe(200);
      expect(['ok', 'degraded']).toContain(data.status);
      expect(data.checks).toHaveProperty('database');
      expect(data.checks).toHaveProperty('wallet');
      expect(data.checks).toHaveProperty('daemon');
      expect(data.checks.database.ok).toBe(true);
      expect(data.checks.wallet.ok).toBe(true);
    });
  });

  describe('GET /health/synced', () => {
    it('returns sync state with heights', async () => {
      const { status, data } = await axios.get(`${BASE}/health/synced`);
      expect(status).toBe(200);
      expect(['ok', 'syncing']).toContain(data.status);
      expect(typeof data.walletHeight).toBe('number');
      expect(typeof data.daemonHeight).toBe('number');
      expect(typeof data.behind).toBe('number');
    });
  });
});
