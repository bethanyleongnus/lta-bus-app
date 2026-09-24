/**
 * Vercel Serverless Function: api/health.js
 * Reports whether the key is configured (keyConfigured) and whether LTA answered,
 * including the upstream HTTP status code, for checking the service without opening the app.
 * It must never print the key or any part of it.
 */

export default async function handler(req, res) {
  const accountKey = process.env.LTA_ACCOUNT_KEY;

  // BEFORE the fetch, if that variable is missing or empty, return 503
  if (!accountKey || accountKey.trim() === '') {
    return res.status(503).json({
      keyConfigured: false,
      ltaAnswered: false,
      error: "LTA_ACCOUNT_KEY is not set. Add it in Vercel and redeploy."
    });
  }

  try {
    const upstreamUrl = 'https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=04121';
    const upstreamRes = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        AccountKey: accountKey.trim()
      }
    });

    // AFTER the fetch, check response.ok before reading the body
    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({
        keyConfigured: true,
        ltaAnswered: true,
        upstreamStatus: upstreamRes.status,
        error: `LTA DataMall upstream returned HTTP ${upstreamRes.status} ${upstreamRes.statusText || ''}`.trim()
      });
    }

    return res.status(200).json({
      keyConfigured: true,
      ltaAnswered: true,
      upstreamStatus: upstreamRes.status,
      message: 'LTA DataMall connection healthy'
    });
  } catch (err) {
    return res.status(502).json({
      keyConfigured: true,
      ltaAnswered: false,
      upstreamStatus: null,
      error: 'Failed to connect to LTA DataMall upstream: ' + (err instanceof Error ? err.message : String(err))
    });
  }
}
