import { Composition, Still } from "remotion";
import { Cover1, Cover2, Cover3, Cover4, Cover5, Cover6, ThumbInstall, ThumbInstallEn, ThumbMain, ThumbTutorial } from "./Stills";
import { Presentation, PRESENTATION_FRAMES } from "./Presentation";
import { SHORTS } from "./Shorts";
import { Short06, SHORT06_FRAMES } from "./Short06";
import { Install, INSTALL_EN_FRAMES, INSTALL_FRAMES, InstallEn } from "./Install";
import { Tutorial, TUTORIAL_FRAMES } from "./Tutorial";
import { REEL_INSTALL_EN_FRAMES, REEL_INSTALL_FRAMES, ReelCover, ReelCoverEn, ReelInstall, ReelInstallEn } from "./ReelInstall";

export const Root = () => (
  <>
    <Composition id="Presentation" component={Presentation} durationInFrames={PRESENTATION_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ subtitles: false }} />
    <Composition id="PresentationClean" component={Presentation} durationInFrames={PRESENTATION_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ subtitles: false }} />
    <Composition id="Tutorial" component={Tutorial} durationInFrames={TUTORIAL_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ subtitles: false }} />
    {SHORTS.map((s) => <Composition key={s.id} id={s.id} component={s.comp} durationInFrames={s.frames} fps={30} width={1080} height={1920} />)}
    <Composition id="Install" component={Install} durationInFrames={INSTALL_FRAMES} fps={30} width={1920} height={1080} />
    <Composition id="InstallEn" component={InstallEn} durationInFrames={INSTALL_EN_FRAMES} fps={30} width={1920} height={1080} />
    <Composition id="Short06" component={Short06} durationInFrames={SHORT06_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="ReelInstall" component={ReelInstall} durationInFrames={REEL_INSTALL_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="ReelInstallEn" component={ReelInstallEn} durationInFrames={REEL_INSTALL_EN_FRAMES} fps={30} width={1080} height={1920} />
    <Still id="ReelCover" component={ReelCover} width={1080} height={1920} />
    <Still id="ReelCoverEn" component={ReelCoverEn} width={1080} height={1920} />
    <Still id="ThumbMain" component={ThumbMain} width={1280} height={720} />
    <Still id="ThumbTutorial" component={ThumbTutorial} width={1280} height={720} />
    <Still id="ThumbInstall" component={ThumbInstall} width={1280} height={720} />
    <Still id="ThumbInstallEn" component={ThumbInstallEn} width={1280} height={720} />
    {[Cover1, Cover2, Cover3, Cover4, Cover5, Cover6].map((c, i) => <Still key={i} id={`Cover${i + 1}`} component={c} width={1080} height={1920} />)}
  </>
);
