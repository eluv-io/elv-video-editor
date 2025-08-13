// Ensure common and shared styles are loaded before any specific styles
import "@/assets/stylesheets/modules/common.module.scss";
import "@/assets/stylesheets/modules/shared.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useRef} from "react";
import {keyboardControlsStore, rootStore, tagStore, videoStore} from "@/stores";
import {Linkish, Loader} from "@/components/common/Common";
import {Redirect, Route, Switch, useLocation, useParams, useRoute} from "wouter";
import Browser from "@/components/nav/Browser";
import UrlJoin from "url-join";
import Nav from "@/components/nav/Nav.jsx";
import TagsAndClipsView from "@/components/views/TagsAndClipsView.jsx";
import AssetsView from "@/components/views/AssetsView.jsx";
import CompositionsView from "@/components/views/CompositionsView.jsx";
import SimpleView from "@/components/views/SimpleView.jsx";
import GroundTruthView from "@/components/views/GroundTruthView.jsx";
import SearchView from "@/components/views/SearchView.jsx";

// Keep track of the current page
const SetView = observer(() => {

  const [, params] = useRoute("/:objectId/:view/*?");
  const [location, navigate] = useLocation();

  useEffect(() => {
    if(!videoStore.ready) { return; }

    rootStore.SetNavigation(location, navigate);
    tagStore.Reset();
  }, [params, videoStore.ready]);
});

// All routes after content is selected - route will contain /:objectId
const DefaultContentRoutes = observer(() => {
  const { objectId } = useParams();

  useEffect(() => {
    if(objectId && !videoStore.loading && videoStore.videoObject?.objectId !== objectId) {
      rootStore.Reset();
      videoStore.SetVideo({objectId, addToMyLibrary: true})
        .then(() => rootStore.SetSelectedObjectId(objectId, videoStore.name));
    } else {
      rootStore.SetSelectedObjectId(objectId, videoStore.name);
    }
  }, [objectId]);

  if(rootStore.errorMessage) {
    return (
      <div className="error">
        <div>Unable to load content: </div>
        <div>{rootStore.errorMessage}</div>
        <Linkish to="~/" styled>Return to Content Browser</Linkish>
      </div>
    );
  } else if(!videoStore.ready) {
    return <Loader />;
  }

  return (
    <Switch>
      <Route path="/" exact>
        <SimpleView />
      </Route>
      <Route path="/tags">
        <TagsAndClipsView key="tags" mode="tags" />
      </Route>
      <Route path="/clips">
        <TagsAndClipsView key="clips" mode="clips" />
      </Route>
      <Route path="/assets/:assetKey?">
        <AssetsView />
      </Route>
      <Route>
        <Redirect to={videoStore.isVideo ? "/" : "/assets"} replace />
      </Route>
    </Switch>
  );
});

const App = observer(() => {
  const ref = useRef(null);

  useEffect(() => {
    if(!ref?.current) { return; }

    const SetControlsActive = event => {
      keyboardControlsStore.ToggleKeyboardControlsActive(
        event.type !== "blur" &&
        ref.current.contains(document.activeElement) &&
        !["input", "textarea"].includes(document.activeElement?.tagName?.toLowerCase())
      );
    };

    window.addEventListener("blur", SetControlsActive);
    document.addEventListener("focusin", SetControlsActive);

    return () => {
      window.removeEventListener("blur", SetControlsActive);
      document.removeEventListener("focusin", SetControlsActive);
    };
  }, [ref]);

  if(window.self === window.top) {
    // Not in Core frame - Redirect
    window.location = UrlJoin(EluvioConfiguration.coreUrl, "/", window.location.hash);
    return;
  }

  if(!rootStore.client) {
    return null;
  }

  return (
    <div
      tabIndex={0}
      onKeyDown={keyboardControlsStore.HandleInput}
      onKeyUp={keyboardControlsStore.HandleModifiers}
      id="page-container"
      className="page-container"
      ref={ref}
    >
      <Nav />
      <div className="content">
        <SetView />
        {
          !rootStore?.initialized ?
            <Loader /> :
            <Switch>
              <Route path="/compositions">
                <CompositionsView />
              </Route>
              <Route path="/ground-truth" nest>
                <GroundTruthView />
              </Route>
              <Route path="/compositions/:objectId/:compositionKey">
                <CompositionsView key="selected" />
              </Route>
              <Route path="/search" nest>
                <SearchView />
              </Route>
              <Route path="/browse" nest>
                <Browser />
              </Route>
              <Route path="/:objectId" nest>
                <DefaultContentRoutes />
              </Route>
              <Route>
                <Redirect to="/browse" />
              </Route>
            </Switch>
        }
      </div>
    </div>
  );
});

export default App;
