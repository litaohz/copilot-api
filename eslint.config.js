import config from "@echristian/eslint-config"

export default config({
  // Preserve exact production artifacts and imported byte-level regression fixtures.
  ignores: [
    "dist/**",
    "dashboard/**",
    "src/lib/responses/**",
    "tests/responses-stable-ids/**",
    "deployment/*manifest.json",
  ],
  prettier: {
    plugins: ["prettier-plugin-packagejson"],
  },
})
