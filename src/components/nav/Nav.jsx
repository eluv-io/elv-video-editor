import NavStyles from "@/assets/stylesheets/modules/nav.module.scss";

import React from "react";
import {observer} from "mobx-react-lite";
import {compositionStore, editStore, rootStore, videoStore} from "@/stores";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {IconButton} from "@/components/common/Common";
import UrlJoin from "url-join";

import SourceIcon from "@/assets/icons/v2/folder.svg";
import TagIcon from "@/assets/icons/v2/tag.svg";
import ClipIcon from "@/assets/icons/v2/clip.svg";
import AssetIcon from "@/assets/icons/v2/asset.svg";
import CompositionIcon from "@/assets/icons/v2/composition.svg";
import GroundTruthIcon from "@/assets/icons/v2/ground-truth.svg";

const S = CreateModuleClassMatcher(NavStyles);

const Nav = observer(() => {
  const objectId = rootStore.selectedObjectId;
  const compositionObject = compositionStore.compositionObject;

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
      to: !objectId ? "/" : UrlJoin("/", objectId),
      icon: ClipIcon,
      active: rootStore.page === "simple"
    },
    {
      label: "Compositions",
      key: "compositions",
      to: !compositionObject?.objectId ?
        "/compositions" :
        UrlJoin("/compositions", compositionObject.objectId, compositionObject.compositionKey),
      icon: CompositionIcon,
      active: !rootStore.page || rootStore.page === "compositions"
    },

    {
      label: "Tags",
      key: "tags",
      disabled: !objectId || (videoStore.ready && !videoStore.isVideo),
      to: !objectId ? "/" : UrlJoin("/", objectId, "tags"),
      icon: TagIcon,
      active: ["tags", "clips"].includes(rootStore.page),
      hasChanges: editStore.HasUnsavedChanges("tags") || editStore.HasUnsavedChanges("clips")
    },
    {
      label: "Assets",
      key: "assets",
      disabled: !objectId,
      to: !objectId ? "/" : UrlJoin("/", objectId, "assets"),
      icon: AssetIcon,
      active: rootStore.page === "assets",
      hasChanges: editStore.HasUnsavedChanges("assets")
    },
    {
      label: "Ground Truth",
      key: "ground-truth",
      to: "/ground-truth",
      icon: GroundTruthIcon,
      active: rootStore.page === "groundTruth",
      hasChanges: editStore.HasUnsavedChanges("groundTruth")
    }
  ];

  return (
    <nav className={S("nav")}>
      {
        pages.map(({label, key, icon, to, active, disabled, hasChanges}) =>
          <IconButton
            key={`button-${key}`}
            label={
              <div className={S("nav__label")}>
                <span className={S("nav__label-content")}>{label}</span>
                {
                  !hasChanges ? null :
                    <span className={S("nav__label-note")}>(You have unsaved changes)</span>
                }
              </div>
            }
            icon={icon}
            to={to}
            disabled={disabled}
            active={active}
            className={S("nav__button")}
          >
            {
              !hasChanges ? null :
                <div className={S("nav__change-indicator")} />
            }
          </IconButton>
        )
      }
    </nav>
  );
});

export default Nav;
