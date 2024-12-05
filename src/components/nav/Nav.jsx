import NavStyles from "@/assets/stylesheets/modules/nav.module.scss";

import React from "react";
import {observer} from "mobx-react";
import {rootStore, videoStore} from "@/stores";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {IconButton} from "@/components/common/Common";

import SourceIcon from "@/assets/icons/v2/source.svg";
import TagIcon from "@/assets/icons/v2/tag.svg";
import ClipIcon from "@/assets/icons/v2/clip.svg";
import AssetIcon from "@/assets/icons/v2/asset.svg";

const S = CreateModuleClassMatcher(NavStyles);

const pages = [
  { label: "Source", key: "source", icon: SourceIcon },
  { label: "Tags", key: "tags", icon: TagIcon },
  { label: "Clips", key: "clips", icon: ClipIcon },
  { label: "Assets", key: "assets", icon: AssetIcon }
];

const Nav = observer(() => {
  return (
    <nav className={S("nav")}>
      {
        pages.map(({label, key, icon}) =>
          <IconButton
            key={`button-${key}`}
            label={label}
            icon={icon}
            onClick={() => rootStore.SetView(key)}
            active={rootStore.view === key}
            disabled={key !== "source" && !videoStore.initialized}
            className={S("nav__button")}
          />
        )
      }
    </nav>
  );
});

export default Nav;
