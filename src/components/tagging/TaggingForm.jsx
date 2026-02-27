import BrowserStyles from "@/assets/stylesheets/modules/browser.module.scss";
import TaggingStyles from "@/assets/stylesheets/modules/tagging.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {keyboardControlsStore, rootStore} from "@/stores/index.js";
import {Redirect, Route, Switch, useParams} from "wouter";
import {
  CardDisplaySwitch,
  LibraryBrowser,
  ObjectBrowser,
  SearchBar,
  TaggingJobBrowser
} from "@/components/nav/Browser.jsx";
import {IconButton, Linkish, Loader, Modal, StyledButton} from "@/components/common/Common.jsx";
import BackIcon from "@/assets/icons/v2/back.svg";
import UrlJoin from "url-join";
import {GroundTruthPoolSaveButton} from "@/components/ground_truth/GroundTruthForms.jsx";
import GroundTruthIcon from "@/assets/icons/v2/ground-truth.svg";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";

const S = CreateModuleClassMatcher(BrowserStyles, TaggingStyles);

const TaggingForm = observer(() => {
  const [libraryId, setLibraryId] = useState(null);
  useEffect(() => {
    rootStore.SetPage("tagging");
    keyboardControlsStore.ToggleKeyboardControls(false);
  }, []);

  return (
    <div className={S("browser-page")}>

    </div>
  );
});

export default TaggingForm;
