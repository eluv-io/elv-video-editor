import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import VideoSection from "@/components/video/VideoSection.jsx";
import {SimpleTimeline, SummaryTimeline} from "@/components/timeline/Timeline.jsx";
import {keyboardControlsStore, rootStore, videoStore} from "@/stores/index.js";
import {Panel, PanelGroup, PanelResizeHandle} from "react-resizable-panels";
import SynopsisSection from "@/components/timeline/SynopsisSection.jsx";

const SimpleView = observer(() => {
  const [resetBottomSize, setResetBottomSize] = useState(false);
  const showingAlternateView = videoStore.showSynopsisView || videoStore.showSummaryView;

  useEffect(() => {
    rootStore.SetPage("simple");
    videoStore.ToggleShowVertical(false);
    keyboardControlsStore.SetActiveStore(videoStore);
    videoStore.LoadMyClips({objectId: videoStore.videoObject?.objectId});
  }, []);

  useEffect(() => {
    if(!videoStore.ready) { return; }

    const clipPoints = videoStore.ParseClipParams();

    if(!clipPoints) { return; }

    videoStore.FocusView(clipPoints);
  }, [videoStore.ready]);

  useEffect(() => {
    return () => {
      videoStore.ToggleShowVertical(false);
      videoStore.ToggleShowSummaryView(false);
      videoStore.ToggleShowSynopsisView(false);
    };
  }, []);

  // After closing alternate view, set the max size for a moment to resize the bottom panel
  useEffect(() => {
    if(!showingAlternateView) {
      setResetBottomSize(true);

      setTimeout(() => setResetBottomSize(false), 100);
    }
  }, [showingAlternateView]);

  return (
    <PanelGroup direction="vertical" className="panel-group">
      <Panel id="top" order={1} defaultSize={65}>
        <PanelGroup direction="horizontal" className="panel-group">
          <Panel id="left" order={1}>
            <VideoSection
              simple
              showFrameSearch
              showVertical
              showSynopsis
            />
          </Panel>
          {
            !videoStore.showVertical || !videoStore.verticalVideoStore ? null :
              <>
                <PanelResizeHandle className="resize--highlight" />
                <Panel id="right" order={2} defaultSize={35}>
                  <VideoSection
                    name="Vertical Video"
                    store={videoStore.verticalVideoStore}
                    vertical
                    Close={() => videoStore.ToggleShowVertical(false)}
                  />
                </Panel>
              </>
          }
        </PanelGroup>
      </Panel>
      <PanelResizeHandle />
      <Panel
        id="bottom"
        order={2}
        minSize={showingAlternateView ? 55 : 35}
        maxSize={resetBottomSize ? 35 : undefined}
      >
        {
          videoStore.showSynopsisView ?
            <SynopsisSection /> :
            videoStore.showSummaryView ?
              <SummaryTimeline /> :
              <SimpleTimeline />
        }
      </Panel>
    </PanelGroup>
  );
});

export default SimpleView;
