import { Composition, Still } from "remotion";
import { Cover1, Cover2, Cover3, Cover4, Cover5, ThumbMain, ThumbTutorial } from "./Stills";
import { Presentation, PRESENTATION_FRAMES } from "./Presentation";
import { SHORTS } from "./Shorts";
import { Tutorial, TUTORIAL_FRAMES } from "./Tutorial";

export const Root = () => (
  <>
    <Composition id="Presentation" component={Presentation} durationInFrames={PRESENTATION_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ subtitles: false }} />
    <Composition id="PresentationClean" component={Presentation} durationInFrames={PRESENTATION_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ subtitles: false }} />
    <Composition id="Tutorial" component={Tutorial} durationInFrames={TUTORIAL_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ subtitles: false }} />
    {SHORTS.map((s) => <Composition key={s.id} id={s.id} component={s.comp} durationInFrames={s.frames} fps={30} width={1080} height={1920} />)}
    <Still id="ThumbMain" component={ThumbMain} width={1280} height={720} />
    <Still id="ThumbTutorial" component={ThumbTutorial} width={1280} height={720} />
    {[Cover1, Cover2, Cover3, Cover4, Cover5].map((c, i) => <Still key={i} id={`Cover${i + 1}`} component={c} width={1080} height={1920} />)}
  </>
);
