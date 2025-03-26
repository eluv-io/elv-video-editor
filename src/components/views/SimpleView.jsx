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
  }, []);

  return (
    <PanelGroup direction="vertical" className="panel-group">
      <Panel defaultSize={65}>
        <VideoSection />
      </Panel>
      <PanelResizeHandle />
      <Panel minSize={35}>
        <SimpleTimeline />
      </Panel>
    </PanelGroup>
  );
});

export default SimpleView;
