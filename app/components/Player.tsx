import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Heart,
} from "lucide-react";

type PlayerProps = {
  talk?: {
    id: string;
    title: string;
    teacher: string;
    duration: number;
  };
};

export function Player({ talk }: PlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  if (!talk) return null;

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-sage-200 p-4 shadow-lg"
    >
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          <div>
            <h3 className="font-medium text-sage-900">{talk.title}</h3>
            <p className="text-sm text-sage-600">{talk.teacher}</p>
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-center space-x-6">
            <button className="text-sage-600 hover:text-sage-900 transition-colors">
              <SkipBack size={20} />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-12 h-12 rounded-full bg-sage-600 text-white flex items-center justify-center hover:bg-sage-700 transition-colors"
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
            <button className="text-sage-600 hover:text-sage-900 transition-colors">
              <SkipForward size={20} />
            </button>
          </div>
          <div className="mt-2 px-4">
            <div className="h-1 bg-sage-200 rounded-full">
              <motion.div
                className="h-full bg-sage-600 rounded-full"
                style={{ width: `${progress}%` }}
                animate={{ width: isPlaying ? "100%" : `${progress}%` }}
                transition={{ duration: 30, ease: "linear" }}
              />
            </div>
            <div className="flex justify-between text-xs text-sage-600 mt-1">
              <span>1:23</span>
              <span>4:56</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4 flex-1 justify-end">
          <button className="text-sage-600 hover:text-sage-900 transition-colors">
            <Volume2 size={20} />
          </button>
          <button className="text-sage-600 hover:text-rose-500 transition-colors">
            <Heart size={20} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default Player;
