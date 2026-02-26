import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import {keyboardControlsStore, rootStore} from "@/stores/index.js";
import {Redirect, Route, Switch, useParams} from "wouter";
import {TaggingJobBrowser} from "@/components/nav/Browser.jsx";
import TaggingForm from "@/components/tagging/TaggingForm.jsx";

const Wrapper = observer(({children}) => {
  const {contentId} = useParams();

  useEffect(() => {
    rootStore.SetSubpage(contentId);
  }, [rootStore.page, contentId]);

  return children;
});

const TaggingView = observer(() => {
  useEffect(() => {
    rootStore.SetPage("tagging");
    keyboardControlsStore.ToggleKeyboardControls(false);
  }, []);

  return (
    <Switch>
      <Route path="/" exact>
        <Wrapper>
          <TaggingJobBrowser />
        </Wrapper>
      </Route>
      <Route path="/new" exact>
        <Wrapper>
          <TaggingForm />
        </Wrapper>
      </Route>
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
});

export default TaggingView;
