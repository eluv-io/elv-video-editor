import NavStyles from "Assets/stylesheets/modules/nav.module.scss";

import React from "react";
import {observer} from "mobx-react";
import {rootStore, videoStore} from "Stores";
import {CreateModuleClassMatcher} from "Utils/Utils";
import {IconButton} from "Components/common/Common";

import SourceIcon from "Assets/icons/v2/source";
import TagIcon from "Assets/icons/v2/tag";
import ClipIcon from "Assets/icons/v2/clip";
import AssetIcon from "Assets/icons/v2/asset";

const S = CreateModuleClassMatcher(NavStyles);

const pages = [
  { label: "Source", key: "source", icon: SourceIcon },
  { label: "Tags", key: "tags", icon: TagIcon },
  { label: "Clips", key: "clips", icon: ClipIcon },
  { label: "Assets", key: "assets", icon: AssetIcon }
];

const Sidebar = observer(() => {
  return (
    <nav className={S("sidebar")}>
      {
        pages.map(({label, key, icon}) =>
          <IconButton
            key={`button-${key}`}
            label={label}
            icon={icon}
            onClick={() => rootStore.SetView(key)}
            active={rootStore.view === key}
            disabled={key !== "source" && !videoStore.initialized}
            className={S("sidebar__button")}
          />
        )
      }
    </nav>
  );
});

export default Sidebar;
