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

    const pt = `ST_GEOMFROMTEXT('POINT(${lon} ${lat})',4326)`;
    const sql = `SELECT stop_id FROM stops
      WHERE PTDISTWITHIN(point,${pt},1000)
      ORDER BY ST_DISTANCE(point,${pt})
      LIMIT 3`;
    const ids = await stops
      .query(sql)
      .then((rows) => rows.map(([id]) => +id).filter((id) => id > 0));

    const results = await Promise.all(
      ids.map((id) =>
        fetch(`https://svc.metrotransit.org/nextrip/${id}`)
          .then((r) => r.json())
          .then((r) => ({ ...r, id })),
      ),
    ).then((stops) => stops.filter(({ departures }) => departures.length > 0));

    res.send(
      results
        .map((stop) => {
          const departure = stop.departures[0];

          return `• Departing from ${stop.stops[0].description} at ${departure.departure_text} on bus ${departure.route_id} ${departure.direction_text} to ${departure.description} (stop ${stop.id})`;
        })
        .join("\n"),
    );
  });

  server.listen({ port: process.env.PORT, host: "0.0.0.0" }, (err, address) => {
    console.log(`listening on ${address}`);
  });
};

main();
