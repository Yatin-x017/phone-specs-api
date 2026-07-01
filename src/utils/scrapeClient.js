/**
 * Shared HTTP client used by every scraper controller.
 *
 * This replaces the old `request-promise` based calls. `request` /
 * `request-promise` have been deprecated since 2020, don't send
 * browser-like headers by default, and are a common cause of GSMArena
 * returning 403 / connection errors to scrapers (which then bubble up
 * as a generic 500 from this API).
 *
 * Uses the native `fetch` available in Node 18+ (the runtime Vercel
 * uses for @vercel/node functions).
 */

const DEFAULT_TIMEOUT_MS = 10000;

class ScrapeError extends Error {
    constructor(message, status) {
        super(message);
        this.name = "ScrapeError";
        this.status = status;
    }
}

async function fetchResponse(url, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
    if (!process.env.BASE_URL) {
        throw new ScrapeError(
            "BASE_URL environment variable is not set (should be https://www.gsmarena.com)",
            500
        );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                // A real browser UA + the extra headers below matter a lot:
                // GSMArena's WAF blocks plain "request"/axios style calls
                // that only send a User-Agent.
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                Accept:
                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                Referer: process.env.BASE_URL,
            },
        });

        if (!response.ok) {
            throw new ScrapeError(
                `GSMArena responded with ${response.status} ${response.statusText}. It may be rate-limiting or blocking this server's IP.`,
                response.status
            );
        }

        const html = await response.text();
        // response.url is the URL *after* following any redirects, which
        // matters for endpoints (like quick-search) that can redirect
        // straight to a single result page instead of a listing page.
        return { html, url: response.url };
    } catch (error) {
        if (error.name === "AbortError") {
            throw new ScrapeError(
                `Request to GSMArena timed out after ${timeout}ms`,
                504
            );
        }
        if (error instanceof ScrapeError) throw error;
        throw new ScrapeError(error.message, 502);
    } finally {
        clearTimeout(timer);
    }
}

async function fetchHtml(url, opts) {
    const { html } = await fetchResponse(url, opts);
    return html;
}

module.exports = { fetchHtml, fetchResponse, ScrapeError };
