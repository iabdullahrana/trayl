const path = require("node:path");
const loadConfig = require("tailwindcss/loadConfig");
const config = loadConfig(path.join(__dirname, "../../tailwind.config.ts"));
module.exports = {
  ...config,
  content: [
    path.join(__dirname, "../../components/**/*.tsx"),
    path.join(__dirname, "../../app/**/*.tsx"),
    path.join(__dirname, "app/**/*.tsx"),
  ],
};
