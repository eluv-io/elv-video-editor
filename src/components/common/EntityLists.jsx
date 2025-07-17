import ListStyles from "@/assets/stylesheets/modules/lists.module.scss";

import {observer} from "mobx-react-lite";
import {Icon, Linkish, LoaderImage} from "@/components/common/Common.jsx";
import ImageIcon from "@/assets/icons/picture.svg";
import AnchorIcon from "@/assets/icons/v2/anchor.svg";
import {Tooltip} from "@mantine/core";
import {CreateModuleClassMatcher, SP} from "@/utils/Utils.js";
import React from "react";

const S = CreateModuleClassMatcher(ListStyles);

export const EntityListItem = observer(({
  link,
  image,
  label,
  subtitle,
  count,
  contain,
  anchor,
  small,
  actions,
  tooltip,
  aspectRatio="square"
}) =>
  <Linkish
    to={link}
    className={
      S(
        "entity-card",
        `entity-card--${aspectRatio}`,
        "entity-list-item",
        `entity-list-item--${aspectRatio}`,
        small ? "entity-list-item--small" : ""
      )
    }
  >
    <div className={S("entity-card__image-container")}>
      {
        !image ?
          <div className={S("entity-card__image", "entity-card__image--blank")}>
            <Icon icon={ImageIcon}/>
          </div> :
          <LoaderImage
            width={100}
            src={image}
            loaderDelay={25}
            loaderAspectRatio={aspectRatio === "landscape" ? 16/9 : 1}
            className={S("entity-card__image", contain ? "entity-card__image--contain" : "")}
          />
      }
      {
        !anchor ? null :
          <Icon icon={AnchorIcon} className={S("entity-card__image-badge")} />
      }
    </div>
    <div className={S("entity-card__text")}>
      <Tooltip position="top-start" openDelay={500} label={tooltip || label}>
        <div className={S("entity-card__title")}>
          <div className={S("ellipsis")}>
            {label}
          </div>
          {
            typeof count === "undefined" ? null :
              <div className={S("entity-card__count")}>({count})</div>
          }
        </div>
      </Tooltip>
      {
        !subtitle ? null :
          <div className={S("entity-card__subtitle")}>
            { subtitle }
          </div>
      }
    </div>
    <div onClick={SP()} className={S("entity-list-item__actions")}>
      { actions }
    </div>
  </Linkish>
);

export const EntityCard = observer(({
  link,
  image,
  label,
  subtitle,
  count,
  contain,
  anchor,
  actions,
  tooltip,
  aspectRatio="square"
}) => {
  return (
    <div className={S("entity-card", `entity-card--${aspectRatio}`)}>
      <Linkish
        to={link}
        className={S("entity-card__image-container")}
      >
        {
          !image ?
            <div className={S("entity-card__image", "entity-card__image--blank")}>
              <Icon icon={ImageIcon}/>
            </div> :
            <LoaderImage
              width={320}
              src={image}
              loaderDelay={25}
              loaderAspectRatio={aspectRatio === "landscape" ? 16/9 : 1}
              className={S("entity-card__image", contain ? "entity-card__image--contain" : "")}
            />
        }
        {
          !anchor ? null :
            <Icon icon={AnchorIcon} className={S("entity-card__image-badge")}/>
        }
      </Linkish>
      <div className={S("entity-card__text")}>
        <Tooltip openDelay={500} label={tooltip || label}>
          <div className={S("entity-card__title")}>
            <div className={S("ellipsis")}>
              {label}
            </div>
            {
              typeof count === "undefined" ? null :
                <div className={S("entity-card__count")}>({count})</div>
            }
          </div>
        </Tooltip>
        {
          !actions ? null :
            <div onClick={SP()} className={S("entity-card__actions")}>
              {actions}
            </div>
        }
      </div>
      {
        !subtitle ? null :
          <div className={S("entity-card__subtitle")}>
            {subtitle}
          </div>
      }
    </div>
  );
});
