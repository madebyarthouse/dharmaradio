const productionDomain = "dharmarad.io";

type Config = {
  productionDomain: string;
  productionUrl: string;
  themeColor: string;
  manifest: Manifest;
};

type Manifest = {
  name: string;
  shortName: string;
  description: string;
  backgroundColor: string;
  display: "standalone" | "fullscreen" | "minimal-ui" | "browser";
  themeColor: string;
  orientation:
    | "any"
    | "natural"
    | "landscape"
    | "portrait"
    | "portrait-primary"
    | "portrait-secondary";
  icons: {
    src: string;
    sizes: string;
    type: string;
  }[];
};

export const config: Config = {
  productionDomain,
  productionUrl: `https://${productionDomain}`,
  themeColor: "#527555",
  manifest: {
    name: "Dharma Radio",
    shortName: "Dharma Radio",
    description: "A podcast player for meditation talks",
    backgroundColor: "#ffffff",
    themeColor: "#527555",
    display: "standalone",
    orientation: "portrait",
    icons: [
      // {
      //   src: "/icons/icon-192x192.png",
      //   sizes: "192x192",
      //   type: "image/png",
      // },
      // {
      //   src: "/icons/icon-512x512.png",
      //   sizes: "512x512",
      //   type: "image/png",
      // },
      // {
      //   src: "/icons/icon-512x512.png",
      //   sizes: "512x512",
      //   type: "image/png",
      //   purpose: "maskable",
      // },
    ],
  },
};
