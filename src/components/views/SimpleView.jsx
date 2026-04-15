import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import VideoSection from "@/components/video/VideoSection.jsx";
import {SimpleTimeline} from "@/components/timeline/Timeline.jsx";
import {keyboardControlsStore, rootStore, videoStore} from "@/stores/index.js";
import {Panel, PanelGroup, PanelResizeHandle} from "react-resizable-panels";

const SimpleView = observer(() => {
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

  return (
    <PanelGroup direction="vertical" className="panel-group">
      <Panel id="top" order={1} defaultSize={65}>
        <PanelGroup direction="horizontal" className="panel-group">
          <Panel id="left" order={1}>
            <VideoSection
              showFrameSearch
              showVertical
            />
          </Panel>
          {
            !videoStore.showVertical || !videoStore.verticalVideoStore ? null :
              <>
                <PanelResizeHandle />
                <Panel id="right" order={2} defaultSize={35}>
                  <VideoSection
                    title="Vertical Video"
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
      <Panel id="bottom" order={2} minSize={35}>
        <SimpleTimeline />
      </Panel>
    </PanelGroup>
  );
});

export default SimpleView;
