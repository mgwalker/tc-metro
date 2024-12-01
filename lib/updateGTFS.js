import { importGtfs } from "gtfs";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import updateSpatial from "./updateSpatial.js";

export default async () => {
  const lastChecked = new Date(
    Number.parseInt(
      await readFile(path.join(process.env.STORAGE_PATH, "last-updated"), {
        encoding: "utf-8",
      }).catch(() => 0),
      10,
    ),
  ).toUTCString();

  const hasUpdates = await fetch(
    "https://svc.metrotransit.org/mtgtfs/gtfs.zip",
    {
      method: "HEAD",
      headers: { "If-Modified-Since": lastChecked },
    },
  ).then((r) => {
    if (r.status === 200) {
      return true;
    }
    return false;
  });

  if (hasUpdates) {
    console.log("updating schedule");
    await importGtfs({
      agencies: [
        {
          url: "https://svc.metrotransit.org/mtgtfs/gtfs.zip",
          exclude: [
            "agency",
            "routes",
            "trips",
            "stop_times",
            "calendar",
            "calendar_dates",
            "fare_attributes",
            "fare_rules",
            "timeframes",
            "fare_media",
            "fare_products",
            "fare_leg_rules",
            "fare_transfer_rules",
            "areas",
            "stop_areas",
            "networks",
            "route_networks",
            "shapes",
            "frequencies",
            "transfers",
            "pathways",
            "levels",
            "location_groups",
            "location_group_stops",
            "locations",
            "booking_rules",
            "translations",
            "feed_info",
            "attributions",
          ],
        },
      ],
      sqlitePath: path.join(process.env.STORAGE_PATH, "gtfs.sqlite"),
    });
    await writeFile(
      path.join(process.env.STORAGE_PATH, "last-updated"),
      `${Date.now()}`,
    );

    await updateSpatial();
  } else {
    console.log("no update available");
  }
};
