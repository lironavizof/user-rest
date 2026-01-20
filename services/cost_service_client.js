// services/cost_service_client.js
// Calls the Cost service to get total costs of a user

const DEFAULT_TIMEOUT_MS = 5000;

const fetchWithTimeout = async (url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(timeoutId);
    }
};

/**
 * Get total costs of a specific user from Cost service
 * Expected endpoint:
 *   GET /api/costs/total/:userid
 * Expected response:
 *   { userid: number, total: number }
 *
 * @param {number} userId
 * @returns {Promise<number>} total cost
 */
const getUserTotalCosts = async (userId) => {
    const baseUrl = process.env.COST_SERVICE_URL;
    if (!baseUrl) {
        throw new Error('COST_SERVICE_URL is not configured in .env');
    }

    const url = `${baseUrl.replace(/\/$/, '')}/total/${userId}`;

    const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new Error(
            `Cost service error: HTTP ${response.status}. ${bodyText}`.trim()
        );
    }

    const data = await response.json();

    if (typeof data?.total !== 'number') {
        throw new Error('Cost service returned invalid response (expected { total: number })');
    }

    return data.total;
};

module.exports = {
    getUserTotalCosts
};
