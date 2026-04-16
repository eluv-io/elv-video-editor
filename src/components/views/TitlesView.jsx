import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import {rootStore} from "@/stores/index.js";
import {Redirect, Route, Switch} from "wouter";
import Titles from "@/components/titles/Titles.jsx";
import Title from "@/components/titles/Title.jsx";
import TitleMetadata from "@/components/titles/TitleMetadata.jsx";
import TitleClip from "@/components/titles/TitleClip.jsx";

const TitlesView = observer(() => {
  useEffect(() => {
    rootStore.SetPage("titles");
  }, []);

  return (
    <Switch>
      <Route path="/:titleId/metadata">
        <TitleMetadata />
      </Route>
      <Route path="/:titleId/clip/:clipId">
        <TitleClip />
      </Route>
      <Route path="/:titleId">
        <Title />
      </Route>
      <Route path="/">
        <Titles />
      </Route>
      <Route>
        <Redirect to="~/" />
      </Route>
    </Switch>
  );
});

export default TitlesView;
