import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import VideoSection from "@/components/video/VideoSection.jsx";
import {SimpleTimeline} from "@/components/timeline/Timeline.jsx";
import PanelView from "@/components/side_panel/PanelView.jsx";
import {keyboardControlsStore, rootStore, videoStore} from "@/stores/index.js";

const SimpleView = observer(() => {
  useEffect(() => {
    rootStore.SetPage("simple");
    keyboardControlsStore.SetActiveStore(videoStore);
  }, []);

  return (
    <PanelView
      mainPanelContent={
        <VideoSection  />
      }
      bottomPanelContent={
        <SimpleTimeline />
      }
      minSizes={{
        bottomPanel: 290
      }}
      initialTopPanelProportion={0.8}
    />
  );
});

export default SimpleView;
