/* services/cost_service_client.js
 * Calls the Cost service to get total costs of a user
 * this file is a "client" for the Cost service (another process)
 * goal: ask the cost service what is the total costs for a specific user */
const DEFAULT_TIMEOUT_MS = 10000;
/* helper function: does fetch() but stops if it takes too long
 * input: url, fetch options, timeout in ms
 * output: the fetch Response object
 * if timeout happens - AbortController cancels the request */
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
/* main function: get total costs for userId from the cost service
 * input: userId (number)
 * output: total (number)
 * throws error if COST_SERVICE_URL missing or service returns bad response */

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
