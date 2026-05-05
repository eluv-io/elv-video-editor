import NavStyles from "@/assets/stylesheets/modules/nav.module.scss";

import React, {useState} from "react";
import {observer} from "mobx-react-lite";
import {aiStore, compositionStore, editStore, rootStore, videoStore} from "@/stores";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {Confirm, CopyableField, IconButton, StyledButton} from "@/components/common/Common";
import UrlJoin from "url-join";
import {useLocation} from "wouter";
import {Popover} from "@mantine/core";

import SearchIcon from "@/assets/icons/ai-search.svg";
import SourceIcon from "@/assets/icons/v2/folder.svg";
import TagIcon from "@/assets/icons/v2/tag.svg";
import ClipIcon from "@/assets/icons/v2/clip.svg";
import AssetIcon from "@/assets/icons/v2/asset.svg";
import CompositionIcon from "@/assets/icons/v2/composition.svg";
import GroundTruthIcon from "@/assets/icons/v2/ground-truth.svg";
import PinIcon from "@/assets/icons/v2/pin.svg";
import TaggingIcon from "@/assets/icons/tagging.svg";
import TitlesIcon from "@/assets/icons/titles.svg";

const S = CreateModuleClassMatcher(NavStyles);

let menuTimeout;
const ActiveItem = observer(() => {
  const [show, setShow] = useState(false);

  if(!rootStore.selectedObjectId) { return; }

  const Hover = () => {
    clearTimeout(menuTimeout);
    menuTimeout = setTimeout(() => setShow(true), 250);
  };

  const Blur = () => menuTimeout = setTimeout(() => setShow(false), 250);

  return (
    <Popover
      position="right-start"
      offset={20}
      opened={show}
      classNames={{
        dropdown: S("active-menu__container")
      }}
    >
      <Popover.Target>
        <IconButton
          onFocus={Hover}
          onMouseEnter={Hover}
          onMouseLeave={Blur}
          onBlur={Blur}
          onClick={() => {}}
          icon={PinIcon}
          className={S("nav__button")}
        />
      </Popover.Target>
      <Popover.Dropdown>
        <div
          onFocus={Hover}
          onMouseEnter={Hover}
          onMouseLeave={Blur}
          onBlur={Blur}
          className={S("active-menu")}
        >
          <div className={S("active-menu__title")}>
            Active Item:
          </div>
          <div className={S("active-menu__name")}>
            { rootStore.selectedObjectName }
          </div>
          <CopyableField value={rootStore.selectedObjectId} className={S("active-menu__id")}>
            { rootStore.selectedObjectId }
          </CopyableField>
          <StyledButton
            size="md"
            className={S("active-menu__button")}
            onClick={() => {
              setShow(false);
              Confirm({
                title: "Clear Active Item",
                text: "Would you like to clear the active item?",
                onConfirm: () => {
                  rootStore.Navigate("/");
                  rootStore.SetSelectedObjectId(undefined, "");
                }
              });
            }}
          >
            Clear Active Item
          </StyledButton>
        </div>
      </Popover.Dropdown>
    </Popover>
  );
});

const Nav = observer(() => {
  const [, navigate] = useLocation();
  const objectId = rootStore.selectedObjectId;
  const compositionObject = compositionStore.compositionObject;

  const videoId = compositionObject?.objectId || (videoStore.isVideo && objectId);
  let pages = [
    !aiStore.selectedTitleSearchIndexId ? undefined :
      {
        label: "Titles",
        key: "titles",
        to: "/titles",
        icon: TitlesIcon,
        active: !rootStore.page || rootStore.page === "titles"
      },
    {
      label: "Search",
      key: "search",
      to: UrlJoin("/search", rootStore.client.utils.B58(aiStore.searchResults?.query || "") || ""),
      icon: SearchIcon,
      active: !rootStore.page || rootStore.page === "search"
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
      disabled: !videoId,
      to: !videoId ? "/" : UrlJoin("/", videoId),
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
      disabled: !videoId,
      to: !videoId ? "/" : UrlJoin("/", videoId, "tags"),
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
    },
    {
      label: "AI Runtime",
      key: "tagging",
      to: "/tagging",
      icon: TaggingIcon,
      active: rootStore.page === "tagging",
      hasChanges: editStore.HasUnsavedChanges("tagging")
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
      <ActiveItem />
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
