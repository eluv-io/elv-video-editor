import NavStyles from "@/assets/stylesheets/modules/nav.module.scss";

import React from "react";
import {observer} from "mobx-react-lite";
import {compositionStore, rootStore, videoStore} from "@/stores";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {IconButton} from "@/components/common/Common";
import UrlJoin from "url-join";

import SourceIcon from "@/assets/icons/v2/source.svg";
import TagIcon from "@/assets/icons/v2/tag.svg";
import ClipIcon from "@/assets/icons/v2/clip.svg";
import AssetIcon from "@/assets/icons/v2/asset.svg";
import CompositionIcon from "@/assets/icons/v2/play-clip.svg";

const S = CreateModuleClassMatcher(NavStyles);

const Nav = observer(() => {
  const { libraryId, objectId } = videoStore.videoObject || {};
  const compositionObject = compositionStore.videoObject;

  const pages = [
    {
      label: "Source",
      key: "source",
      to: "/",
      icon: SourceIcon,
      active: !rootStore.page || rootStore.page === "source"
    },
    {
      label: "Simple Mode",
      key: "simple",
      disabled: !objectId || (videoStore.ready && !videoStore.isVideo),
      to: !objectId ? "/" : UrlJoin("/", libraryId, objectId),
      icon: ClipIcon,
      active: rootStore.page === "simple"
    },
    {
      label: "Compositions",
      key: "compositions",
      //to: !compositionObject?.objectId ? "/" : UrlJoin("/compositions", objectId),
      // TODO: Change
      to: "/compositions/iq__3QhxBgWHZDkcN87irAYqf5hSGdya",
      icon: CompositionIcon,
      active: !rootStore.page || rootStore.page === "compositions"
    },

    {
      label: "Tags",
      key: "tags",
      disabled: !objectId || (videoStore.ready && !videoStore.isVideo),
      to: !objectId ? "/" : UrlJoin("/", libraryId, objectId, "tags"),
      icon: TagIcon,
      active: ["tags", "clips"].includes(rootStore.page)
    },
    {
      label: "Assets",
      key: "assets",
      disabled: !objectId || (videoStore.ready),
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
