import "./lib/config.js";

import fastify from "fastify";
import path from "path";
import update from "./lib/updateGTFS.js";
import db from "./lib/db.js";

const main = async () => {
  // Update immedaitely, if necessary, and schedule a recurring update once an
  // hour, indefinitely.
  update();
  setInterval(update, 3_600_000);

  const server = fastify();

  const stops = db(path.join(process.env.STORAGE_PATH, "stops.sqlite"));

  server.get("/:lat/:lon", async (req, res) => {
    const { lat, lon } = req.params;
    const latitude = +lat;
    const longitude = +lon;

    if (Number.isNaN(latitude)) {
      res.code(400).send("Error: lat must be a number");
    }
    if (Number.isNaN(longitude)) {
      res.code(400).send("Error: lon must be a number");
    }
    if (latitude > 90 || latitude < -90) {
      res.code(400).send("Error: lat must be between -90 and +90");
    }
    if (longitude > 180 || longitude < -180) {
      res.code(400).send("Error: lon must be between -180 and +180");
    }

    console.log(`got request for ${latitude}, ${longitude}`);

    const pt = `ST_GEOMFROMTEXT('POINT(${lon} ${lat})',4326)`;

    // Get stops within 1 mile of the user
    const sql = `SELECT stop_id,ST_DISTANCE(point,${pt},1) as distance FROM stops
      WHERE PTDISTWITHIN(point,${pt},1609)
      ORDER BY distance`;
    const ids = await stops
      .query(sql)
      .then((rows) =>
        rows
          .map(([id, meters]) => [+id, meters / 1609.34])
          .filter(([id]) => id > 0),
      );

    const results = await Promise.all(
      ids.map(([id, distance]) =>
        fetch(`https://svc.metrotransit.org/nextrip/${id}`)
          .then((r) => r.json())
          .then((r) => ({ ...r, id, distance })),
      ),
    ).then((stops) => stops.filter(({ departures }) => departures.length > 0));

    if (results.length > 0) {
      const buses = results
        .slice(0, 3)
        .map((stop) => {
          const departure = stop.departures[0];

          return `• ${departure.departure_text}: bus ${departure.route_id} ${departure.direction_text} from ${stop.stops[0].description} to ${departure.description} (stop ${stop.id})`;
        })
        .join("\n");
      res.send(`Buses leaving within 1 mile:\n${buses}`);
    } else {
      res.send("No buses scheduled to depart within 1 mile");
    }
  });

  server.listen({ port: process.env.PORT, host: "0.0.0.0" }, (err, address) => {
    console.log(`listening on ${address}`);
  });
};

main();
