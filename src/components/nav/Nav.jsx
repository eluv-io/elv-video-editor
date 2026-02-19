import NavStyles from "@/assets/stylesheets/modules/nav.module.scss";

import React from "react";
import {observer} from "mobx-react-lite";
import {compositionStore, editStore, rootStore, videoStore} from "@/stores";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {Confirm, IconButton} from "@/components/common/Common";
import UrlJoin from "url-join";
import {useLocation} from "wouter";

import SourceIcon from "@/assets/icons/v2/folder.svg";
import TagIcon from "@/assets/icons/v2/tag.svg";
import ClipIcon from "@/assets/icons/v2/clip.svg";
import AssetIcon from "@/assets/icons/v2/asset.svg";
import CompositionIcon from "@/assets/icons/v2/composition.svg";
import GroundTruthIcon from "@/assets/icons/v2/ground-truth.svg";
import PinIcon from "@/assets/icons/v2/pin.svg";

const S = CreateModuleClassMatcher(NavStyles);

const Nav = observer(() => {
  const [, navigate] = useLocation();
  const objectId = rootStore.selectedObjectId;
  const compositionObject = compositionStore.compositionObject;

  let pages = [
    !objectId ? undefined :
      {
        label: `Active: ${rootStore.selectedObjectName || rootStore.selectedObjectId}`,
        key: "pin",
        icon: PinIcon,
        onClick: async () => {
          await Confirm({
            title: "Clear Active Item",
            text: "Would you like to clear the active item?",
            onConfirm: () => {
              rootStore.Navigate("/");
              rootStore.SetSelectedObjectId(undefined, "");
            }
          });
        }
      },
    {
      label: "Source",
      key: "source",
      to: "/browse",
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
  ]
    .filter(item => item);

  // Deal with navigating away from unsaved tag changes
  if(["tags", "clips"].includes(rootStore.page) && (editStore.HasUnsavedChanges("tags") || editStore.HasUnsavedChanges("clips"))) {
    pages = pages.map(item => ({
      ...item,
      to: item.key === "tags" ? item.to : undefined,
      onClick: item.key === "tags" ? item.onclick :
        async () => {
          await Confirm({
            title: "Save Changes",
            text: "You have unsaved changes. Would you like to save before navigating away from this page?",
            labels: {confirm: "Save Changes", cancel: "Continue"},
            onCancel: () => navigate(item.to),
            onConfirm: async () => {
              if(videoStore.thumbnailStore?.generating) {
                let cancelled = false;
                await Confirm({
                  title: "Save Changes",
                  text: "Warning: Thumbnails are currently generating for this content. If you don't finalize the thumbnails before saving your changes, the thumbnails will be lost and thumbnail generation will have to be restarted. Do you want to proceed?",
                  onConfirm: async () => await videoStore.thumbnailStore?.RemoveThumbnailJob({
                    objectId: videoStore.videoObject?.objectId
                  }),
                  onCancel: () => cancelled = true
                });

                if(cancelled) {
                  return;
                }
              }

              await editStore.Save();
            }
          });
        }
    }));
  }

  return (
    <nav className={S("nav")}>
      {
        pages.map(({label, key, icon, to, active, disabled, hasChanges, onClick}) =>
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
            onClick={onClick}
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
