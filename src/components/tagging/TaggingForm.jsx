import BrowserStyles from "@/assets/stylesheets/modules/browser.module.scss";
import TaggingStyles from "@/assets/stylesheets/modules/tagging.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import {keyboardControlsStore, rootStore} from "@/stores/index.js";
import {Redirect, Route, Switch, useParams} from "wouter";
import {CardDisplaySwitch, SearchBar, TaggingJobBrowser} from "@/components/nav/Browser.jsx";
import {IconButton, Linkish, Loader, StyledButton} from "@/components/common/Common.jsx";
import BackIcon from "@/assets/icons/v2/back.svg";
import UrlJoin from "url-join";
import {GroundTruthPoolSaveButton} from "@/components/ground_truth/GroundTruthForms.jsx";
import GroundTruthIcon from "@/assets/icons/v2/ground-truth.svg";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";

const S = CreateModuleClassMatcher(BrowserStyles, TaggingStyles);

const TaggingForm = observer(() => {
  useEffect(() => {
    rootStore.SetPage("tagging");
    keyboardControlsStore.ToggleKeyboardControls(false);
  }, []);

  return (
    <div className={S("browser-page")}>
      <div className={S("browser")}>
        <SearchBar
          placeholder="Label, Description, Filename"
          saveByLocation
        />
        <h1 className={S("browser__header")}>
          <IconButton
            icon={BackIcon}
            label="Back to Jobs List"
            to="/"
            className={S("browser__header-back")}
          />
          <Linkish to="/">
            AI Runtime
          </Linkish>
          <span className={S("browser__header-chevron")}>▶</span>
          <span>
            New Job
          </span>
          <span className={S("browser__header-chevron")}>▶</span>
          <span className={S("browser__header-last")}>
            Select Content
          </span>
        </h1>
      </div>
    </div>
  );
});

export default TaggingForm;
