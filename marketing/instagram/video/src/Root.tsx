import { Composition } from "remotion";
import { Carousel } from "./Carousel";
import { Reel, TOTAL_FRAMES } from "./Reel";

export const Root = () => (
  <>
    <Composition id="Reel" component={Reel} durationInFrames={TOTAL_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Carousel" component={Carousel} durationInFrames={1} fps={30} width={1080} height={1350} defaultProps={{ slide: 1 }} />
  </>
);
