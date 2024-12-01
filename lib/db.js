import exec from "./exec.js";

export default (path) => {
  const dbExec = async (sql) => exec(`spatialite ${path} "${sql}"`);

  return {
    exec: dbExec,
    query: async (sql) => {
      const out = await dbExec(sql);
      return out.split("\n").map((row) => row.split("|"));
    },
  };
};
