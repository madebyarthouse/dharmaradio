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
    purpose?: string;
  }[];
};

export const config: Config = {
  productionDomain,
  productionUrl: `https://${productionDomain}`,
  themeColor: "#608063",
  manifest: {
    name: "Dharma Radio",
    shortName: "DharmaRadio",
    description: "A podcast player for meditation talks",
    backgroundColor: "#ffffff",
    themeColor: "#608063",
    display: "standalone",
    orientation: "portrait",
    icons: [
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  },
};
