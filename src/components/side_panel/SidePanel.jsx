import SidePanelStyles from "@/assets/stylesheets/modules/side-panel.module.scss";

import React from "react";
import {observer} from "mobx-react";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";

const S = CreateModuleClassMatcher(SidePanelStyles);


const SidePanel = observer(() => {
  return (
    <div className={S("content-block", "side-panel-section")}>
      <div className={S("side-panel")}>
        <h1 className={S("side-panel__title")}>
          Side Panel
        </h1>
      </div>
    </div>
  );
});

export default SidePanel;
