import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import VideoSection from "@/components/video/VideoSection.jsx";
import {SimpleTimeline} from "@/components/timeline/Timeline.jsx";
import {keyboardControlsStore, rootStore, videoStore} from "@/stores/index.js";
import {Panel, PanelGroup, PanelResizeHandle} from "react-resizable-panels";

const SimpleView = observer(() => {
  useEffect(() => {
    rootStore.SetPage("simple");
    keyboardControlsStore.SetActiveStore(videoStore);
    videoStore.LoadMyClips();
  }, []);

  useEffect(() => {
    if(!videoStore.ready) { return; }

    const clipPoints = videoStore.ParseClipParams();

    if(!clipPoints) { return; }

    videoStore.FocusView(clipPoints);
  }, [videoStore.ready]);

  return (
    <PanelGroup direction="vertical" className="panel-group">
      <Panel id="top" order={1} defaultSize={65}>
        <VideoSection />
      </Panel>
      <PanelResizeHandle />
      <Panel id="bottom" order={2} minSize={35}>
        <SimpleTimeline />
      </Panel>
    </PanelGroup>
  );
});

export default SimpleView;
