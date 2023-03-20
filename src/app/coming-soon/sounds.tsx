"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";

const sounds = [
  {
    src: null,
    label: "None",
  },
  {
    src: "/sounds/waves-hitting-the-rocks.mp3",
    label: "Ocean",
  },
  {
    src: "/sounds/light-rain-ambient.mp3",
    label: "Rain",
  },
  {
    src: "/sounds/forest-wind-and-birds.mp3",
    label: "Forest",
  },
];

export default function Sounds() {
  const [active, setActive] = useState(sounds[0]);

  return (
    <>
      <ul className="rounded-lg border-brand border flex flex-row text-sm">
        {sounds.map((sound, index) => (
          <li key={sound.label} className="group">
            <button
              onClick={(e) => {
                e.preventDefault();
                setActive(sounds[index]);
              }}
              className={clsx(
                "appearance-none bg-transparent rounded-md hover:bg-brand-light hover:text-white transition-colors text-center px-4 py-2  relative group",
                active.label === sound.label ? "text-white" : "text-brand"
              )}
            >
              <span className="relative z-20 group-active:scale-95">
                {sound.label}
              </span>
              {active.label === sound.label && (
                <motion.div
                  layoutId="sounds-active-bg"
                  className="absolute group-active:scale-95 rounded-md z-10 inset-0 bg-brand"
                />
              )}
            </button>
          </li>
        ))}
      </ul>

      {active.src && <audio autoPlay loop src={active.src} />}
    </>
  );
}
