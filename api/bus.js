/**
 * Vercel Serverless Function: api/bus.js
 * Accepts BusStopCode query parameter (defaults to 04121).
 * Calls LTA DataMall BusArrival v3 and returns a simplified list of services
 * with the minutes until each of the next two buses.
 */

export default async function handler(req, res) {
  const accountKey = process.env.LTA_ACCOUNT_KEY;

  // BEFORE the fetch, if that variable is missing or empty, return 503
  if (!accountKey || accountKey.trim() === '') {
    return res.status(503).json({
      error: "LTA_ACCOUNT_KEY is not set. Add it in Vercel and redeploy."
    });
  }

  // Parse BusStopCode query parameter, default to 04121
  const query = req.query || {};
  let busStopCode = query.BusStopCode || query.busStopCode;
  if (!busStopCode && req.url) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      busStopCode = parsedUrl.searchParams.get('BusStopCode') || parsedUrl.searchParams.get('busStopCode');
    } catch {
      // ignore parsing errors
    }
  }
  busStopCode = (busStopCode ? String(busStopCode).trim() : '') || '04121';

  try {
    const upstreamUrl = `https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=${encodeURIComponent(busStopCode)}`;
    const upstreamRes = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        AccountKey: accountKey.trim()
      }
    });

    // AFTER the fetch, check response.ok before reading the body
    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({
        upstreamStatus: upstreamRes.status,
        error: `LTA DataMall upstream returned HTTP ${upstreamRes.status} ${upstreamRes.statusText || ''}`.trim()
      });
    }

    const data = await upstreamRes.json();
    // Treat an empty Services array as "no buses running", not as an error
    const rawServices = Array.isArray(data?.Services) ? data.Services : [];
    const now = Date.now();

    const simplifiedList = rawServices.map((service) => {
      const nextBuses = [];

      // Check NextBus
      if (
        service?.NextBus?.EstimatedArrival &&
        typeof service.NextBus.EstimatedArrival === 'string' &&
        service.NextBus.EstimatedArrival.trim() !== ''
      ) {
        const arrivalTime = new Date(service.NextBus.EstimatedArrival).getTime();
        if (!isNaN(arrivalTime)) {
          const diffMs = arrivalTime - now;
          const minutes = Math.max(0, Math.floor(diffMs / 60000));
          nextBuses.push(minutes);
        }
      }

      // Check NextBus2
      if (
        service?.NextBus2?.EstimatedArrival &&
        typeof service.NextBus2.EstimatedArrival === 'string' &&
        service.NextBus2.EstimatedArrival.trim() !== ''
      ) {
        const arrivalTime = new Date(service.NextBus2.EstimatedArrival).getTime();
        if (!isNaN(arrivalTime)) {
          const diffMs = arrivalTime - now;
          const minutes = Math.max(0, Math.floor(diffMs / 60000));
          nextBuses.push(minutes);
        }
      }

      return {
        ServiceNo: service.ServiceNo || '',
        nextBuses,
        minutes: nextBuses
      };
    });

    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');
    return res.status(200).json(simplifiedList);
  } catch (err) {
    return res.status(502).json({
      error: 'Failed to communicate with LTA DataMall: ' + (err instanceof Error ? err.message : String(err))
    });
  }
}
