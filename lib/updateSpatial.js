import { unlink, writeFile } from "node:fs/promises";
import path from "path";
import exec from "./exec.js";
import db from "./db.js";

export default async () => {
  try {
    await unlink(path.join(process.env.STORAGE_PATH, "stops.sqlite"));
  } catch (e) {}

  const stopsDB = db(path.join(process.env.STORAGE_PATH, "stops.sqlite"));
  const gtfs = db(path.join(process.env.STORAGE_PATH, "gtfs.sqlite"));

  try {
    await stopsDB.exec(
      "CREATE TABLE IF NOT EXISTS stops (stop_id INTEGER NOT NULL)",
    );
  } catch (e) {}
  try {
    await stopsDB.exec(
      "SELECT AddGeometryColumn('stops', 'point', 4326, 'POINT', 'XY')",
    );
    await stopsDB.exec("SELECT CreateSpatialIndex('stops', 'point')");
  } catch (e) {}

  const stops = await gtfs
    .query("SELECT stop_id,stop_lat,stop_lon FROM stops")
    .then((data) => data.map(([id, lat, lon]) => [+id, +lat, +lon]))
    .then((rows) =>
      rows.filter(([_, lat, lon]) => {
        if (Number.isNaN(lat) || Number.isNaN(lon)) {
          return false;
        }
        return true;
      }),
    )
    .then((rows) =>
      rows.map(
        ([id, lat, lon]) =>
          `(${id}, ST_GEOMFROMTEXT('POINT(${lon} ${lat})', 4326))`,
      ),
    );

  const sql = `INSERT INTO stops VALUES\n  ${stops.join(",\n  ")};`;
  await writeFile(path.join(process.env.STORAGE_PATH, "stops.sql"), sql);

  try {
    await exec(
      `cat ${path.join(process.env.STORAGE_PATH, "stops.sql")} | spatialite ${path.join(process.env.STORAGE_PATH, "stops.sqlite")}`,
    );
  } catch (e) {}

  console.log("done");
};
