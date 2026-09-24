export default async function handler(req, res) {
  const accountKey = process.env.LTA_ACCOUNT_KEY;
  const isConfigured = Boolean(accountKey && accountKey.trim() !== '');

  // BEFORE the fetch, if that variable is missing or empty, return 503
  if (!isConfigured) {
    return res.status(503).json({
      keyConfigured: false,
      ltaAnswered: false,
      error: 'LTA_ACCOUNT_KEY is not set. Add it in Vercel and redeploy.',
    });
  }

  try {
    const upstreamUrl = 'https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=04121';
    const response = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        AccountKey: accountKey,
      },
    });

    // AFTER the fetch, check response.ok before reading the body.
    // LTA returns an empty body on 401, so calling response.json() on a failed reply throws.
    // On a non-2xx reply, return the upstream status and a one-line reason in your own JSON instead.
    if (!response.ok) {
      return res.status(response.status).json({
        keyConfigured: true,
        ltaAnswered: true,
        statusCode: response.status,
        upstreamStatus: response.status,
        error: `LTA upstream returned status ${response.status}`,
      });
    }

    return res.status(200).json({
      keyConfigured: true,
      ltaAnswered: true,
      statusCode: response.status,
      upstreamStatus: response.status,
      status: 'ok',
    });
  } catch (error) {
    return res.status(502).json({
      keyConfigured: true,
      ltaAnswered: false,
      statusCode: 502,
      error: 'Failed to contact LTA upstream service',
    });
  }
}
