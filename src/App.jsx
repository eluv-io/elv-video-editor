// Ensure common and shared styles are loaded before any specific styles
import "@/assets/stylesheets/modules/common.module.scss";
import "@/assets/stylesheets/modules/shared.module.scss";

import {observer} from "mobx-react";
import React, {useEffect, useRef} from "react";
import {keyboardControlsStore, rootStore, videoStore} from "@/stores";
import {Linkish, Loader} from "@/components/common/Common";
import {Redirect, Route, Switch, useParams, useRoute} from "wouter";
import Browser from "@/components/nav/Browser";
import UrlJoin from "url-join";
import Nav from "@/components/nav/Nav.jsx";
import Tags from "@/components/video/Tags.jsx";
import Assets from "@/components/assets/Assets.jsx";

// Keep track of the current page
const SetView = observer(() => {
  // eslint-disable-next-line no-unused-vars
  const [_, params] = useRoute("/:objectId/:libraryId/:view/*?");

  useEffect(() => {
    if(!videoStore.ready) { return; }

    rootStore.SetView(params?.view || "source");
  }, [params, videoStore.ready]);
});

// All routes after content is selected - route will contain /:libraryId/:objectId
const ContentRoutes = observer(() => {
  const { libraryId, objectId } = useParams();

  useEffect(() => {
    if(libraryId && objectId && !videoStore.loading && videoStore.videoObject?.objectId !== objectId) {
      videoStore.SetVideo({libraryId, objectId});
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
      <Route path="/tags">
        <Tags />
      </Route>
      <Route path="/clips">
        <Tags />
      </Route>
      <Route path="/assets/:assetKey?">
        <Assets />
      </Route>
      <Route>
        <Redirect to={videoStore.isVideo ? "/tags" : "/assets"} replace />
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
          !rootStore.initialized ?
            <Loader /> :
            <Switch>
              <Route path="/:libraryId?">
                <Browser />
              </Route>
              <Route path="/:libraryId/:objectId" nest>
                <ContentRoutes />
              </Route>
              <Route>
                <Redirect to="/" />
              </Route>
            </Switch>
        }
      </div>
    </div>
  );
});

export default App;
