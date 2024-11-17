import { useState } from "react";
import clsx from "clsx";

type ImageProps = {
  src: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  aspectRatio?: "square" | "video" | "portrait";
  objectFit?: "cover" | "contain";
};

const FALLBACK_IMAGE_BASE64 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export function Image({
  src,
  alt,
  className,
  fallbackSrc = FALLBACK_IMAGE_BASE64,
  aspectRatio = "square",
  objectFit = "cover",
}: ImageProps) {
  const [error, setError] = useState(false);

  const aspectRatioClasses = {
    square: "aspect-square",
    video: "aspect-video",
    portrait: "aspect-[3/4]",
  };

  return (
    <img
      src={error ? fallbackSrc : src}
      alt={alt}
      onError={() => setError(true)}
      className={clsx(
        "transition-all duration-300",
        aspectRatioClasses[aspectRatio],
        `object-${objectFit}`,
        className
      )}
    />
  );
}
