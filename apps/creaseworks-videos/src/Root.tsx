import React from "react";
import { Composition, staticFile } from "remotion";
import { Walkthrough } from "./Walkthrough";
import { CordCartoon } from "./CordCartoon";
import { SceneVideo } from "./SceneVideo";

const INTRO_FRAMES = 60;
const STEP_FRAMES = 45;
const OUTRO_FRAMES = 60;
const STEP_COUNT = 5;
const WALKTHROUGH_TOTAL = INTRO_FRAMES + STEP_COUNT * STEP_FRAMES + OUTRO_FRAMES; // 345

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Walkthrough />
      <Composition
        id="CordCartoon"
        component={CordCartoon}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="SceneVideo"
        component={SceneVideo}
        durationInFrames={750}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          table: staticFile("playdate-table.jpg"),
        }}
      />
    </>
  );
};
