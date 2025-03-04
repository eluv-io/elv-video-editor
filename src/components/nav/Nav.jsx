import NavStyles from "@/assets/stylesheets/modules/nav.module.scss";

import React from "react";
import {observer} from "mobx-react-lite";
import {rootStore, videoStore} from "@/stores";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {IconButton} from "@/components/common/Common";

import SourceIcon from "@/assets/icons/v2/source.svg";
import TagIcon from "@/assets/icons/v2/tag.svg";
import ClipIcon from "@/assets/icons/v2/clip.svg";
import AssetIcon from "@/assets/icons/v2/asset.svg";
import UrlJoin from "url-join";

const S = CreateModuleClassMatcher(NavStyles);

const Nav = observer(() => {
  const { libraryId, objectId } = videoStore.videoObject || {};
  const pages = [
    {
      label: "Source",
      key: "source",
      to: "/",
      icon: SourceIcon,
      active: !rootStore.page || rootStore.page === "source"
    },
    {
      label: "Tags",
      key: "tags",
      disabled: !objectId || (videoStore.ready && !videoStore.isVideo),
      to: !objectId ? "/" : UrlJoin("/", libraryId, objectId, "tags"),
      icon: TagIcon,
      active: rootStore.page === "tags"
    },
    {
      label: "Clips",
      key: "clips",
      disabled: !objectId || (videoStore.ready && !videoStore.isVideo),
      to: !objectId ? "/" : UrlJoin("/", libraryId, objectId, "clips"),
      icon: ClipIcon,
      active: rootStore.page === "clips"
    },
    {
      label: "Assets",
      key: "assets",
      disabled: !objectId || (videoStore.ready && !videoStore.hasAssets),
      to: !objectId ? "/" : UrlJoin("/", libraryId, objectId, "assets"),
      icon: AssetIcon,
      active: rootStore.page === "assets"
    }
  ];

  return (
    <nav className={S("nav")}>
      {
        pages.map(({label, key, icon, to, active, disabled}) =>
          <IconButton
            key={`button-${key}`}
            label={label}
            icon={icon}
            to={to}
            disabled={disabled}
            active={active}
            className={S("nav__button")}
          />
        )
      }
    </nav>
  );
});

export default Nav;
