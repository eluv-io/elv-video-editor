import SidePanelStyles from "Assets/stylesheets/modules/side-panel.module.scss";

import React from "react";
import {observer} from "mobx-react";
import {CreateModuleClassMatcher} from "Utils/Utils";
import {ResizableBox} from "react-resizable";

const S = CreateModuleClassMatcher(SidePanelStyles);


const SidePanel = observer(() => {
  return (
    <ResizableBox
      width={window.innerWidth * 0.2}
      className={S("content-block", "side-panel-section")}
      handle={<div className={S("side-panel-section__handle")}/> }
    >
      <div className={S("side-panel")}>
        <h1 className={S("side-panel__title")}>
          Side Panel
        </h1>
      </div>
    </ResizableBox>
  );
});

export default SidePanel;
