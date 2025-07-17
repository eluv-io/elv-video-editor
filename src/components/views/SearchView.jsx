import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import {rootStore} from "@/stores/index.js";
import {Panel, PanelGroup, PanelResizeHandle} from "react-resizable-panels";
import {useParams} from "wouter";
import SearchResults from "@/components/search/SearchResults.jsx";

const SimpleView = observer(() => {
  const {resultIndex} = useParams();

  useEffect(() => {
    rootStore.SetPage("search");
  }, []);

  if(typeof resultIndex === "undefined") {
    return <SearchResults />;
  }

  return (
    <PanelGroup direction="horizontal" className="panel-group">
      <Panel id="left" order={1} defaultSize={65}>
        Search
      </Panel>
      <PanelResizeHandle />
      <Panel id="right" order={2} minSize={35}>
        Results
      </Panel>
    </PanelGroup>
  );
});

export default SimpleView;
