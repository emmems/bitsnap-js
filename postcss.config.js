module.exports = {
  plugins: [
    require("tailwindcss")(),
    require("autoprefixer")(),
    require("postcss-prefix-selector")({
      prefix: ".bitsnap-checkout",
    }),
  ],
};
