export default async function handler(req, res) {
  const accountKey = process.env.LTA_ACCOUNT_KEY;

  // BEFORE the fetch, if that variable is missing or empty, return 503
  if (!accountKey || accountKey.trim() === '') {
    return res.status(503).json({
      error: 'LTA_ACCOUNT_KEY is not set. Add it in Vercel and redeploy.',
    });
  }

  // Accepts a BusStopCode query parameter, defaults to 04121
  let busStopCode = '04121';
  if (req.query && req.query.BusStopCode) {
    busStopCode = String(req.query.BusStopCode).trim();
  } else if (req.url) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      const queryParam = parsedUrl.searchParams.get('BusStopCode');
      if (queryParam) {
        busStopCode = queryParam.trim();
      }
    } catch {
      // fallback to default
    }
  }

  if (!busStopCode) {
    busStopCode = '04121';
  }

  try {
    const upstreamUrl = `https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=${encodeURIComponent(busStopCode)}`;
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
        error: `LTA upstream returned status ${response.status}`,
        status: response.status,
      });
    }

    const data = await response.json();

    // Set Cache-Control: s-maxage=20, stale-while-revalidate=40
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');

    // Treat an empty Services array as "no buses running", not as an error.
    const services = Array.isArray(data?.Services) ? data.Services : [];
    const now = Date.now();

    // Returns a simplified list: for each service, the ServiceNo and the minutes until each of the next two buses, worked out from the EstimatedArrival timestamps.
    // Note also that LTA returns NextBus2 and NextBus3 as objects whose fields are all empty strings when there is no such bus:
    // treat an empty EstimatedArrival as no bus and omit it from the list, rather than computing a time from it.
    // Never emit NaN or null as a minute. Round down to whole minutes as LTA's guide asks.
    const simplifiedList = services.map((service) => {
      const nextBuses = [];
      const busSlots = ['NextBus', 'NextBus2'];

      for (const slot of busSlots) {
        const bus = service[slot];
        if (
          bus &&
          typeof bus.EstimatedArrival === 'string' &&
          bus.EstimatedArrival.trim() !== ''
        ) {
          const arrivalMs = new Date(bus.EstimatedArrival).getTime();
          if (!Number.isNaN(arrivalMs)) {
            const diffMs = arrivalMs - now;
            const diffMinutes = Math.floor(diffMs / 60000);
            const minutes = Math.max(0, diffMinutes);
            if (Number.isFinite(minutes)) {
              nextBuses.push(minutes);
            }
          }
        }
      }

      return {
        ServiceNo: service.ServiceNo || '',
        nextBuses,
      };
    });

    return res.status(200).json(simplifiedList);
  } catch (error) {
    return res.status(502).json({
      error: 'Failed to contact LTA upstream service',
    });
  }
}
