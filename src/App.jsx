// Ensure common and shared styles are loaded before any specific styles
import "@/assets/stylesheets/modules/common.module.scss";
import "@/assets/stylesheets/modules/shared.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useRef} from "react";
import {compositionStore, keyboardControlsStore, rootStore, tagStore, videoStore} from "@/stores";
import {Linkish, Loader} from "@/components/common/Common";
import {Redirect, Route, Switch, useLocation, useParams, useRoute} from "wouter";
import Browser from "@/components/nav/Browser";
import UrlJoin from "url-join";
import Nav from "@/components/nav/Nav.jsx";
import TagsAndClipsView from "@/components/views/TagsAndClipsView.jsx";
import AssetsView from "@/components/views/AssetsView.jsx";
import CompositionsView from "@/components/views/CompositionsView.jsx";

// Keep track of the current page
const SetView = observer(() => {
  // eslint-disable-next-line no-unused-vars
  const [_, params] = useRoute("/:objectId/:libraryId/:view/*?");
  const [location, navigate] = useLocation();

  useEffect(() => {
    if(!videoStore.ready) { return; }

    rootStore.SetNavigation(location, navigate);
    rootStore.SetPage(params?.view || "source");
    tagStore.Reset();
  }, [params, videoStore.ready]);
});

// All routes after content is selected - route will contain /:libraryId/:objectId
const DefaultContentRoutes = observer(() => {
  const { objectId } = useParams();

  useEffect(() => {
    if(objectId && !videoStore.loading && videoStore.videoObject?.objectId !== objectId) {
      videoStore.SetVideo({objectId});
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
      <Route path="/compositions">
        <CompositionsView />
      </Route>
      <Route path="/tags">
        <TagsAndClipsView mode="tags" />
      </Route>
      <Route path="/clips">
        <TagsAndClipsView mode="clips" />
      </Route>
      <Route path="/assets/:assetKey?">
        <AssetsView />
      </Route>
      <Route>
        <Redirect to={videoStore.isVideo ? "/clips" : "/assets"} replace />
      </Route>
    </Switch>
  );
});

// All routes after content is selected - route will contain /:libraryId/:objectId
const CompositionRoutes = observer(() => {
  const { objectId } = useParams();

  useEffect(() => {
    rootStore.SetPage("compositions");
    rootStore.SetSubpage(objectId);

    if(objectId && !compositionStore.loading && compositionStore.videoObject?.objectId !== objectId) {
      compositionStore.SetVideo({objectId});
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
  } else if(!compositionStore.ready) {
    return <Loader />;
  }

  return (
    <Switch>
      <Route path="">
        <CompositionsView />
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
              <Route path="/compositions/:objectId?">
                <CompositionRoutes />
              </Route>
              <Route path="/:libraryId?">
                <Browser />
              </Route>
              <Route path="/:libraryId/:objectId" nest>
                <DefaultContentRoutes />
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
