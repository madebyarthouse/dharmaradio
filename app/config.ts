const productionDomain =
  (typeof process !== "undefined" && process.env.PUBLIC_APP_DOMAIN) ||
  "dharmarad.io";
const productionUrl =
  (typeof process !== "undefined" && process.env.PUBLIC_APP_URL) ||
  `https://${productionDomain}`;

type Config = {
  productionDomain: string;
  productionUrl: string;
  themeColor: string;
  themeColorDark: string;
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
    purpose?: string;
  }[];
};

export const config: Config = {
  productionDomain,
  productionUrl,
  themeColor: "#f6f1e9",
  themeColorDark: "#141628",
  manifest: {
    name: "Dharma Radio",
    shortName: "DharmaRadio",
    description: "A podcast player for meditation talks",
    backgroundColor: "#f6f1e9",
    themeColor: "#f6f1e9",
    display: "standalone",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  },
};
