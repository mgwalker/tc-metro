import { exec as cpExec } from "node:child_process";

export default async (cmd) =>
  new Promise((resolve, reject) => {
    cpExec(cmd, (err, stdout, stderr) => {
      if (err) {
        return reject(err);
      }
      if (stderr) {
        return reject(new Error(stderr));
      }
      return resolve(stdout);
    });
  });
